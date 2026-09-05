import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import {
  _resetGatewayThrottles,
  ensureGateway,
  resolvePublicGateway,
  submitCustomerFeedback,
} from '@/lib/gateway/service';
import { isPublicClient, markPublicClient } from '@/lib/db-public';
import { createTestDb, resetDb, validClientInput, TEST_DATABASE_URL_VAR } from './helpers/test-db';

/**
 * THE PUBLIC GATEWAY'S DATABASE BOUNDARY (M20 Stage 10B).
 *
 * Every other request in RepOS carries a verified identity and is filtered by
 * Row Level Security. A customer holding a QR code carries nothing, so those
 * policies show them nothing — correctly, and including the one page they are
 * entitled to use. Rather than weaken a policy, the anonymous path goes
 * through two database functions that take the customer's token, resolve the
 * business from it themselves, and return one projection.
 *
 * The PRIVILEGE half of that claim — that the anonymous role can read no
 * table, enumerate no gateway, and reach no other function — is proven against
 * the real role in an isolated database, because asserting it needs a second
 * login and therefore a second password, and a password does not belong in
 * this repository.
 *
 * What is proven HERE is the half that drifts as the application changes: that
 * the anonymous path and the ordinary path behave identically. Same gateway
 * resolved, same refusals, same redaction, same duplicate rules, same row. If
 * someone later fixes a bug on one path and forgets the other, these fail.
 */

const SCHEMA = 'test_m20_public_boundary';

let db: PrismaClient;
/** The same database, reached the way an anonymous request reaches it. */
let publicDb: PrismaClient;

/**
 * Installs the two boundary functions, reading the very SQL that production
 * will run rather than a paraphrase of it — so a change to the real file is
 * exercised here instead of quietly diverging from what these tests assert.
 *
 * Only the function definitions are taken. The role and its grants are
 * deliberately skipped: this connection is the owner, and the subject here is
 * behaviour, not privilege.
 */
async function installBoundary(): Promise<void> {
  const file = readFileSync(
    join(resolve(__dirname, '..'), 'prisma', 'm20', 'public-gateway.sql'),
    'utf8',
  );

  const gateway = file.indexOf('CREATE OR REPLACE FUNCTION app.public_gateway');
  const drop = file.indexOf('DROP FUNCTION IF EXISTS app.public_submit');
  const submit = file.indexOf('CREATE OR REPLACE FUNCTION app.public_submit');
  expect(
    Math.min(gateway, drop, submit),
    'public-gateway.sql no longer contains the expected statements',
  ).toBeGreaterThan(0);

  // Cut on the statements' own anchors rather than splitting on semicolons:
  // a dollar-quoted function body is full of semicolons that end nothing.
  const cut = (from: number, terminator: string) => {
    const at = file.indexOf(terminator, from);
    expect(at, `expected ${terminator} after offset ${from}`).toBeGreaterThan(from);
    return file.slice(from, at + terminator.length - 1);
  };

  const statements = [
    cut(gateway, '$$;'),
    cut(drop, ');'),
    cut(submit, 'END $$;'),
  ].map((statement) =>
    statement
      // The suite gives every test file its own schema; production has one
      // named "public". Both function bodies fully qualify their tables, so
      // pointing them at this schema is a substitution, not a rewrite.
      .replace(/\bpublic\.("[A-Za-z]+")/g, `"${SCHEMA}".$1`)
      .replace(/SET search_path = pg_catalog, public/g, `SET search_path = pg_catalog, "${SCHEMA}"`),
  );

  await db.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS app');
  for (const statement of statements) await db.$executeRawUnsafe(statement);
}

async function makeGateway(name = 'Sunrise Clinic'): Promise<{ clientId: string; token: string }> {
  const created = await createClient(db, validClientInput({ businessName: name }));
  if (!created.ok) throw new Error('setup failed to create a client');
  const clientId = created.data.id;
  await ensureGateway(db, clientId);
  const row = await db.feedbackGateway.findFirstOrThrow({ where: { clientId } });
  return { clientId, token: row.publicToken };
}

beforeAll(async () => {
  db = createTestDb('m20-public-boundary');
  await installBoundary();
  publicDb = markPublicClient(
    new PrismaClient({
      datasources: { db: { url: `${process.env[TEST_DATABASE_URL_VAR]}?schema=${SCHEMA}` } },
    }),
  );
}, 180_000);

