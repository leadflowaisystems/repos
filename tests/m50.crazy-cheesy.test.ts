import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { triageClientFeedback } from '@/lib/feedback/replies';
import { _resetGatewayThrottles, ensureGateway, submitCustomerFeedback } from '@/lib/gateway/service';
import {
  getAnalysisView,
  getEvidenceState,
  getImprovementsView,
  getReviewsView,
} from '@/lib/portal/service';
import { getResponsibility } from '@/lib/responsibility/service';
import { buildBrief } from '@/lib/portal/brief';
import { translatorFor } from '@/lib/i18n/translator';
import type { EvidenceState } from '@/lib/portal/ladder';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';
import { CRAZY_CHEESY, runLadder } from './eval/ladder-scenarios';

/**
 * M50 — THE CRAZY CHEESY FIRST READ (Oct 2026).
 *
 * The screenshots that started the evidence-ladder pass: a café with five
 * responses, four of them rated (averaging 4.8), four happy, one mixed, none
 * unhappy, and nothing raised often enough to be a pattern. Home's main
 * message was "No strong pattern yet"; Trends said "Trends aren't ready yet"
 * with "Responses waiting for your first check-in: 5". The owner was left
 * feeling that Headway was waiting for more reviews before doing anything.
 *
 * This fixture holds that exact state and requires a useful first read
 * instead: what customers are saying now, what stands out, what is only an
 * early signal, what Headway is watching, and why stronger conclusions are not
 * being made yet — on every surface, from the same evidence state, with no
 * empty-feeling headline and no check-in for the owner to understand.
 */

const OLD_EMPTY = /no strong pattern yet|trends aren.t ready|waiting for your first check-in|first check-in now|insights are still building|more responses? to go/i;

function everything(s: EvidenceState): string {
  return JSON.stringify(s);
}

function expectFirstRead(s: EvidenceState) {
  // ---- the counts, with honest denominators --------------------------------
  expect(s.read).toBe(5);
  expect(s.stage).toBe('FIRST_READ');
  expect(s.pulse).toMatchObject({ happy: 4, mixed: 1, unhappy: 0, counted: 5, rated: 4, average: 4.8 });
  expect(s.pulse.basis).toBe('Of 5 responses read');
  expect(s.pulse.ratings).toBe('4 star ratings · 4.8★ average');

  // ---- a first read, said as one --------------------------------------------
  expect(s.copy.eyebrow).toBe('First read');
  expect(s.copy.title).toBe('Your first customer read is ready');
  expect(s.copy.intro).toBe('Headway has read 5 responses. Here’s what customers are telling you so far.');

  // ---- what stands out: the plain truth of how they felt ----------------------
  expect(s.standsOut).toMatchObject({
    kind: 'MOOD',
    title: 'Most customers are happy.',
    tone: 'good',
  });
  // The counts sit beside it, said once each, with their denominators.
  expect(s.copy.countLine).toBe('5 responses');
  expect(s.pulse.from).toBe('4.8★ from 4 ratings');

  // ---- what customers seem to like: the coffee twice, said as twice --------
  const coffee = s.likes.find((f) => f.key === 'drink_praise');
  expect(coffee).toMatchObject({ mentions: 2, level: 'EARLY_SIGNAL', levelLabel: 'Early signal' });
  expect(coffee?.line).toBe('2 of 5 customers');
  expect(coffee?.line).not.toMatch(/consistently|always|everyone/i);
  expect(s.likes.map((f) => [f.key, f.level])).toEqual([
    ['drink_praise', 'EARLY_SIGNAL'],
    ['food_taste', 'OBSERVATION'],
    ['staff_warmth', 'OBSERVATION'],
  ]);

  // ---- worth watching: slow service, once, and only watched -------------------
  expect(s.watching.map((f) => f.key)).toEqual(['service_speed']);
  const slow = s.watching[0]!;
  expect(slow).toMatchObject({ mentions: 1, level: 'OBSERVATION', levelLabel: 'Mentioned once' });
  expect(slow.line).toBe('1 of 5 customers');
  // Watched, so nothing is asked of the owner: "Mentioned once" says it.
  expect(slow.action).toBeNull();

  // ---- nothing is a pattern, and the page says why ---------------------------
  expect(s.patterns).toEqual([]);
  expect(s.copy.notSure).toBe(
    'Whether any of this is a recurring pattern. Headway names a pattern only when several customers raise the same thing across enough feedback.',
  );
  expect(s.copy.clearer).toBe('With more responses, Headway can confirm these early signals or drop them.');
  expect(s.copy.doing).toEqual([
    'Headway reads every response as it arrives.',
    'It keeps one-off comments separate from repeated patterns, so it doesn’t overreact to a small sample.',
  ]);

  // ---- direction: what Headway is doing by itself, no check-in ---------------
  expect(s.direction.state).toBe('BUILDING_BASELINE');
  expect(s.direction.title).toBe('Not enough history yet');
  expect(s.direction.body).toBe(
    'Headway needs two comparable sets of feedback before it can show what is improving, worsening or staying about the same.',
  );
  expect(s.direction.automatic).toBe('Headway keeps collecting feedback automatically.');

  // ---- how sure, in one line --------------------------------------------------
  expect(s.copy.note).toBe('Still early — nothing is a pattern yet.');

  // ---- and none of the old empty-feeling messages, anywhere in it -------------
  expect(everything(s)).not.toMatch(OLD_EMPTY);
}

