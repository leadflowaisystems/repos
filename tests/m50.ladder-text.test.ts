import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { normalizeFeedback } from '@/lib/analysis/normalize';
import { createClient } from '@/lib/clients/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { triageClientFeedback } from '@/lib/feedback/replies';
import { _resetGatewayThrottles, ensureGateway, submitCustomerFeedback } from '@/lib/gateway/service';
import { getPackOrFallback } from '@/lib/packs';
import {
  getEvidenceIndex,
  getEvidenceState,
  getFeedbackEntry,
  getFreshFeed,
  getReviewsView,
} from '@/lib/portal/service';
import { quotesFor } from '@/lib/portal/evidence';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';
import { cycle, runLadder, type Response } from './eval/ladder-scenarios';

/**
 * M50 — WHAT CUSTOMERS WRITE, AT EVERY RUNG (Oct 2026).
 *
 * Two halves.
 *
 * FIRST, MEANING. The twelve sentences the evidence-ladder brief named, read by
 * the real reader: praise, complaint, mixed, a historical comparison, a third
 * party's fault, and wording too ambiguous to file. Each is then surfaced at
 * the rung its evidence reaches — one customer, an early signal, an emerging
 * pattern, a strong one — and never higher. A sentence the reader cannot file
 * safely still counts as a response and still moves the pulse; it just names
 * no topic, because a missed topic is preferred to a false one.
 *
 * SECOND, THE WORDS THEMSELVES. Multi-line, long, Unicode, Hindi, Marathi,
 * Hinglish, emoji, punctuation, numbers, times and a link go in through the
 * real feedback page and come out — stored, read, classified, and shown to the
 * owner on Feedback, on the entry's own page and on Home's latest list — with
 * every word intact. Analysis changes must never cost a customer's text.
 */

const pack = getPackOrFallback('restaurant');
const read = (text: string, stars: number | null) => normalizeFeedback({ text, stars, pack, ai: null });

type Kind = 'praise' | 'complaint' | 'mixed' | 'historical' | 'third-party' | 'ambiguous' | 'rating-led';

/** The brief's twelve, with what each is, and what the reader must make of it. */
const TWELVE: Array<{ text: string; stars: number | null; kind: Kind; praise: string[]; issues: string[] }> = [
  { text: 'Loved the coffee.', stars: 5, kind: 'praise', praise: ['drink_praise'], issues: [] },
  { text: 'Loved the coffee but service was slow.', stars: 4, kind: 'mixed', praise: ['drink_praise'], issues: ['service_speed'] },
  { text: 'Coffee was okay.', stars: 3, kind: 'ambiguous', praise: [], issues: [] },
  { text: 'Everything was great except the bill was wrong.', stars: 4, kind: 'mixed', praise: [], issues: ['billing_issue'] },
  { text: 'The rider was late.', stars: 2, kind: 'third-party', praise: [], issues: [] },
  { text: 'Staff was excellent.', stars: 5, kind: 'praise', praise: ['staff_warmth'], issues: [] },
  { text: 'Not bad.', stars: 4, kind: 'ambiguous', praise: [], issues: [] },
  { text: 'Could be better.', stars: 3, kind: 'ambiguous', praise: [], issues: [] },
  { text: 'Last time was much better.', stars: 3, kind: 'historical', praise: [], issues: [] },
  { text: 'Exactly as promised.', stars: 5, kind: 'rating-led', praise: [], issues: [] },
  { text: 'Honestly expected more.', stars: 2, kind: 'rating-led', praise: [], issues: [] },
  { text: 'Coffee was cold when it arrived.', stars: 2, kind: 'complaint', praise: [], issues: ['served_cold'] },
];