beforeEach(async () => {
  await resetDb(db);
  _resetGatewayThrottles();
});

afterAll(async () => {
  await db.$disconnect();
  await publicDb.$disconnect();
});

describe('which handle takes which path', () => {
  it('never treats the ordinary application client as anonymous', () => {
    // If this ever flipped, authenticated requests would start leaving the
    // path their policies protect.
    expect(isPublicClient(db)).toBe(false);
    expect(isPublicClient(publicDb)).toBe(true);
  });
});

describe('resolving a token', () => {
  it('answers identically on both paths', async () => {
    const { clientId, token } = await makeGateway();

    const viaApp = await resolvePublicGateway(db, token);
    const viaPublic = await resolvePublicGateway(publicDb, token);

    expect(viaPublic).toEqual(viaApp);
    expect(viaPublic?.clientId).toBe(clientId);
    expect(viaPublic?.businessName).toBe('Sunrise Clinic');
  });

  it('returns nothing for an unknown, paused or archived gateway, on both paths', async () => {
    const { clientId, token } = await makeGateway();

    for (const bogus of ['', 'not-a-token', `${token}x`, token.slice(0, -1)]) {
      expect(await resolvePublicGateway(publicDb, bogus), bogus).toBeNull();
    }

    await db.feedbackGateway.update({ where: { clientId }, data: { enabled: false } });
    expect(await resolvePublicGateway(publicDb, token)).toBeNull();
    expect(await resolvePublicGateway(db, token)).toBeNull();

    await db.feedbackGateway.update({ where: { clientId }, data: { enabled: true } });
    await db.client.update({ where: { id: clientId }, data: { archivedAt: new Date() } });
    expect(await resolvePublicGateway(publicDb, token)).toBeNull();
    expect(await resolvePublicGateway(db, token)).toBeNull();
  });

  it('never resolves one business through another business token', async () => {
    const a = await makeGateway('Alpha Cafe');
    const b = await makeGateway('Beta Dental');

    expect((await resolvePublicGateway(publicDb, a.token))?.clientId).toBe(a.clientId);
    expect((await resolvePublicGateway(publicDb, b.token))?.clientId).toBe(b.clientId);
    expect((await resolvePublicGateway(publicDb, a.token))?.businessName).toBe('Alpha Cafe');
  });
});

