import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';
import { createClient } from '@/lib/clients/service';
import { acceptInviteViaResolver, inviteMember, setMembership } from '@/lib/team/service';
import { ACTIVE, ROLE_OWNER, ROLE_STAFF } from '@/lib/tenancy/service';

/**
 * RETIRING THE ANONYMOUS PORTAL, AND LETTING INVITATIONS THROUGH (M20 Step I).
 *
 * Two surfaces broke when the runtime stopped bypassing Row Level Security, and
 * they broke for opposite reasons.
 *
 * The owner's anonymous portal read six tenant tables with no identity at all.
 * There was no narrow fix: a token resolver establishes who you are, and the
 * portal's problem was never identity, it was that every subsequent read needed
 * a principal the request did not have. Rebuilding it would have meant a second
 * anonymous tenant principal alongside the signed-in one. It is retired instead;
 * the authenticated workspace was already the canonical home for that content.
 *
 * Invitations broke on a genuine circularity: reading the invitation that admits
 * you to a business is gated on already belonging to it. That one IS narrow, and
 * `app.accept_invitation` resolves it in the same shape as the feedback gateway
 * — opaque token in, tenant resolved internally, minimum data out.
 *
 * The QR feedback gateway is deliberately untouched. It is a different boundary
 * and remains a core capability.
 */

const SCHEMA = 'test_m20_step_i';
const ROOT = resolve(__dirname, '..');

let db: PrismaClient;

/** Installs `app.accept_invitation` from the real rls.sql, aimed at this schema. */
async function installResolver(): Promise<void> {
  const file = readFileSync(join(ROOT, 'prisma', 'm20', 'rls.sql'), 'utf8');
  const from = file.indexOf('CREATE OR REPLACE FUNCTION app.accept_invitation(');
  expect(from, 'rls.sql no longer defines app.accept_invitation').toBeGreaterThan(0);
  const to = file.indexOf('END $$;', from);
  expect(to).toBeGreaterThan(from);

  const sql = file
    .slice(from, to + 6)
    .replace(/\bpublic\.("[A-Za-z]+")/g, `"${SCHEMA}".$1`)
    .replace(/SET search_path = pg_catalog, public/g, `SET search_path = pg_catalog, "${SCHEMA}"`);

  await db.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS app');
  await db.$executeRawUnsafe(sql);
}

async function seed() {
  const alpha = await createClient(db, validClientInput({ businessName: 'Alpha Cafe' }));
  const beta = await createClient(db, validClientInput({ businessName: 'Beta Dental' }));
  if (!alpha.ok || !beta.ok) throw new Error('seed failed');

  const mk = (email: string) =>
    db.user.create({ data: { email, authProviderId: `auth-${email}` }, select: { id: true } });

  const owner = await mk('owner@alpha.test');
  const joiner = await mk('joiner@alpha.test');
  const stranger = await mk('stranger@elsewhere.test');

  await db.membership.create({
    data: { userId: owner.id, clientId: alpha.data.id, role: ROLE_OWNER, status: ACTIVE },
  });

  return { alphaId: alpha.data.id, betaId: beta.data.id, owner, joiner, stranger };
}

let w: Awaited<ReturnType<typeof seed>>;

beforeAll(async () => {
  db = createTestDb('m20-step-i');
  await installResolver();
}, 180_000);

beforeEach(async () => {
  await resetDb(db);
  w = await seed();
});

afterAll(async () => {
  await db.$disconnect();
});

async function invite(email: string, role: string = ROLE_STAFF) {
  const made = await inviteMember(db, w.alphaId, { email, role, invitedById: w.owner.id });
  if (!made.ok) throw new Error('invite failed');
  return made.data;
}

