import type { PrismaClient } from '@prisma/client';
import { isMissingDbFunction, withRlsContext } from '@/lib/db';

/**
 * THE PLATFORM'S HAND ON THE DOOR (M28).
 *
 * Four things platform staff can do to a business's access, and nothing a
 * business can do to its own. Each one moves a single nullable column, and
 * NONE of them writes `trialStartsAt` or `trialEndsAt`: a lock is not a
 * shortened trial and an override is not an extended one. That separation is
 * the whole reason these are their own columns rather than a date the operator
 * nudges — the stored window is what the owner was told, and it survives every
 * administrative decision made about them.
 *
 * The write goes through `app.set_service_access`, which asks the database
 * whether the caller is platform staff. That is not belt-and-braces: under the
 * real policies `repos_app` holds no UPDATE privilege on any of these three
 * columns, so the direct write below returns nothing and the function is the
 * only way through. The fallback exists for the one place the DDL is not
 * applied — the test suite's per-file schemas — and is kept behaviourally
 * identical so the two cannot drift into meaning different things.
 */

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceErr = { ok: false; message: string; errors: Record<string, string> };
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

/** What staff can do. Lock and override clear each other, in the function. */
export const SERVICE_ACCESS_ACTIONS = [
  'LOCK',
  'UNLOCK',
  'OVERRIDE',
  'CLEAR_OVERRIDE',
  'EXEMPT_DEMO',
  'CLEAR_EXEMPTION',
] as const;
export type ServiceAccessAction = (typeof SERVICE_ACCESS_ACTIONS)[number];

/**
 * What the operator's own record says afterwards. Written as a Minute.
 *
 * Each title names the act, and each pairs with its opposite, so a run of them
 * reads as a history rather than as a list of settings. "Override" and
 * "exemption" are the names of the columns; nobody reading this record has to
 * know either word.
 */
const MINUTE_TITLE: Record<ServiceAccessAction, string> = {
  LOCK: 'Workspace locked by Headway',
  UNLOCK: 'Workspace unlocked by Headway',
  OVERRIDE: 'Workspace opened by hand',
  CLEAR_OVERRIDE: 'No longer opened by hand',
  EXEMPT_DEMO: 'Marked as the demo business',
  CLEAR_EXEMPTION: 'No longer the demo business',
};

const MINUTE_BODY: Record<ServiceAccessAction, string> = {
  LOCK: 'The workspace is closed until Headway opens it again. The trial dates are unchanged, and the QR still follows them.',
  UNLOCK: 'The workspace is open again. The lock never changed the trial dates.',
  OVERRIDE: 'The workspace is open whatever the trial dates say. The dates are unchanged.',
  CLEAR_OVERRIDE: 'The trial dates decide again. They were never changed.',
  EXEMPT_DEMO: 'This business never expires, and its QR keeps taking feedback.',
  CLEAR_EXEMPTION: 'This business follows its trial dates again.',
};

function err(message: string, errors: Record<string, string> = {}): ServiceErr {
  return { ok: false, message, errors };
}
function ok<T>(data: T): ServiceOk<T> {
  return { ok: true, data };
}

/** The direct equivalent of the definer function, for a database without it. */
const DIRECT: Record<ServiceAccessAction, Record<string, Date | string | null>> = {
  LOCK: { serviceLockedAt: new Date(0), accessOverrideAt: null },
  UNLOCK: { serviceLockedAt: null },
  OVERRIDE: { accessOverrideAt: new Date(0), serviceLockedAt: null },
  CLEAR_OVERRIDE: { accessOverrideAt: null },
  EXEMPT_DEMO: { serviceExemption: 'DEMO' },
  CLEAR_EXEMPTION: { serviceExemption: null },
};

/**
 * Applies one administrative decision, and records that it was made.
 *
 * The Minute is the audit trail, written to the record RepOS already keeps per
 * business and shows only in the operator console. It says what changed and,
 * deliberately, that the trial dates did not — because the question somebody
 * will ask in three months is exactly that one.
 */
export async function setServiceAccess(
  db: PrismaClient,
  clientId: string,
  action: ServiceAccessAction,
  options: { now?: Date } = {},
): Promise<ServiceResult<{ clientId: string; action: ServiceAccessAction }>> {
  // Its own sentence rather than the shared validation banner: the action comes
  // off a button, so there is no field on screen to mark.
  if (!(SERVICE_ACCESS_ACTIONS as readonly string[]).includes(action)) {
    return err('Headway did not recognise that action. Try one of the buttons again.', {
      action: 'Pick an action.',
    });
  }
  const now = options.now ?? new Date();

  const client = await db.client.findFirst({ where: { id: clientId }, select: { id: true } });
  if (!client) return err('That business no longer exists.');

  // Inside withRlsContext, not on a bare handle: the function asks
  // app.is_platform_admin(), which reads the transaction-local identity, and a
  // raw query does not pass through the extension that sets it.
  let applied = false;
  try {
    await withRlsContext(db, async (tx) => {
      await tx.$executeRaw`
        SELECT app.set_service_access(${clientId}::text, ${action}::text, ${now.toISOString()}::text)`;
    });
    applied = true;
  } catch (error) {
    if (!isMissingDbFunction(error)) {
      // The database's own words go to the server log, never to the screen: a
      // permission-denied string from Postgres is a diagnostic, not a sentence
      // anybody should have to read to find out what to do next.
      console.error('app.set_service_access failed', error);
      return err('Could not change this account. Try again.');
    }
  }

  if (!applied) {
    const data = { ...DIRECT[action] };
    // The stamps are "when this was decided", so they carry the caller's clock
    // rather than the sentinel above.
    for (const key of ['serviceLockedAt', 'accessOverrideAt']) {
      if (data[key] instanceof Date) data[key] = now;
    }
    await db.client.update({ where: { id: clientId }, data });
  }

  // The record that it happened. Never fatal: an audit line that failed to
  // write must not roll back a lock the operator has already been told about,
  // and the columns themselves carry the timestamp regardless.
  try {
    await db.minute.create({
      data: {
        clientId,
        occurredAt: now,
        category: 'DECISION',
        title: MINUTE_TITLE[action],
        body: MINUTE_BODY[action],
      },
    });
  } catch {
    // Left deliberately silent. See above.
  }

  return ok({ clientId, action });
}