describe('storing a submission', () => {
  const NOW = new Date('2026-03-02T10:00:00.000Z');

  it('writes the same row the ordinary path writes', async () => {
    const a = await makeGateway('Alpha Cafe');
    const b = await makeGateway('Beta Dental');

    const submission = { stars: 4, text: 'Warm staff, quick service.' };
    const viaPublic = await submitCustomerFeedback(publicDb, a.token, submission, { now: NOW });
    const viaApp = await submitCustomerFeedback(db, b.token, submission, { now: NOW });
    expect(viaPublic.ok).toBe(true);
    expect(viaApp.ok).toBe(true);

    const rowA = await db.reviewItem.findFirstOrThrow({ where: { clientId: a.clientId } });
    const rowB = await db.reviewItem.findFirstOrThrow({ where: { clientId: b.clientId } });

    // Everything except the identifiers and which business it belongs to.
    const shape = (r: typeof rowA) => ({
      text: r.text,
      stars: r.stars,
      source: r.source,
      fingerprint: r.fingerprint,
      dimensionsJson: r.dimensionsJson,
      signalsJson: r.signalsJson,
      redacted: r.redacted,
      redactionsJson: r.redactionsJson,
      sortIndex: r.sortIndex,
      createdAt: r.createdAt.toISOString(),
      reviewDate: r.reviewDate?.toISOString() ?? null,
    });
    expect(shape(rowA)).toEqual(shape(rowB));
    expect(rowA.createdAt.toISOString()).toBe(NOW.toISOString());
  });

  it('stores against the business the token belongs to and no other', async () => {
    const a = await makeGateway('Alpha Cafe');
    const b = await makeGateway('Beta Dental');

    await submitCustomerFeedback(
      publicDb,
      a.token,
      { stars: 5, text: 'Meant for Alpha.' },
      { now: NOW },
    );

    expect(await db.reviewItem.count({ where: { clientId: a.clientId } })).toBe(1);
    expect(await db.reviewItem.count({ where: { clientId: b.clientId } })).toBe(0);
  });

  it('writes nothing at all for a token that resolves to nothing', async () => {
    await makeGateway('Alpha Cafe');

    const refused = await submitCustomerFeedback(
      publicDb,
      'tok_nothing_here_at_all',
      { stars: 5, text: 'Nowhere to go.' },
      { now: NOW },
    );

    expect(refused.ok).toBe(false);
    expect(await db.reviewItem.count()).toBe(0);
  });

  it('redacts on the anonymous path exactly as everywhere else', async () => {
    const { clientId, token } = await makeGateway();

    await submitCustomerFeedback(
      publicDb,
      token,
      { stars: 2, text: 'Call me on 9876543210 or at someone@example.com' },
      { now: NOW },
    );

    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.redacted).toBe(true);
    expect(row.text).not.toContain('9876543210');
    expect(row.text).not.toContain('someone@example.com');
    // Redaction happens in the application, before the row leaves it — the
    // database function is never handed the customer's phone number at all.
    expect(JSON.parse(row.redactionsJson).length).toBeGreaterThan(0);
  });

  it('applies the same duplicate windows', async () => {
    const { clientId, token } = await makeGateway();
    const send = (at: Date, body: { stars: number | null; text: string }) =>
      submitCustomerFeedback(publicDb, token, body, { now: at });

    const first = await send(NOW, { stars: 5, text: 'Lovely place.' });
    const again = await send(new Date(NOW.getTime() + 60_000), { stars: 5, text: 'Lovely place.' });
    expect(first.ok && first.data.stored).toBe(true);
    expect(again.ok && again.data.stored).toBe(false);
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(1);

    // Far enough apart and it is two customers who both liked the place.
    const later = await send(new Date(NOW.getTime() + 40 * 60_000), {
      stars: 5,
      text: 'Lovely place.',
    });
    expect(later.ok && later.data.stored).toBe(true);
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(2);
  });

  it('keeps sortIndex per business, continuing from what is already there', async () => {
    const { clientId, token } = await makeGateway();

    await submitCustomerFeedback(publicDb, token, { stars: 5, text: 'First one.' }, { now: NOW });
    await submitCustomerFeedback(
      publicDb,
      token,
      { stars: 4, text: 'A different second one.' },
      { now: new Date(NOW.getTime() + 40 * 60_000) },
    );

    const rows = await db.reviewItem.findMany({
      where: { clientId },
      orderBy: { sortIndex: 'asc' },
      select: { sortIndex: true },
    });
    expect(rows.map((r) => r.sortIndex)).toEqual([0, 1]);
  });

  it('refuses an empty submission before it reaches the database', async () => {
    const { token } = await makeGateway();

    const nothing = await submitCustomerFeedback(
      publicDb,
      token,
      { stars: null, text: '   ' },
      { now: NOW },
    );

    expect(nothing.ok).toBe(false);
    expect(await db.reviewItem.count()).toBe(0);
  });
});

describe('the shape of the boundary itself', () => {
  it('offers the anonymous path no way to name a business', async () => {
    // The single most important property here: a submission is aimed by its
    // token and by nothing else, so there is no argument to tamper with.
    const args = await db.$queryRawUnsafe<{ arguments: string }[]>(
      `SELECT pg_get_function_arguments(p.oid) AS arguments
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'app' AND p.proname = 'public_submit'`,
    );

    expect(args).toHaveLength(1);
    expect(args[0]?.arguments).toBeTruthy();
    expect(args[0]?.arguments).not.toMatch(/client/i);
  });

  it('reads and writes through functions that fix their own search_path', async () => {
    // Without this, a SECURITY DEFINER function can be pointed at tables the
    // caller controls, which turns the boundary into an escalation.
    const rows = await db.$queryRawUnsafe<{ proname: string; proconfig: string[] | null }[]>(
      `SELECT p.proname, p.proconfig
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'app' AND p.proname LIKE 'public\\_%'`,
    );

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(
        row.proconfig?.some((c) => c.startsWith('search_path=')),
        `${row.proname} must pin its search_path`,
      ).toBe(true);
    }
  });
});