describe('the Crazy Cheesy first read, built from the five responses', () => {
  const r = runLadder(CRAZY_CHEESY);

  it('reads each response for what it says', () => {
    expect(r.readings.map((n) => n.sentiment)).toEqual(['POSITIVE', 'POSITIVE', 'POSITIVE', 'POSITIVE', 'MIXED']);
    expect(r.readings[4]?.issueTags).toEqual(['service_speed']);
    expect(r.readings[4]?.praiseTags).toEqual(['drink_praise']);
  });

  it('is a useful first read, not "No strong pattern yet"', () => {
    expectFirstRead(r.state);
  });

  it('leads Home with no problem, and with no conclusion it has not earned', () => {
    expect(r.brief.attention).toBeNull();
    expect(r.brief.thin).toBe(true);
    // The band reads "First read · 5 responses read", not "Nothing needs your
    // attention" — a verdict ten responses would be needed for.
    expect(`${r.state.copy.eyebrow} · ${r.state.copy.readLine}`).toBe('First read · 5 responses read');
  });

  it('gives Trends the current picture and the direction’s readiness, never "waiting for your first check-in"', () => {
    expect(r.improvements.trends.comparable).toBe(false);
    expect(r.improvements.trendReadiness.state).toBe('NO_CHECKIN');
    expect(r.state.direction.state).toBe('BUILDING_BASELINE');
    expect(r.responsibility.nextUsefulCheck).toBe(
      'Headway has started recording where things stand, to compare against later. When there is enough comparable feedback, it will show which way things are moving.',
    );
    expect(r.responsibility.nextUsefulCheck).not.toMatch(OLD_EMPTY);
  });

  it('says the same thing in Hindi and Marathi, with the same numbers', () => {
    for (const locale of ['hi', 'mr'] as const) {
      const local = runLadder(CRAZY_CHEESY, { t: translatorFor(locale) });
      expect(local.state.pulse).toMatchObject({ happy: 4, mixed: 1, unhappy: 0, rated: 4, average: 4.8 });
      expect(local.state.likes.map((f) => [f.key, f.mentions, f.level])).toEqual(
        r.state.likes.map((f) => [f.key, f.mentions, f.level]),
      );
      expect(local.state.copy.title).toMatch(/[ऀ-ॿ]/);
      expect(local.state.pulse.ratings).toContain('4.8');
    }
  });
});

// ---------------------------------------------------------------------------
// The same five responses through the real customer flow and database.
// ---------------------------------------------------------------------------

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('m50-crazy-cheesy');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
  _resetGatewayThrottles();
});

afterAll(async () => {
  await db?.$disconnect();
});

