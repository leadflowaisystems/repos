/**
 * PROVISIONING THE SIX VERTICAL DEMO WORKSPACES.
 *
 * Synthetic demo data for product evaluation. For each entry in
 * `./verticals/index.ts` this makes sure there is exactly one business, marked
 * as a demonstration so it never expires, with its own feedback page, its
 * story seeded through the real services, and — when a way to mint Supabase
 * identities is supplied — one owner login with one membership.
 *
 * IDEMPOTENT BY NAMESPACE. A demo business is found by the marker in its
 * operator notes (`[headway-demo:<key>]`), never by name alone. A second run
 * finds everything the first one made and creates nothing twice: no second
 * business, gateway, login, membership, feedback or improvement. A business
 * that merely shares a demo's name is refused, not adopted.
 *
 * NOTHING OUTSIDE THE NAMESPACE IS WRITTEN. Every write names a client this
 * run created or found by its marker, or a user with a demo login address.
 * Corner Cafe, the older demo businesses and every real customer are never
 * read for writing.
 *
 * THE PRODUCT'S OWN PATHS. The business is created the way the operator's
 * "Add client" form creates one — `app.create_client`, then the same columns
 * `createClient` writes — under the platform administrator's identity, because
 * that definer function checks it. The demo exemption goes through
 * `app.set_service_access`, the function behind the admin's own button. The
 * login is the M39 pattern: a pre-confirmed Supabase identity, `provisionUser`,
 * and an OWNER membership. Where the definer functions are absent (the test
 * suite's per-file schemas) the services' own direct paths are used instead.
 */

import type { PrismaClient } from '@prisma/client';
import { createClient, findActiveNameCollision } from '@/lib/clients/service';
import { clientInputSchema } from '@/lib/clients/schema';
import { isMissingDbFunction } from '@/lib/db';
import { ensureGateway } from '@/lib/gateway/service';
import { setServiceAccess } from '@/lib/lifecycle/admin';
import { createClientRow, provisionUser, ROLE_OWNER, ACTIVE } from '@/lib/tenancy/service';
import { newPublicToken } from '@/lib/tokens';
import { countStoryFeedback, type DemoStory } from './story';
import { createStorySeeder, emptySeedManifest } from './story-seeder';
import { DEMO_WORKSPACES, demoMarker, type DemoWorkspace } from './verticals';

/** Mints and removes Supabase identities. Absent means: no logins this run. */
export type IdentityProvider = {
  create(email: string): Promise<{ authUserId: string; password: string }>;
  remove(authUserId: string): Promise<void>;
};

export type ProvisionOptions = {
  /** The platform administrator whose identity the definer functions check. */
  adminUserId: string;
  identity: IdentityProvider | null;
  /** Demo keys whose story is rebuilt from scratch. Their business, page and login are kept. */
  reseed?: ReadonlySet<string>;
  /** Only these demo keys. Default: all six. */
  only?: ReadonlySet<string>;
  /** Report what would happen and write nothing. */
  dryRun?: boolean;
  now?: Date;
  log?: (line: string) => void;
  workspaces?: readonly DemoWorkspace[];
};

export type LoginOutcome =
  | { state: 'created'; email: string; password: string }
  | { state: 'exists'; email: string }
  | { state: 'skipped'; email: string; reason: string }
  | { state: 'failed'; email: string; reason: string };

export type DemoOutcome = {
  key: string;
  businessName: string;
  vertical: string;
  clientId: string | null;
  client: 'created' | 'found' | 'would-create';
  story: 'seeded' | 'reseeded' | 'kept' | 'would-seed' | 'would-reseed';
  feedback: number;
  publicToken: string | null;
  login: LoginOutcome;
};

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * A transaction carrying one person's identity, as `withRlsContext` does for a
 * signed-in request. A script has no session, so the identity is named
 * explicitly — and the definer functions still check it against the User row.
 */