describe('each of the twelve is read for what it is', () => {
  for (const s of TWELVE) {
    it(`${s.kind}: “${s.text}”`, () => {
      const n = read(s.text, s.stars);
      expect(n.praiseTags.sort()).toEqual([...s.praise].sort());
      expect(n.issueTags.sort()).toEqual([...s.issues].sort());
      switch (s.kind) {
        case 'praise':
          expect(n.sentiment).toBe('POSITIVE');
          break;
        case 'complaint':
          expect(n.sentiment).toBe('NEGATIVE');
          break;
        case 'mixed':
          expect(n.sentiment).toBe('MIXED');
          break;
        case 'third-party':
          // The rider's lateness is set aside — never counted against the café.
          expect(n.reasons.join(' ')).toMatch(/someone other than the business/);
          expect(n.unclassified).toBe(true);
          break;
        case 'historical':
          // "Last time was much better" is not praise of now, and the reader
          // does not pretend to know what got worse: it files nothing.
          expect(n.praiseTags).toEqual([]);
          expect(n.unclassified).toBe(true);
          break;
        case 'ambiguous':
          expect(n.unclassified).toBe(true);
          expect(n.confidence).toBe('LOW');
          break;
        case 'rating-led':
          // Nothing specific in the words; the rating gives the tone.
          expect(n.unclassified).toBe(true);
          expect(n.sentiment).toBe(s.stars !== null && s.stars >= 4 ? 'POSITIVE' : 'NEGATIVE');
          break;
      }
    });
  }
});

