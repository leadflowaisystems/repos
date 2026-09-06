import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  convertToActive,
  describeAccount,
  extendTrial,
  getAccountState,
  getCommercial,
  isServicePaused,
  pauseService,
  requestPaymentDetails,
  resumeService,
  saveCommercial,
  setSubscription,
  startTrial,
  subscriptionState,
} from '@/lib/commercial/service';
import { isServiceSuspended } from '@/lib/pipeline/feedback';
import { createTestDb, resetDb } from './helpers/test-db';

/**
 * THE COMMERCIAL SIDE (M21).
 *
 * Three things are being asserted here and they are not the same thing.
 *
 * THE ARITHMETIC — that extending a trial extends it from where it stands, that
 * converting somebody clears a trial window that no longer means anything, and
 * that resuming a paused account puts it back in the state it was actually in
 * rather than silently converting them.
 *
 * THE PAUSE — that a paused business keeps collecting and stops being read.
 * That distinction is the whole feature: a customer at a table is not party to
 * a billing conversation and must never meet a dead page because of one.
 *
 * THE ABSENCE OF A PRICE — asserted against the source itself, because "we did
 * not put a number on the owner's page" is a claim about every owner-facing
 * file, not about one of them. The negotiated amount is separately unreachable
 * for an owner's connection; that is proved under real policies in
 * `m21.commercial-rls.test.ts`, which is where a claim about the database
 * belongs.
 */

let db: PrismaClient;
const NOW = new Date('2026-06-01T10:00:00.000Z');
const DAY = 86_400_000;

beforeAll(async () => {
  db = createTestDb('m21-commercial');
}, 180_000);

