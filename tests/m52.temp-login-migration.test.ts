import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRlsTestDb, hasRlsRuntimeDb, type RlsTestDb } from './helpers/rls-db';
import { resetDb } from './helpers/test-db';

/**
 * THE M52 ONE-TIME MOVE, ON EVERY SHAPE PRODUCTION HOLDS (M52).
 *
 * Before M52 the temporary login WAS the owner User's own identity. The
 * migration (`prisma/m52/migration.sql`) moves each existing row into the
 * two-login shape. Production has eight rows, in these five shapes; each is
 * built here exactly as the old code left it, the migration file is run as it
 * will be run on production (as the owner, statement by statement), and the
 * result is checked — then run again, to prove it changes nothing the second
 * time.
 */

const NOW = new Date('2026-10-02T12:00:00Z');

let harness: RlsTestDb;
let owner: PrismaClient;

const SHAPES = {
  // Temporary access, never set up: the identity moves to tempAuthId.
  activeNeverSetUp: { status: 'TEMPORARY_ACTIVE', setup: null, emailIsLogin: true },
  disabledNeverSetUp: { status: 'DISABLED', setup: null, emailIsLogin: true },
  // The old temporary login became the owner's own: it stays theirs.
  setUp: { status: 'SETUP_COMPLETE', setup: NOW, emailIsLogin: true },
  disabledAfterSetUp: { status: 'DISABLED', setup: NOW, emailIsLogin: true },
  emailAlreadyMoved: { status: 'TEMPORARY_ACTIVE', setup: null, emailIsLogin: false },
} as const;

type Shape = keyof typeof SHAPES;
const ids = {} as Record<Shape, { clientId: string; userId: string; authId: string; loginId: string }>;

function statements(): string[] {
  const sql = readFileSync(join(process.cwd(), 'prisma/m52/migration.sql'), 'utf8');
  return sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter((s) => s.length > 0);
}

async function migrate() {
  for (const statement of statements()) await owner.$executeRawUnsafe(statement);
}

async function snapshot() {
  const out: Record<string, unknown> = {};
  for (const shape of Object.keys(SHAPES) as Shape[]) {
    const access = await owner.accountAccess.findUniqueOrThrow({
      where: { clientId: ids[shape].clientId },
      include: { user: { select: { authProviderId: true, email: true } } },
    });
    out[shape] = {
      status: access.status,
      tempAuthId: access.tempAuthId,
      setupCompletedAt: access.setupCompletedAt !== null,
      userAuth: access.user.authProviderId,
      userEmail: access.user.email,
    };
  }
  return out;
}

beforeAll(async () => {
  expect(hasRlsRuntimeDb(), 'REPOS_TEST_DATABASE_URL and REPOS_TEST_APP_DATABASE_URL must be set').toBe(true);
  harness = await createRlsTestDb('m52-temp-login-migration');
  owner = harness.owner;
  await resetDb(owner);

  let n = 0;
  for (const shape of Object.keys(SHAPES) as Shape[]) {
    n += 1;
    const spec = SHAPES[shape];
    const loginId = `legacy0${n}@access.headway.local`;
    const authId = `bbbbbbbb-0000-4000-8000-00000000000${n}`;
    const user = await owner.user.create({
      data: { email: spec.emailIsLogin ? loginId : `real${n}@owner.test`, authProviderId: authId },
      select: { id: true },
    });
    const client = await owner.client.create({
      data: {
        businessName: `Legacy ${shape}`,
        vertical: 'salon',
        status: 'ACTIVE',
        memberships: { create: { userId: user.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' } },
      },
      select: { id: true },
    });
    await owner.accountAccess.create({
      data: {
        clientId: client.id,
        userId: user.id,
        loginId,
        status: spec.status,
        setupCompletedAt: spec.setup,
        disabledAt: spec.status === 'DISABLED' ? NOW : null,
      },
    });
    ids[shape] = { clientId: client.id, userId: user.id, authId, loginId };
  }
}, 240_000);

afterAll(async () => {
  await harness?.dispose();
});

describe('prisma/m52/migration.sql', () => {
  it('moves each existing row into the two-login shape', async () => {
    await migrate();
    const after = await snapshot();

    // Never set up: the identity becomes the temporary login; the User keeps
    // its row and membership, with no login of its own until setup.
    expect(after.activeNeverSetUp).toEqual({
      status: 'TEMPORARY_ACTIVE',
      tempAuthId: ids.activeNeverSetUp.authId,
      setupCompletedAt: false,
      userAuth: null,
      userEmail: ids.activeNeverSetUp.loginId,
    });
    expect(after.disabledNeverSetUp).toEqual({
      status: 'DISABLED',
      tempAuthId: ids.disabledNeverSetUp.authId,
      setupCompletedAt: false,
      userAuth: null,
      userEmail: ids.disabledNeverSetUp.loginId,
    });

    // The old temporary login became the owner's own: it stays theirs, and
    // temporary access is off (an admin can issue a fresh one).
    for (const shape of ['setUp', 'disabledAfterSetUp', 'emailAlreadyMoved'] as const) {
      expect(after[shape], shape).toMatchObject({
        status: 'DISABLED',
        tempAuthId: null,
        setupCompletedAt: true,
        userAuth: ids[shape].authId,
      });
    }
  });

  it('is safe to run twice', async () => {
    const once = await snapshot();
    await migrate();
    expect(await snapshot()).toEqual(once);
  });

  it('leaves the database resolving each identity the way the new code expects', async () => {
    const resolve = async (authId: string) =>
      (await owner.$queryRaw<{ id: string | null }[]>`SELECT app.user_id_for_auth(${authId}) AS id`)[0]?.id ?? null;

    // A temporary login that is on opens its owner; one that is off opens nothing.
    expect(await resolve(ids.activeNeverSetUp.authId)).toBe(ids.activeNeverSetUp.userId);
    expect(await resolve(ids.disabledNeverSetUp.authId)).toBeNull();
    // An owner's own login keeps working, whatever its temporary access says.
    for (const shape of ['setUp', 'disabledAfterSetUp', 'emailAlreadyMoved'] as const) {
      expect(await resolve(ids[shape].authId), shape).toBe(ids[shape].userId);
    }
  });

  it('touched nothing but AccountAccess and the moved User logins', async () => {
    expect(await owner.membership.count({ where: { status: 'ACTIVE' } })).toBe(5);
    expect(await owner.client.count()).toBe(5);
    expect(await owner.user.count()).toBe(5);
  });
});