const NOW = new Date('2026-10-01T12:00:00.000Z');

async function crazyCheesy(): Promise<string> {
  const created = await createClient(db, validClientInput({ businessName: 'Crazy Cheesy (test)', vertical: 'restaurant' }));
  if (!created.ok) throw new Error(created.message);
  const id = created.data.id;
  const token = (await ensureGateway(db, id))!.publicToken;
  for (const [i, r] of CRAZY_CHEESY.entries()) {
    const sent = await submitCustomerFeedback(db, token, { stars: r.stars, text: r.text }, { now: new Date(NOW.getTime() - (5 - i) * 600_000) });
    if (!sent.ok) throw new Error(sent.message);
    expect(sent.data.stored).toBe(true);
  }
  const read = await analyseClientFeedback(db, id, { useAi: false, now: NOW });
  if (!read.ok) throw new Error('analysis failed');
  await triageClientFeedback(db, id, { now: NOW });
  return id;
}

describe('the Crazy Cheesy first read, through the real feedback page and database', () => {
  it('every surface reads the same first read', async () => {
    const id = await crazyCheesy();
    const state = await getEvidenceState(db, id, { now: NOW });
    expect(state).not.toBeNull();
    expectFirstRead(state!);

    // Feedback: the five, the same pulse, every topic with its rung.
    const reviews = await getReviewsView(db, id, { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null }, { now: NOW });
    expect(reviews?.total).toBe(5);
    expect(reviews?.analysed).toBe(5);
    expect(reviews?.withRating).toBe(4);
    // The patterns-only rows the page used to show are empty at five — which
    // is why the page now draws its rows from the evidence state instead.
    expect(reviews?.signals).toEqual([]);

    // Customers: nothing named yet, so the board holds nothing above
    // "not yet clear", and every topic is listed from the evidence state.
    const analysis = await getAnalysisView(db, id, { now: NOW });
    expect(analysis?.unhappy).toEqual([]);
    expect(analysis?.loved).toEqual([]);

    // Trends: no comparison, and the reason is the direction state's.
    const improvements = await getImprovementsView(db, id, { now: NOW });
    expect(improvements?.trends.comparable).toBe(false);
    expect(improvements?.trendReadiness.checkins).toBe(0);

    // Home: no problem led with; the responsibility layer asks for nothing.
    const bundle = await getResponsibility(db, id, { now: NOW });
    expect(bundle?.responsibility.needsYou).toEqual([]);
    expect(bundle?.responsibility.nextUsefulCheck).not.toMatch(OLD_EMPTY);
  });

  it('keeps every customer’s words exactly as they wrote them', async () => {
    const id = await crazyCheesy();
    const rows = await db.reviewItem.findMany({ where: { clientId: id }, orderBy: { createdAt: 'asc' }, select: { text: true, stars: true } });
    expect(rows.map((r) => r.text)).toEqual(CRAZY_CHEESY.map((r) => r.text));
    expect(rows.map((r) => r.stars)).toEqual(CRAZY_CHEESY.map((r) => r.stars));
  });

  it('builds a brief whose story card is empty and whose reading is the first read', async () => {
    const id = await crazyCheesy();
    const bundle = await getResponsibility(db, id, { now: NOW });
    const state = await getEvidenceState(db, id, { now: NOW });
    const brief = buildBrief({
      view: bundle!.view,
      responsibility: bundle!.responsibility,
      evidence: { total: 5, byTheme: new Map() },
      coverage: {
        total: 5,
        analysed: 5,
        needsAnalysis: 0,
        failed: 0,
        processing: 0,
        outOfDate: 0,
        sentimentCounts: { POSITIVE: 4, MIXED: 1, NEGATIVE: 0, NEUTRAL: 0, UNKNOWN: 0 },
        upToDate: true,
      },
      basePath: '/workspace/x',
      now: NOW,
    });
    expect(brief.attention).toBeNull();
    expect(brief.mix).toEqual({ happy: 4, mixed: 1, unhappy: 0, read: 5 });
    expect(state?.copy.title).toBe('Your first customer read is ready');
  });
});
