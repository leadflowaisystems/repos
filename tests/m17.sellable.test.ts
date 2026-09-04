import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createClient,
  ensurePortalToken,
  getClientSetup,
  listClientSetup,
  setPortalLinkSent,
} from '@/lib/clients/service';
import {
  getGatewayView,
  savePublicBaseUrl,
  setGatewayEnabled,
  submitCustomerFeedback,
} from '@/lib/gateway/service';
import { getKitView } from '@/lib/kit/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { draftClientReplies, getReplyCoverage } from '@/lib/feedback/replies';
import { loadIntelligence } from '@/lib/intelligence/service';
import {
  createActionFromInsight,
  decideAction,
  measureClientAction,
  moveAction,
} from '@/lib/improve/service';
import { getResponsibility } from '@/lib/responsibility/service';
import { getAnalysisView, getPortalView } from '@/lib/portal/service';
import { resolvePortalToken } from '@/lib/portal/access';
import { getClientHealth } from '@/lib/snapshots/service';
import { createSnapshot } from '@/lib/snapshots/service';
import { getBoard } from '@/lib/command/board';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/**
 * M17 — IS THIS SELLABLE, WITHOUT GOOGLE?
 *
 * RepOS is a Customer Feedback → Business Improvement System, not a
 * review-management product. Its promise is "know what your customers really
 * think, fix what matters, see whether it actually improved", and that promise
 * has to hold for a business with no public listing, no Google account and no
 * intention of getting either.
 *
 * These tests run that business end to end through the real services: create,
 * print, collect, read, triage, conclude, decide, do, measure, and show the
 * owner. Nothing here pastes a public review, because there are none.
 */

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('m17-sellable');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
  await savePublicBaseUrl(db, BASE);
});

afterAll(async () => {
  await db.$disconnect();
});

const BASE = 'https://repos.example.com';
const OFFLINE = { useAi: false } as const;

/** Days apart, so a check-in window has something to close over. */
const OPENED = new Date('2026-03-01T09:00:00.000Z');
const FIRST_CHECKIN = new Date('2026-04-01T09:00:00.000Z');
const CHANGE_MADE = new Date('2026-04-05T09:00:00.000Z');
const SECOND_CHECKIN = new Date('2026-06-01T09:00:00.000Z');

async function newBusiness(name: string, vertical = 'restaurant') {
  const created = await createClient(
    db,
    validClientInput({ businessName: name, vertical }),
  );
  if (!created.ok) throw new Error(created.message);
  return created.data.id;
}

/** A customer scans the card and says something. No name, no contact, nothing. */
async function scan(
  token: string,
  stars: number,
  text: string,
  at: Date,
): Promise<void> {
  const result = await submitCustomerFeedback(
    db,
    token,
    { stars, text, nonce: `${text}-${at.getTime()}` },
    { now: at },
  );
  if (!result.ok) throw new Error(`submission refused: ${result.message}`);
}

const SLOW = [
  'Food was good but we waited nearly forty minutes for it to arrive.',
  'Long wait for the order. The staff were apologetic but it took ages.',
  'Waited over half an hour on a weekday evening, which felt too long.',
  'Lovely food, but the wait between ordering and eating was very long.',
  'The delay getting our food was the only bad part of the evening.',
  'We waited a really long time for the mains to come out.',
];
const GOOD = [
  'The staff were warm and looked after us really well.',
  'Friendly service throughout, they could not have been kinder.',
  'Staff were lovely and made our evening, genuinely welcoming.',
  'Really friendly team, they checked on us without hovering.',
];

// ---------------------------------------------------------------------------