afterAll(async () => {
  await db?.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

async function makeClient(overrides: Record<string, unknown> = {}): Promise<string> {
  const client = await db.client.create({
    data: {
      businessName: 'Sunrise Cafe',
      vertical: 'cafe',
      status: 'ACTIVE',
      ...overrides,
    },
    select: { id: true },
  });
  return client.id;
}

// ---------------------------------------------------------------------------

describe('what state an account is in', () => {
  it('treats anything it does not recognise as a trial rather than as active', () => {
    expect(subscriptionState('ACTIVE')).toBe('ACTIVE');
    expect(subscriptionState('PAUSED')).toBe('PAUSED');
    expect(subscriptionState('')).toBe('TRIAL');
    expect(subscriptionState(null)).toBe('TRIAL');
    expect(subscriptionState('PLATINUM_PLUS')).toBe('TRIAL');
  });

  it('counts paused and closed as stopped, and nothing else', () => {
    expect(isServicePaused('PAUSED')).toBe(true);
    expect(isServicePaused('CANCELLED')).toBe(true);
    expect(isServicePaused('TRIAL')).toBe(false);
    expect(isServicePaused('ACTIVE')).toBe(false);
  });
});

describe('what the owner is told', () => {
  const base = {
    trialStartsAt: null,
    trialEndsAt: null,
    paymentRequestedAt: null,
    ownerName: 'A. Owner',
    ownerEmail: 'a@owner.test',
    ownerPhone: '9000000000',
    now: NOW,
  };

  it('says how many days are left, because that is a fact they need', () => {
    const state = describeAccount({
      ...base,
      subscriptionStatus: 'TRIAL',
      trialEndsAt: new Date(NOW.getTime() + 5 * DAY),
    });
    expect(state.trialDaysLeft).toBe(5);
    expect(state.trialExpired).toBe(false);
    expect(state.line).toContain('5 days');
  });

  it('does not pretend a trial with no end date is about to run out', () => {
    const state = describeAccount({ ...base, subscriptionStatus: 'TRIAL' });
    expect(state.trialDaysLeft).toBeNull();
    expect(state.trialExpired).toBe(false);
    expect(state.line).toContain('no end date');
  });

  it('tells an expired trial that everything it collected is still there', () => {
    const state = describeAccount({
      ...base,
      subscriptionStatus: 'TRIAL',
      trialEndsAt: new Date(NOW.getTime() - DAY),
    });
    expect(state.trialExpired).toBe(true);
    expect(state.line).toContain('still here');
  });

  it('explains a pause as "kept, not read" rather than as "stopped"', () => {
    const state = describeAccount({ ...base, subscriptionStatus: 'PAUSED' });
    expect(state.line).toContain('still being collected');
    expect(state.line).toContain('kept');
  });

  it('never puts a figure, a plan or a currency in the sentence', () => {
    for (const status of ['TRIAL', 'ACTIVE', 'PAUSED', 'CANCELLED']) {
      const state = describeAccount({
        ...base,
        subscriptionStatus: status,
        trialEndsAt: new Date(NOW.getTime() + 3 * DAY),
      });
      expect(state.line).not.toMatch(/₹|rs\.?\s*\d|\$|\bplan\b|\bpricing\b|\bper month\b/i);
    }
  });
});

describe('moving an account through its states', () => {
  it('starts a trial of the length asked for, from now', async () => {
    const id = await makeClient();
    const result = await startTrial(db, id, 14, { now: NOW });
    expect(result.ok).toBe(true);

    const state = await getAccountState(db, id, { now: NOW });
    expect(state?.state).toBe('TRIAL');
    expect(state?.trialStartsAt?.toISOString()).toBe(NOW.toISOString());
    expect(state?.trialDaysLeft).toBe(14);
  });

  it('refuses a trial length nobody meant to type', async () => {
    const id = await makeClient();
    for (const days of [0, -7, 400, Number.NaN]) {
      const result = await startTrial(db, id, days, { now: NOW });
      expect(result.ok, String(days)).toBe(false);
    }
  });

  it('extends from the existing end date, so extending twice adds twice', async () => {
    const id = await makeClient();
    await startTrial(db, id, 14, { now: NOW });

    await extendTrial(db, id, 7, { now: NOW });
    await extendTrial(db, id, 7, { now: NOW });

    const state = await getAccountState(db, id, { now: NOW });
    expect(state?.trialDaysLeft).toBe(28);
  });

  it('extends from today when the trial has already lapsed', async () => {
    const id = await makeClient({
      subscriptionStatus: 'TRIAL',
      trialStartsAt: new Date(NOW.getTime() - 40 * DAY),
      trialEndsAt: new Date(NOW.getTime() - 10 * DAY),
    });

    const result = await extendTrial(db, id, 7, { now: NOW });
    expect(result.ok).toBe(true);

    // Not "three days ago plus seven", which is what extending from the old end
    // date would have produced and is not an extension at all.
    const state = await getAccountState(db, id, { now: NOW });
    expect(state?.trialDaysLeft).toBe(7);
    expect(state?.trialExpired).toBe(false);
  });

  it('clears the trial window when they start paying', async () => {
    const id = await makeClient();
    await startTrial(db, id, 14, { now: NOW });
    await convertToActive(db, id, { now: NOW });

    const state = await getAccountState(db, id, { now: NOW });
    expect(state?.state).toBe('ACTIVE');
    expect(state?.trialEndsAt).toBeNull();
    // The start date survives: when the trial began is a fact about the
    // relationship, and it stays true after they convert.
    expect(state?.trialStartsAt).not.toBeNull();
  });

  it('leaves a date alone when it is not mentioned, and clears it when it is', async () => {
    const id = await makeClient();
    await startTrial(db, id, 14, { now: NOW });
    const before = await getAccountState(db, id, { now: NOW });

    await setSubscription(db, id, { status: 'PAUSED' }, { now: NOW });
    const after = await getAccountState(db, id, { now: NOW });
    expect(after?.trialEndsAt?.toISOString()).toBe(before?.trialEndsAt?.toISOString());

    await setSubscription(db, id, { trialEndsAt: null }, { now: NOW });
    expect((await getAccountState(db, id, { now: NOW }))?.trialEndsAt).toBeNull();
  });

  it('resumes into the state they were actually in, never silently converting them', async () => {
    const stillOnTrial = await makeClient();
    await startTrial(db, stillOnTrial, 14, { now: NOW });
    await pauseService(db, stillOnTrial, { now: NOW });
    const resumedTrial = await resumeService(db, stillOnTrial, { now: NOW });
    expect(resumedTrial.ok && resumedTrial.data.state).toBe('TRIAL');

    const lapsed = await makeClient({
      trialEndsAt: new Date(NOW.getTime() - DAY),
      subscriptionStatus: 'PAUSED',
    });
    const resumedActive = await resumeService(db, lapsed, { now: NOW });
    expect(resumedActive.ok && resumedActive.data.state).toBe('ACTIVE');
  });

  it('says so plainly when the business is gone', async () => {
    const result = await pauseService(db, 'clientthatneverexisted', { now: NOW });
    expect(result.ok).toBe(false);
  });
});

describe('pausing stops the reading and nothing else', () => {
  it('is what the pipeline asks before it reads anything', async () => {
    const id = await makeClient();
    expect(await isServiceSuspended(db, id)).toBe(false);

    await pauseService(db, id, { now: NOW });
    expect(await isServiceSuspended(db, id)).toBe(true);

    await resumeService(db, id, { now: NOW });
    expect(await isServiceSuspended(db, id)).toBe(false);
  });

  it('treats a closed account the same way, and an unknown one as not paused', async () => {
    const id = await makeClient({ subscriptionStatus: 'CANCELLED' });
    expect(await isServiceSuspended(db, id)).toBe(true);
    expect(await isServiceSuspended(db, 'clientthatneverexisted')).toBe(false);
  });

  it('keeps every collected row, its reading and its analysis exactly as it was', async () => {
    const id = await makeClient();
    const item = await db.reviewItem.create({
      data: {
        clientId: id,
        source: 'REP_OS_QR',
        stars: 2,
        text: 'The wait was long and nobody said anything.',
        analysisStatus: 'ANALYSED',
        analysisVersion: 99,
        sentiment: 'NEGATIVE',
      },
      select: { id: true, text: true, stars: true, analysisStatus: true, createdAt: true },
    });

    await pauseService(db, id, { now: NOW });
    await resumeService(db, id, { now: NOW });

    const after = await db.reviewItem.findUniqueOrThrow({
      where: { id: item.id },
      select: { id: true, text: true, stars: true, analysisStatus: true, createdAt: true },
    });
    expect(after).toEqual(item);
    expect(await db.reviewItem.count({ where: { clientId: id } })).toBe(1);
  });
});

describe('the owner asking what this costs', () => {
  it('records their own contact details and the fact that they asked', async () => {
    const id = await makeClient();
    const result = await requestPaymentDetails(
      db,
      id,
      { name: 'Priya Shah', email: ' Priya@Cafe.test ', phone: '+91 98765 43210' },
      { now: NOW },
    );
    expect(result.ok).toBe(true);

    const state = await getAccountState(db, id, { now: NOW });
    expect(state?.owner.name).toBe('Priya Shah');
    expect(state?.owner.email).toBe('priya@cafe.test');
    expect(state?.owner.phone).toBe('+91 98765 43210');
    expect(state?.paymentRequestedAt?.toISOString()).toBe(NOW.toISOString());
  });

  it('asks for the three things and refuses to guess at any of them', async () => {
    const id = await makeClient();
    const result = await requestPaymentDetails(db, id, { name: 'A', email: 'nope', phone: '12' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(['email', 'name', 'phone']);
    }
  });

  it('creates no amount, no invoice and no commercial row of its own', async () => {
    const id = await makeClient();
    await requestPaymentDetails(
      db,
      id,
      { name: 'Priya Shah', email: 'priya@cafe.test', phone: '9876543210' },
      { now: NOW },
    );
    expect(await db.commercial.count({ where: { clientId: id } })).toBe(0);
    const record = await getCommercial(db, id);
    expect(record.amountInr).toBeNull();
  });
});

describe("the operator's private record", () => {
  it('reads as empty until something is agreed', async () => {
    const id = await makeClient();
    const record = await getCommercial(db, id);
    expect(record).toEqual({
      amountInr: null,
      cadence: 'MONTHLY',
      note: '',
      paymentInstructions: '',
      instructionsSentAt: null,
      paidAt: null,
    });
  });

  it('stores what was agreed, and stamps sent and paid only when asked to', async () => {
    const id = await makeClient();
    await saveCommercial(
      db,
      id,
      {
        amountInr: 4500,
        cadence: 'MONTHLY',
        note: 'Agreed on the call, starts next month.',
        paymentInstructions: 'UPI: sunrise@bank',
      },
      { now: NOW },
    );

    let record = await getCommercial(db, id);
    expect(record.amountInr).toBe(4500);
    expect(record.instructionsSentAt).toBeNull();
    expect(record.paidAt).toBeNull();

    await saveCommercial(
      db,
      id,
      {
        amountInr: 4500,
        cadence: 'MONTHLY',
        note: 'Agreed on the call, starts next month.',
        paymentInstructions: 'UPI: sunrise@bank',
        markSent: true,
      },
      { now: NOW },
    );
    record = await getCommercial(db, id);
    expect(record.instructionsSentAt?.toISOString()).toBe(NOW.toISOString());
    expect(record.paidAt).toBeNull();
  });

  it('refuses an amount that is not whole rupees, and allows none at all', async () => {
    const id = await makeClient();
    const bad = await saveCommercial(db, id, {
      amountInr: -10,
      cadence: 'MONTHLY',
      note: '',
      paymentInstructions: '',
    });
    expect(bad.ok).toBe(false);

    const blank = await saveCommercial(db, id, {
      amountInr: null,
      cadence: 'MONTHLY',
      note: '',
      paymentInstructions: '',
    });
    expect(blank.ok).toBe(true);
  });

  it('falls back to a known cadence rather than storing whatever a form said', async () => {
    const id = await makeClient();
    await saveCommercial(db, id, {
      amountInr: 100,
      cadence: 'EVERY_FORTNIGHT',
      note: '',
      paymentInstructions: '',
    });
    expect((await getCommercial(db, id)).cadence).toBe('MONTHLY');
  });
});

// ---------------------------------------------------------------------------
// What is NOT there
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, '..');
const CODE = new Set(['.ts', '.tsx']);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (CODE.has(extname(entry)) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

const OWNER_FACING = sourceFiles(join(ROOT, 'src')).filter((file) => {
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
  return (
    rel.startsWith('src/app/(workspace)/') ||
    rel.startsWith('src/app/(portal)/') ||
    rel.startsWith('src/app/(feedback)/') ||
    rel.startsWith('src/components/workspace/') ||
    rel.startsWith('src/components/portal/') ||
    rel === 'src/components/forms/payment-request-form.tsx'
  );
});

/** Comments explaining why there is no price must not count as one. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

describe('there is no price anywhere a customer or an owner can see', () => {
  it('has owner-facing files to check', () => {
    expect(OWNER_FACING.length).toBeGreaterThan(10);
  });

  it('names no figure, no currency and no plan on any owner-facing screen', () => {
    // A rupee sign, a rupee amount, a dollar amount, or the vocabulary of a
    // price list. `formatRupees` is deliberately included: it exists for the
    // operator console, and an owner-facing file reaching for it would be the
    // first step towards a number on this side of the product.
    const PRICE =
      /₹|\brs\.?\s*\d|\$\d|\bper month\b|\bpricing\b|\bprice list\b|\bsubscribe\b|formatRupees/i;
    const offenders = OWNER_FACING.filter((file) =>
      PRICE.test(stripComments(readFileSync(file, 'utf8'))),
    ).map((f) => f.slice(ROOT.length + 1).replace(/\\/g, '/'));
    expect(offenders).toEqual([]);
  });

  it('reaches for no payment processor, in the dependencies or in the source', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => /razorpay|stripe|paypal|payu|cashfree|phonepe/i.test(d))).toEqual([]);

    const offenders = sourceFiles(join(ROOT, 'src'))
      .filter((file) =>
        /razorpay|stripe|checkout\.session|payment_intent/i.test(
          stripComments(readFileSync(file, 'utf8')),
        ),
      )
      .map((f) => f.slice(ROOT.length + 1).replace(/\\/g, '/'));
    expect(offenders).toEqual([]);
  });

  it('keeps the negotiated amount out of the owner-facing account page entirely', () => {
    const page = readFileSync(
      join(ROOT, 'src', 'app', '(workspace)', 'workspace', '[clientId]', 'account', 'page.tsx'),
      'utf8',
    );
    expect(page).not.toContain('getCommercial');
    expect(page).not.toContain('amountInr');
    expect(page).toContain('getAccountState');
  });
});

describe('the automatic pipeline asks before it reads', () => {
  it('checks the account state first, then whether there is anything waiting', () => {
    const trigger = readFileSync(join(ROOT, 'src', 'lib', 'pipeline', 'trigger.ts'), 'utf8');
    const suspendedAt = trigger.indexOf('await isServiceSuspended(db, clientId)');
    const processAt = trigger.indexOf('await processClientFeedback(db, clientId)');
    expect(suspendedAt).toBeGreaterThan(0);
    expect(processAt).toBeGreaterThan(suspendedAt);
  });

  it('leaves the operator pressing Read unaffected by a pause', () => {
    // Deliberate work by staff on one business is not the automatic pipeline,
    // and stopping it would leave nobody able to clear a backlog by hand.
    const analysis = readFileSync(join(ROOT, 'src', 'lib', 'actions', 'analysis.ts'), 'utf8');
    expect(analysis).not.toContain('isServiceSuspended');
  });
});