describe('the anonymous portal is retired', () => {
  it('has no route left to serve', () => {
    // Nothing to reach means nothing to leak. An unknown path is a 404 from the
    // framework itself, which cannot accidentally resolve a token to a tenant.
    expect(existsSync(join(ROOT, 'src', 'app', '(portal)'))).toBe(false);

    const routes: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry === 'page.tsx') routes.push(full.replace(ROOT, '').replace(/\\/g, '/'));
      }
    };
    walk(join(ROOT, 'src', 'app'));
    expect(routes.filter((r) => r.includes('/portal/'))).toEqual([]);
  });

  it('is not linked to from anywhere in the application', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry)) {
          const code = readFileSync(full, 'utf8');
          // A link that builds a /portal/ address for a token. The word appears
          // in prose and in the deprecated column names, which is fine.
          if (/href=\{?[`'"]\/portal\//.test(code)) {
            offenders.push(full.replace(ROOT, '').replace(/\\/g, '/'));
          }
        }
      }
    };
    walk(join(ROOT, 'src'));
    expect(offenders).toEqual([]);
  });

  it('keeps the authenticated workspace and the QR gateway intact', () => {
    // Retiring one anonymous surface must not touch the other, nor the signed-in
    // experience that replaced it.
    for (const page of [
      'src/app/(workspace)/workspace/[clientId]/page.tsx',
      'src/app/(workspace)/workspace/[clientId]/reviews/page.tsx',
      'src/app/(workspace)/workspace/[clientId]/improvements/page.tsx',
      'src/app/(workspace)/workspace/[clientId]/checkin/page.tsx',
      'src/app/(workspace)/workspace/[clientId]/team/page.tsx',
      'src/app/(feedback)/feedback/[token]/page.tsx',
    ]) {
      expect(existsSync(join(ROOT, page)), page).toBe(true);
    }
  });

  it('keeps the shared view logic the workspace still depends on', () => {
    // src/lib/portal/* is named for the retired surface but is shared business
    // logic: the workspace components render through it. Deleting it with the
    // routes would have taken the workspace down too.
    for (const mod of ['service.ts', 'view.ts', 'pages.ts', 'history.ts']) {
      expect(existsSync(join(ROOT, 'src', 'lib', 'portal', mod)), mod).toBe(true);
    }
  });

  it('leaves the token columns in place rather than migrating data away', () => {
    const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).toMatch(/portalToken/);
    expect(schema).toMatch(/portalTokenAt/);
  });
});

describe('accepting an invitation through the resolver', () => {
  it('admits the invited person, with the invited role', async () => {
    const made = await invite('joiner@alpha.test', ROLE_STAFF);
    const result = await acceptInviteViaResolver(db, made.token, w.joiner.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.clientId).toBe(w.alphaId);
    expect(result.data.role).toBe(ROLE_STAFF);

    const membership = await db.membership.findFirstOrThrow({
      where: { userId: w.joiner.id, clientId: w.alphaId },
    });
    expect(membership.role).toBe(ROLE_STAFF);
    expect(membership.status).toBe(ACTIVE);

    const invitation = await db.invitation.findFirstOrThrow({ where: { id: made.inviteId } });
    expect(invitation.acceptedAt).not.toBeNull();
  });

  it('refuses an invitation addressed to somebody else', async () => {
    const made = await invite('joiner@alpha.test');
    const result = await acceptInviteViaResolver(db, made.token, w.stranger.id);

    expect(result.ok).toBe(false);
    expect(await db.membership.count({ where: { userId: w.stranger.id } })).toBe(0);
  });

  it('refuses a forged token', async () => {
    await invite('joiner@alpha.test');
    const result = await acceptInviteViaResolver(db, 'not-a-real-invitation-token', w.joiner.id);

    expect(result.ok).toBe(false);
    expect(await db.membership.count({ where: { userId: w.joiner.id } })).toBe(0);
  });

  it('refuses an expired invitation', async () => {
    const made = await invite('joiner@alpha.test');
    await db.invitation.update({
      where: { id: made.inviteId },
      data: { expiresAt: new Date('2020-01-01T00:00:00.000Z') },
    });

    const result = await acceptInviteViaResolver(db, made.token, w.joiner.id);
    expect(result.ok).toBe(false);
    expect(await db.membership.count({ where: { userId: w.joiner.id } })).toBe(0);
  });

  it('refuses an invitation that was already used, and one that was replaced', async () => {
    const first = await invite('joiner@alpha.test');
    expect((await acceptInviteViaResolver(db, first.token, w.joiner.id)).ok).toBe(true);
    // Spent.
    expect((await acceptInviteViaResolver(db, first.token, w.joiner.id)).ok).toBe(false);

    // Re-inviting revokes the outstanding one, so the old link stops working
    // even though it was never accepted.
    const replaced = await invite('second@alpha.test');
    await invite('second@alpha.test');
    const second = await db.user.create({
      data: { email: 'second@alpha.test', authProviderId: 'auth-second' },
      select: { id: true },
    });
    expect((await acceptInviteViaResolver(db, replaced.token, second.id)).ok).toBe(false);
  });

  it('cannot be used to become a platform admin', async () => {
    // The role is clamped to the two business roles inside the function, so
    // there is no value an invitation could carry that reaches isPlatformAdmin.
    const made = await invite('joiner@alpha.test', ROLE_STAFF);
    await db.invitation.update({ where: { id: made.inviteId }, data: { role: 'PLATFORM_ADMIN' } });

    const result = await acceptInviteViaResolver(db, made.token, w.joiner.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.role).toBe(ROLE_STAFF);

    const user = await db.user.findFirstOrThrow({ where: { id: w.joiner.id } });
    expect(user.isPlatformAdmin).toBe(false);
    const membership = await db.membership.findFirstOrThrow({ where: { userId: w.joiner.id } });
    expect(membership.role).toBe(ROLE_STAFF);
  });

  it('names no business, so it cannot admit anyone to the wrong one', async () => {
    const made = await invite('joiner@alpha.test');
    const result = await acceptInviteViaResolver(db, made.token, w.joiner.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.clientId).toBe(w.alphaId);
    expect(result.data.clientId).not.toBe(w.betaId);
    expect(await db.membership.count({ where: { clientId: w.betaId } })).toBe(0);

    // The signature carries no client id at all - the tenant comes from the
    // invitation the token resolves to, and from nowhere else.
    const args = await db.$queryRawUnsafe<{ arguments: string }[]>(
      `SELECT pg_get_function_arguments(p.oid) AS arguments
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'app' AND p.proname = 'accept_invitation'`,
    );
    expect(args).toHaveLength(1);
    expect(args[0]?.arguments).not.toMatch(/client/i);
  });

  it('is a definer function with a pinned search_path', async () => {
    const rows = await db.$queryRawUnsafe<{ prosecdef: boolean; proconfig: string[] | null }[]>(
      `SELECT p.prosecdef, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'app' AND p.proname = 'accept_invitation'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.prosecdef).toBe(true);
    expect(rows[0]?.proconfig?.some((c) => c.startsWith('search_path='))).toBe(true);
  });

  it('leaves last-owner protection exactly where it was', async () => {
    // Acceptance creates memberships; it does not remove them. The rule that a
    // business can never be left without an owner lives in setMembership and is
    // untouched by any of this.
    const owners = await db.membership.findFirstOrThrow({
      where: { clientId: w.alphaId, role: ROLE_OWNER },
    });
    const demoted = await setMembership(db, w.alphaId, owners.id, { role: ROLE_STAFF });

    expect(demoted.ok).toBe(false);
    if (demoted.ok) return;
    expect(demoted.message).toMatch(/only owner/i);
  });
});