async function asUser<T>(db: PrismaClient, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  // Prisma's 5-second default is too tight over the remote session pooler:
  // the sixth business in the first production run hit it and rolled back.
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, TRUE)`;
      return fn(tx);
    },
    { maxWait: 30_000, timeout: 60_000 },
  );
}

function firstQrDate(story: DemoStory): Date | null {
  const dates = story.qr.map((q) => new Date(q.at).getTime()).sort((a, b) => a - b);
  return dates.length > 0 ? new Date(dates[0]!) : null;
}

function clientInput(w: DemoWorkspace) {
  return clientInputSchema.parse({
    businessName: w.businessName,
    vertical: w.vertical,
    areaLabel: w.areaLabel,
    mapsUrl: null,
    reviewLinkUrl: null,
    ownerName: null,
    ownerPhone: null,
    ownerEmail: null,
    avgCustomerValueInr: null,
    plan: 'STARTER',
    status: 'ACTIVE',
    onboardingDate: null,
    baselineRating: null,
    baselineReviewCount: null,
    baselineReviewsPerWeek: null,
    baselineObservedAt: null,
    kitInstalledDate: firstQrDate(w.story),
    notes: `Demo workspace for sales demonstrations. Every customer, review and figure in it is synthetic. ${demoMarker(w.key)}`,
  });
}

/** The one client carrying this demo's marker, or null. Two is a fault, never a guess. */
export async function findDemoClient(db: PrismaClient, w: DemoWorkspace) {
  const rows = await db.client.findMany({
    where: { notes: { contains: demoMarker(w.key) } },
    select: { id: true, businessName: true, vertical: true, archivedAt: true, serviceExemption: true },
  });
  if (rows.length > 1) {
    throw new Error(`${rows.length} clients carry ${demoMarker(w.key)}; refusing to guess which is the demo.`);
  }
  const row = rows[0] ?? null;
  if (row && row.vertical !== w.vertical) {
    throw new Error(`${demoMarker(w.key)} is on a ${row.vertical} client, not ${w.vertical}. Refusing.`);
  }
  return row;
}

/** The operator's "Add client", as the platform administrator. */
async function createDemoClient(db: PrismaClient, w: DemoWorkspace, adminUserId: string, now: Date): Promise<string> {
  const input = clientInput(w);
  try {
    return await asUser(db, adminUserId, async (tx) => {
      const id = await createClientRow(
        tx,
        { businessName: input.businessName, vertical: input.vertical, asOwner: false, status: input.status, plan: input.plan },
        now,
      );
      // The same columns `createClient` writes after the definer function.
      await tx.client.update({
        where: { id },
        data: {
          areaLabel: input.areaLabel,
          mapsUrl: input.mapsUrl,
          reviewLinkUrl: input.reviewLinkUrl,
          ownerName: input.ownerName,
          ownerPhone: input.ownerPhone,
          ownerEmail: input.ownerEmail,
          avgCustomerValueInr: input.avgCustomerValueInr,
          onboardingDate: input.onboardingDate,
          baselineRating: input.baselineRating,
          baselineReviewCount: input.baselineReviewCount,
          baselineReviewsPerWeek: input.baselineReviewsPerWeek,
          baselineObservedAt: input.baselineObservedAt,
          kitInstalledDate: input.kitInstalledDate,
          notes: input.notes,
          voiceProfile: { create: {} },
          policy: { create: {} },
          kitConfig: { create: {} },
          gateway: { create: { publicToken: newPublicToken(), publicReviewUrl: '' } },
        },
      });
      return id;
    });
  } catch (error) {
    if (!isMissingDbFunction(error)) throw error;
  }
  // No definer functions here: the service's own direct path.
  const created = await createClient(db, input);
  if (!created.ok) throw new Error(`create ${w.businessName}: ${created.message} ${JSON.stringify(created.errors)}`);
  return created.data.id;
}

/** The admin's "mark as the demo business" button, and the minute it leaves. */
async function exemptAsDemo(db: PrismaClient, clientId: string, adminUserId: string, now: Date): Promise<void> {
  try {
    await asUser(db, adminUserId, async (tx) => {
      await tx.$executeRaw`SELECT app.set_service_access(${clientId}::text, 'EXEMPT_DEMO'::text, ${now.toISOString()}::text)`;
      await tx.minute.create({
        data: {
          clientId,
          occurredAt: now,
          category: 'DECISION',
          title: 'Marked as the demo business',
          body: 'This business never expires, and its QR keeps taking feedback.',
        },
      });
    });
    return;
  } catch (error) {
    if (!isMissingDbFunction(error)) throw error;
  }
  const result = await setServiceAccess(db, clientId, 'EXEMPT_DEMO', { now });
  if (!result.ok) throw new Error(`exempt ${clientId}: ${result.message}`);
}

/** Everything a story put in one demo client — and nothing any other client holds. */
async function clearStory(db: PrismaClient, clientId: string): Promise<void> {
  const where = { clientId };
  await db.improvementAction.deleteMany({ where });
  await db.businessContext.deleteMany({ where });
  // Minutes go too, except the record of the demo exemption itself.
  await db.minute.deleteMany({ where: { clientId, NOT: { title: 'Marked as the demo business' } } });
  await db.snapshot.deleteMany({ where });
  await db.reviewItem.deleteMany({ where });
}

async function ensureLogin(
  db: PrismaClient,
  w: DemoWorkspace,
  clientId: string,
  identity: IdentityProvider | null,
  dryRun: boolean,
): Promise<LoginOutcome> {
  const email = w.loginEmail.toLowerCase();
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, authProviderId: true, isPlatformAdmin: true, memberships: { select: { clientId: true, role: true, status: true } } },
  });

  if (user) {
    // The demo login belongs to its own business and to nothing else. Anything
    // wider is somebody's mistake, and silently widening it would be ours.
    if (user.isPlatformAdmin) return { state: 'failed', email, reason: 'that address is a platform administrator' };
    const elsewhere = user.memberships.filter((m) => m.clientId !== clientId);
    if (elsewhere.length > 0) return { state: 'failed', email, reason: 'that login already belongs to another business' };
    if (!user.authProviderId) return { state: 'failed', email, reason: 'a row exists with no sign-in identity behind it' };
    const mine = user.memberships.find((m) => m.clientId === clientId);
    if (mine && (mine.role !== ROLE_OWNER || mine.status !== ACTIVE)) {
      return { state: 'failed', email, reason: `membership is ${mine.role}/${mine.status}, not an active owner` };
    }
    if (!mine && !dryRun) {
      await db.membership.create({ data: { userId: user.id, clientId, role: ROLE_OWNER, status: ACTIVE } });
    }
    return { state: 'exists', email };
  }

  if (!identity) return { state: 'skipped', email, reason: 'no Supabase admin credentials for this run' };
  if (dryRun) return { state: 'skipped', email, reason: 'dry run' };

  let minted: { authUserId: string; password: string };
  try {
    minted = await identity.create(email);
  } catch (error) {
    return { state: 'failed', email, reason: error instanceof Error ? error.message : String(error) };
  }
  try {
    const { userId } = await provisionUser(db, { providerId: minted.authUserId, email });
    await db.membership.create({ data: { userId, clientId, role: ROLE_OWNER, status: ACTIVE } });
    return { state: 'created', email, password: minted.password };
  } catch (error) {
    // The same clean-up generateTempAccess does: an identity nothing points
    // at is removed rather than left behind.
    await identity.remove(minted.authUserId);
    return { state: 'failed', email, reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function provisionDemoWorkspaces(
  db: PrismaClient,
  options: ProvisionOptions,
): Promise<DemoOutcome[]> {
  const log = options.log ?? ((line: string) => console.log(line));
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? false;
  const workspaces = (options.workspaces ?? DEMO_WORKSPACES).filter((w) => !options.only || options.only.has(w.key));

  const admin = await db.user.findUnique({
    where: { id: options.adminUserId },
    select: { id: true, isPlatformAdmin: true, status: true },
  });
  if (!admin || !admin.isPlatformAdmin || admin.status !== ACTIVE) {
    throw new Error('The acting user must be an active platform administrator.');
  }

  const outcomes: DemoOutcome[] = [];
  for (const w of workspaces) {
    log(`${w.businessName} (${w.vertical}) ${demoMarker(w.key)}`);

    let found = await findDemoClient(db, w);
    if (found?.archivedAt) throw new Error(`${w.businessName} is archived. Restore it by hand first; this run will not.`);
    if (!found) {
      const collision = await findActiveNameCollision(db, w.businessName);
      if (collision) {
        throw new Error(`"${collision.businessName}" (${collision.id}) already exists without the demo marker. Refusing to adopt it.`);
      }
    }

    if (dryRun) {
      const feedback = found ? await db.reviewItem.count({ where: { clientId: found.id } }) : 0;
      const gateway = found ? await db.feedbackGateway.findUnique({ where: { clientId: found.id } }) : null;
      const login = found
        ? await ensureLogin(db, w, found.id, options.identity, true)
        : ({ state: 'skipped', email: w.loginEmail, reason: 'dry run' } as const);
      const reseed = options.reseed?.has(w.key) ?? false;
      outcomes.push({
        key: w.key,
        businessName: w.businessName,
        vertical: w.vertical,
        clientId: found?.id ?? null,
        client: found ? 'found' : 'would-create',
        story: !found || feedback === 0 ? 'would-seed' : reseed ? 'would-reseed' : 'kept',
        feedback,
        publicToken: gateway?.publicToken ?? null,
        login,
      });
      log(`  · dry run: ${found ? `found ${found.id}, ${feedback} feedback` : 'would create'}`);
      continue;
    }

    let clientState: DemoOutcome['client'] = 'found';
    if (!found) {
      const id = await createDemoClient(db, w, options.adminUserId, now);
      clientState = 'created';
      log(`  · created ${id}`);
      found = await findDemoClient(db, w);
      if (!found) throw new Error(`created ${w.businessName} but cannot find it by its marker`);
    }
    const clientId = found.id;

    if (found.serviceExemption !== 'DEMO') {
      await exemptAsDemo(db, clientId, options.adminUserId, now);
      log('  · marked as a demo business');
    }

    const gateway = await ensureGateway(db, clientId);
    if (!gateway) throw new Error(`${w.businessName} has no feedback page`);

    let storyState: DemoOutcome['story'] = 'kept';
    const existing = await db.reviewItem.count({ where: { clientId } });
    const reseed = options.reseed?.has(w.key) ?? false;
    if (existing === 0 || reseed) {
      if (existing > 0) {
        await clearStory(db, clientId);
        log(`  · cleared ${existing} feedback and everything built on it`);
      }
      const seeder = createStorySeeder(db, emptySeedManifest(), (line) => log(line));
      await seeder.seedStory(clientId, w.story);
      await seeder.finishClient(clientId);
      await seeder.printSummary({ id: clientId, businessName: w.businessName, vertical: w.vertical });
      storyState = existing > 0 ? 'reseeded' : 'seeded';
    } else {
      log(`  · story already seeded (${existing} feedback), kept`);
    }

    const login = await ensureLogin(db, w, clientId, options.identity, false);
    log(`  · login ${login.email}: ${login.state}${'reason' in login ? ` (${login.reason})` : ''}`);

    outcomes.push({
      key: w.key,
      businessName: w.businessName,
      vertical: w.vertical,
      clientId,
      client: clientState,
      story: storyState,
      feedback: await db.reviewItem.count({ where: { clientId } }),
      publicToken: gateway.publicToken,
      login,
    });
  }
  return outcomes;
}

/** What every story promises to hold, for checking a seeded workspace against. */
export function expectedFeedback(w: DemoWorkspace): number {
  return countStoryFeedback(w.story);
}