describe('a business with no public listing can be set up and start collecting', () => {
  it('has a working front door from the moment it is created', async () => {
    const id = await newBusiness('Corner Cafe');
    const gateway = await getGatewayView(db, id, { requestOrigin: null });

    // No tab has been opened, no button pressed.
    expect(gateway?.enabled).toBe(true);
    expect(gateway?.feedbackUrl.startsWith(`${BASE}/feedback/`)).toBe(true);
  });

  it('can print its cards without any public review link', async () => {
    const id = await newBusiness('Corner Cafe');
    const kit = await getKitView(db, id);

    expect(kit?.readiness.ready).toBe(true);
    expect(kit?.content.publicReviewUrl).toBeNull();
    expect(kit?.qr.ok).toBe(true);
    if (kit?.qr.ok) expect(kit.qr.url).toContain('/feedback/');
  });

  it('knows what is still outstanding, and stops saying it once done', async () => {
    const id = await newBusiness('Corner Cafe');

    let setup = await getClientSetup(db, id);
    expect(setup.gatewayLive).toBe(true);
    expect(setup.remaining).toEqual([
      'Print the cards and get them on site',
      'Send the owner their link',
    ]);

    await db.client.update({ where: { id }, data: { kitInstalledDate: OPENED } });
    await setPortalLinkSent(db, id, true, OPENED);

    setup = await getClientSetup(db, id);
    expect(setup.remaining).toEqual([]);
    expect(setup.complete).toBe(true);
  });

  it('accepts anonymous feedback and stores nothing about the person', async () => {
    const id = await newBusiness('Corner Cafe');
    const gateway = await getGatewayView(db, id, { requestOrigin: null });
    await scan(gateway!.token, 2, SLOW[0]!, OPENED);

    const row = await db.reviewItem.findFirst({ where: { clientId: id } });
    expect(row).not.toBeNull();
    expect(row?.source).toBe('REP_OS_QR');
    // Every column that exists, and not one of them is a person.
    expect(Object.keys(row!).join(' ')).not.toMatch(/name|phone|email|ip|device/i);
  });

  it('stores nothing at all while the feedback page is paused', async () => {
    const id = await newBusiness('Corner Cafe');
    const gateway = await getGatewayView(db, id, { requestOrigin: null });
    await setGatewayEnabled(db, id, false);

    const refused = await submitCustomerFeedback(
      db,
      gateway!.token,
      { stars: 5, text: 'Everything was lovely.' },
      { now: OPENED },
    );
    expect(refused.ok).toBe(false);
    expect(await db.reviewItem.count({ where: { clientId: id } })).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('the whole loop, on private feedback alone', () => {
  it('runs from a scanned card to a measured result and back to the owner', async () => {
    const id = await newBusiness('Corner Cafe');
    const gateway = await getGatewayView(db, id, { requestOrigin: null });
    const token = gateway!.token;

    // --- 1. Customers scan the card and say things -----------------------
    for (const [i, text] of SLOW.entries()) {
      await scan(token, 2, text, new Date(OPENED.getTime() + i * 3_600_000));
    }
    for (const [i, text] of GOOD.entries()) {
      await scan(token, 5, text, new Date(OPENED.getTime() + (10 + i) * 3_600_000));
    }

    // --- 2. RepOS reads them ---------------------------------------------
    const read = await analyseClientFeedback(db, id, OFFLINE);
    expect(read.ok).toBe(true);

    // --- 3. It groups them into what keeps coming up ----------------------
    const { intelligence } = await loadIntelligence(
      db,
      { id, businessName: 'Corner Cafe', vertical: 'restaurant' },
      FIRST_CHECKIN,
    );
    const complaint = intelligence.unhappy[0];
    expect(complaint, 'a recurring complaint was found from QR feedback alone').toBeDefined();
    expect(complaint!.evidence.count).toBeGreaterThanOrEqual(3);
    expect(intelligence.loved.length).toBeGreaterThan(0);

    // --- 4. It says what to do about it -----------------------------------
    expect(complaint!.recommendation).toBeTruthy();

    // --- 5. A first check-in, with no public figures at all ---------------
    const first = await createSnapshot(
      db,
      id,
      {
        label: 'First check-in',
        capturedAt: FIRST_CHECKIN,
        rating: null,
        reviewCount: null,
        unansweredCount: null,
        daysSinceLastPost: null,
        photoRecencyDays: null,
        reviewsPerWeek: null,
        profileGaps: [],
        observationNotes: '',
        reviewsRaw: '',
      },
      OFFLINE,
    );
    expect(first.ok, 'a check-in with no public figures is allowed').toBe(true);

    // The health engine can now judge this business from private feedback.
    const health = await getClientHealth(db, id, 'restaurant', FIRST_CHECKIN);
    expect(health.card.status).not.toBe('INSUFFICIENT_DATA');

    // --- 6. The owner decides, and the decision is recorded ---------------
    const action = await createActionFromInsight(db, id, complaint!.id, {
      now: FIRST_CHECKIN,
    });
    expect(action.ok).toBe(true);
    if (!action.ok) return;

    const decided = await decideAction(
      db,
      id,
      action.data.id,
      {
        decision: 'ACCEPT',
        description: 'One person watches the pass and calls out any table waiting too long.',
        statusNote: '',
        recordMinute: true,
      },
      { now: FIRST_CHECKIN },
    );
    expect(decided.ok).toBe(true);

    // --- 7. The change is made --------------------------------------------
    const done = await moveAction(
      db,
      id,
      action.data.id,
      { to: 'DONE', note: 'In place from this week.', occurredAt: CHANGE_MADE },
      { now: CHANGE_MADE },
    );
    expect(done.ok).toBe(true);

    // --- 8. More customers scan the card, and the complaint fades ---------
    const after = new Date(CHANGE_MADE.getTime() + 86_400_000);
    for (let i = 0; i < 12; i += 1) {
      await scan(token, 5, `${GOOD[i % GOOD.length]} Visit ${i}.`, new Date(after.getTime() + i * 3_600_000));
    }
    await scan(token, 3, SLOW[0]!, new Date(after.getTime() + 20 * 3_600_000));
    await analyseClientFeedback(db, id, OFFLINE);

    // --- 9. RepOS compares before and after -------------------------------
    const measured = await measureClientAction(db, id, action.data.id, {
      now: SECOND_CHECKIN,
    });
    expect(measured.ok, 'the change could be measured from QR feedback alone').toBe(true);
    if (!measured.ok) return;
    expect(measured.data.measurement.before.total).toBeGreaterThan(0);
    expect(measured.data.measurement.after.total).toBeGreaterThan(0);
    expect(measured.data.measurement.headline.length).toBeGreaterThan(0);

    // --- 10. And the owner is shown all of it ------------------------------
    const portalToken = await ensurePortalToken(db, id);
    const client = await resolvePortalToken(db, portalToken!);
    expect(client?.id).toBe(id);

    const bundle = await getPortalView(db, id, { now: SECOND_CHECKIN });
    expect(bundle).not.toBeNull();
    // What RepOS did, in words, is the thing they are paying for.
    expect(bundle!.view.work.join(' ')).toMatch(/Read \d+ pieces of feedback/);
    expect(bundle!.view.work.join(' ')).toMatch(/Grouped them into/);

    const analysis = await getAnalysisView(db, id, { now: SECOND_CHECKIN });
    expect(analysis!.work.length).toBeGreaterThan(0);

    const responsibility = await getResponsibility(db, id, { now: SECOND_CHECKIN });
    expect(responsibility).not.toBeNull();
    expect(responsibility!.responsibility.answer.length).toBeGreaterThan(0);
  }, 120_000);
});

// ---------------------------------------------------------------------------

describe('the owner is never shown that something is missing because of Google', () => {
  it('says nothing about Google, listings or reviews the business does not have', async () => {
    const id = await newBusiness('Corner Cafe');
    const gateway = await getGatewayView(db, id, { requestOrigin: null });
    for (const [i, text] of [...SLOW, ...GOOD].entries()) {
      await scan(gateway!.token, i < SLOW.length ? 2 : 5, text, new Date(OPENED.getTime() + i * 3_600_000));
    }
    await analyseClientFeedback(db, id, OFFLINE);

    const bundle = await getPortalView(db, id, { now: FIRST_CHECKIN });
    const analysis = await getAnalysisView(db, id, { now: FIRST_CHECKIN });
    const everything = JSON.stringify({ view: bundle?.view, analysis });

    for (const word of ['Google', 'google', 'listing', 'star rating', 'public review']) {
      expect(everything, `"${word}" reached the owner`).not.toContain(word);
    }
  }, 60_000);

  it('offers a conclusion rather than an apology once there is evidence', async () => {
    const id = await newBusiness('Corner Cafe');
    const gateway = await getGatewayView(db, id, { requestOrigin: null });
    for (const [i, text] of [...SLOW, ...GOOD].entries()) {
      await scan(gateway!.token, i < SLOW.length ? 2 : 5, text, new Date(OPENED.getTime() + i * 3_600_000));
    }
    await analyseClientFeedback(db, id, OFFLINE);

    const bundle = await getResponsibility(db, id, { now: FIRST_CHECKIN });
    expect(bundle).not.toBeNull();
    // Something to act on, named, with the evidence behind it.
    expect(bundle!.responsibility.needsYou.length).toBeGreaterThan(0);
    expect(bundle!.responsibility.needsYou[0]?.evidence?.count).toBeGreaterThanOrEqual(3);
  }, 60_000);
});

// ---------------------------------------------------------------------------

describe('several businesses at once', () => {
  it('keeps every client’s feedback, address and link entirely its own', async () => {
    const cafe = await newBusiness('Corner Cafe', 'restaurant');
    const salon = await newBusiness('Glow Salon', 'salon');
    const clinic = await newBusiness('Sunrise Clinic', 'clinic');

    const tokens = await Promise.all(
      [cafe, salon, clinic].map(async (id) => (await getGatewayView(db, id, { requestOrigin: null }))!.token),
    );
    expect(new Set(tokens).size).toBe(3);

    await scan(tokens[0]!, 2, SLOW[0]!, OPENED);
    await scan(tokens[1]!, 5, GOOD[0]!, OPENED);

    expect(await db.reviewItem.count({ where: { clientId: cafe } })).toBe(1);
    expect(await db.reviewItem.count({ where: { clientId: salon } })).toBe(1);
    expect(await db.reviewItem.count({ where: { clientId: clinic } })).toBe(0);

    // A token only ever opens its own business.
    for (const [i, id] of [cafe, salon, clinic].entries()) {
      const portal = await ensurePortalToken(db, id);
      expect((await resolvePortalToken(db, portal!))?.id).toBe(id);
      expect(tokens[i]).not.toBe(portal);
    }
  }, 60_000);

  it('answers “who needs me today?” without opening a single client', async () => {
    const ready = await newBusiness('Ready Cafe', 'restaurant');
    const paused = await newBusiness('Paused Salon', 'salon');
    await newBusiness('Fresh Clinic', 'clinic');

    await db.client.update({
      where: { id: ready },
      data: { kitInstalledDate: OPENED, portalLinkSentAt: OPENED },
    });
    await setGatewayEnabled(db, paused, false);

    const board = await getBoard(db, SECOND_CHECKIN);
    const byName = new Map(board.cards.map((c) => [c.businessName, c]));

    // Switched off: the operator is told, and told what to do about it.
    expect(byName.get('Paused Salon')?.nextAction.key).toBe('RESUME_FEEDBACK');
    expect(byName.get('Paused Salon')?.reasons.join(' ')).toMatch(/paused/i);

    // Never set up: get the cards out.
    expect(byName.get('Fresh Clinic')?.nextAction.key).toBe('PRINT_CARDS');

    // Set up and quiet: nothing about printing or sending.
    expect(byName.get('Ready Cafe')?.nextAction.key).toBe('ADD_FEEDBACK');
  }, 60_000);

  it('reads every client’s setup in one go', async () => {
    const ids = await Promise.all(
      ['A Cafe', 'B Salon', 'C Clinic'].map((n) => newBusiness(n, 'restaurant')),
    );
    const map = await listClientSetup(db, ids);

    expect(map.size).toBe(3);
    for (const id of ids) expect(map.get(id)?.gatewayLive).toBe(true);
  });

  it('does not let a prospect outrank a business being served', async () => {
    const paying = await newBusiness('Paying Cafe', 'restaurant');
    const prospect = await newBusiness('Maybe Cafe', 'restaurant');
    await db.client.update({ where: { id: paying }, data: { status: 'ACTIVE' } });
    await db.client.update({ where: { id: prospect }, data: { status: 'PROSPECT' } });

    const board = await getBoard(db, SECOND_CHECKIN);
    const byName = new Map(board.cards.map((c) => [c.businessName, c]));

    expect(byName.get('Maybe Cafe')?.band).not.toBe('NOW');
  }, 60_000);
});

// ---------------------------------------------------------------------------

describe('the operator can finish with a piece of feedback', () => {
  it('lets an item nobody can reply to be closed off', async () => {
    const id = await newBusiness('Corner Cafe');
    const gateway = await getGatewayView(db, id, { requestOrigin: null });
    await scan(gateway!.token, 1, 'I was sick after eating here and want my money back.', OPENED);
    await analyseClientFeedback(db, id, OFFLINE);
    await draftClientReplies(db, id, OFFLINE);

    const item = await db.reviewItem.findFirstOrThrow({ where: { clientId: id } });
    const before = await getReplyCoverage(db, id);

    await db.reviewItem.update({ where: { id: item.id }, data: { handledAt: OPENED } });
    const after = await getReplyCoverage(db, id);

    // Anonymous QR feedback has nobody to write to, so the only way it can
    // ever stop asking is the operator saying they dealt with it.
    expect(after.replyOutstanding + after.youOutstanding).toBe(
      before.replyOutstanding + before.youOutstanding - 1,
    );
  }, 60_000);
});