describe('each surfaces at the rung its evidence reaches, and no higher', () => {
  it('alone, every one is one customer heard — a topic, when there is one, is only an observation', () => {
    for (const s of TWELVE) {
      const r = runLadder([{ text: s.text, stars: s.stars }]);
      expect(r.state.stage).toBe('PULSE');
      expect(r.state.firstResponse?.length, s.text).toBeGreaterThan(1);
      for (const f of r.state.findings) expect(f.level, s.text).toBe('OBSERVATION');
      if (s.praise.length + s.issues.length === 0) {
        expect(r.state.findings, s.text).toEqual([]);
        expect(r.state.firstResponse?.join(' '), s.text).toMatch(/Nothing specific named|Rating only, no words/);
      }
    }
  });

  it('all twelve together: the coffee praised twice is an early signal; everything else was said once', () => {
    const r = runLadder(TWELVE.map((s) => ({ text: s.text, stars: s.stars })));
    expect(r.state.stage).toBe('EMERGING_PICTURE');
    const levels = Object.fromEntries(r.state.findings.map((f) => [f.key, [f.mentions, f.level]]));
    expect(levels).toEqual({
      drink_praise: [2, 'EARLY_SIGNAL'],
      staff_warmth: [1, 'OBSERVATION'],
      service_speed: [1, 'OBSERVATION'],
      billing_issue: [1, 'OBSERVATION'],
      served_cold: [1, 'OBSERVATION'],
    });
    // Ten or more read, nothing repeated three times: said plainly.
    expect(r.state.patterns).toEqual([]);
    expect(r.state.copy.nothingRepeated).toMatch(/nothing has repeated enough yet to call a recurring problem/);
    // The unfiled ones still count: twelve responses, twelve in the pulse.
    expect(r.state.read).toBe(12);
    expect(r.state.pulse.counted).toBe(12);
  });

  it('three times over: the coffee is a strong pattern, slow service an emerging one — each with its rung’s action', () => {
    const r = runLadder(cycle(TWELVE.map((s) => ({ text: s.text, stars: s.stars })), 36, 'k'));
    const by = (key: string) => r.state.findings.find((f) => f.key === key)!;
    expect(by('drink_praise')).toMatchObject({ mentions: 6, level: 'STRONG_PATTERN' });
    expect(by('drink_praise').action?.level).toBe('KEEP');
    expect(by('service_speed')).toMatchObject({ mentions: 3, level: 'EMERGING_PATTERN' });
    expect(by('service_speed').action?.level).toBe('CHECK');
    expect(by('served_cold')).toMatchObject({ mentions: 3, level: 'EMERGING_PATTERN' });
    // The rider was late three times: still never counted against the café.
    expect(r.state.findings.some((f) => f.kind === 'ISSUE' && /deliver/i.test(f.key))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The words themselves, through the real feedback page
// ---------------------------------------------------------------------------

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('m50-ladder-text');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
  _resetGatewayThrottles();
});

afterAll(async () => {
  await db?.$disconnect();
});

const NOW = new Date('2026-10-01T12:00:00.000Z');

/** As typed. None carries a phone, an email or an address — redaction is m49's subject. */
const WORDS: Array<[string, Response]> = [
  ['several lines', { text: 'Good:\n- the coffee\n- the music\n\nCould be better:\n- the wait', stars: 4 }],
  ['a long answer', { text: `${'The cold coffee was lovely and the staff were warm and welcoming. '.repeat(18).trim()}`, stars: 5 }],
  ['Unicode punctuation', { text: 'Worth ₹450? No!!! (Maybe, if it were hot…) — “meh”; 50% off: ok/not ok & more.', stars: 3 }],
  ['Hindi', { text: 'खाना बहुत स्वादिष्ट था, लेकिन सर्विस बहुत धीमी थी।', stars: 3 }],
  ['Marathi', { text: 'जेवण खूप छान होतं. सेवा खूप हळू होती!', stars: 3 }],
  ['Hinglish', { text: 'Khana bahut accha tha but service bahut slow thi yaar, 40 min lage', stars: 3 }],
  ['emoji', { text: 'Coffee was amazing ☕😍👍🏽 will come again!!', stars: 5 }],
  ['numbers and times', { text: 'Reached at 7.30 pm, food came at 8.15 pm — 45 minutes for 2 dosas.', stars: 2 }],
  ['a link', { text: 'The menu on https://example.com/menu says paneer, but there was none.', stars: 2 }],
];

describe('every customer’s words survive the whole journey', () => {
  it('saved, read, classified and shown to the owner — word for word', async () => {
    const created = await createClient(db, validClientInput({ businessName: 'Words Cafe (test)', vertical: 'restaurant' }));
    if (!created.ok) throw new Error(created.message);
    const id = created.data.id;
    const token = (await ensureGateway(db, id))!.publicToken;
    for (const [i, [label, r]] of WORDS.entries()) {
      const sent = await submitCustomerFeedback(db, token, { stars: r.stars, text: r.text }, { now: new Date(NOW.getTime() - (WORDS.length - i) * 600_000) });
      expect(sent.ok && sent.data.stored, label).toBe(true);
    }
    const analysed = await analyseClientFeedback(db, id, { useAi: false, now: NOW });
    if (!analysed.ok) throw new Error('analysis failed');
    await triageClientFeedback(db, id, { now: NOW });

    // SAVED, exactly as typed, and READ by the current reader.
    const stored = await db.reviewItem.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, text: true, analysisStatus: true, redacted: true },
    });
    expect(stored.map((s) => s.text)).toEqual(WORDS.map(([, r]) => r.text));
    expect(stored.every((s) => s.analysisStatus === 'ANALYSED')).toBe(true);
    expect(stored.every((s) => !s.redacted)).toBe(true);

    // SHOWN on Feedback, word for word.
    const reviews = await getReviewsView(db, id, { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null }, { now: NOW });
    const shown = new Map(reviews!.items.map((item) => [item.id, item.text]));
    for (const s of stored) expect(shown.get(s.id), s.text.slice(0, 30)).toBe(s.text);

    // On the entry's own page, word for word.
    for (const s of stored) {
      const entry = await getFeedbackEntry(db, id, s.id);
      expect(entry?.text).toBe(s.text);
    }

    // On Home's latest list: the same words on one line.
    const fresh = await getFreshFeed(db, id, { now: NOW });
    for (const entry of fresh!.latest) {
      const original = stored.find((s) => s.id === entry.id)!;
      expect(entry.text).toBe(original.text.replace(/\s+/g, ' ').trim());
    }

    // CLASSIFIED and ATTRIBUTED: the Hindi, Marathi and Hinglish complaints
    // about slow service, and the 45-minute wait written in numbers, are one
    // topic, counted once per response.
    const state = await getEvidenceState(db, id, { now: NOW });
    const slow = state!.findings.find((f) => f.key === 'service_speed');
    expect(slow?.mentions).toBe(4);
    expect(slow?.level).toBe('EARLY_SIGNAL'); // 4 of 9: under ten read, never a pattern
    const taste = state!.findings.find((f) => f.key === 'food_taste');
    expect(taste?.mentions).toBeGreaterThanOrEqual(3);

    // QUOTED in the customer's own words when a topic is shown with evidence.
    const index = await getEvidenceIndex(db, id);
    for (const q of quotesFor(index, 'service_speed', { limit: 3 })) {
      const original = stored.find((s) => s.id === q.id)!;
      expect(q.text).toBe(original.text.replace(/\s+/g, ' ').trim());
    }
  });
});
