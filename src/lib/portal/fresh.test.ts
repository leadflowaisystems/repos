import { describe, expect, it } from 'vitest';
import type { LedgerRow } from '@/lib/feedback/ledger';
import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';
import { EN, translatorFor } from '@/lib/i18n/translator';
import { JUST_READ_MS, LATEST_ON_HOME, NEW_WINDOW_MS, buildFreshFeed, whenSaid } from './fresh';

/**
 * WHAT JUST ARRIVED, AND WHETHER HEADWAY HAS READ IT (freshness pass).
 *
 * The live line in Home's band and the "Latest from customers" rows are the
 * one place the workspace talks about time in minutes, so every sentence they
 * can produce is pinned to the stored state that allows it:
 *
 *   "is reading them"   only rows never read, and only while reading runs
 *   "waiting"           the same rows while the account is paused
 *   "just read"         only rows read in the last few minutes that ALSO
 *                       arrived in the last day — never an engine upgrade
 *   "2 min ago"         only where the time is a real arrival time
 */

const NOW = new Date('2026-09-18T12:00:00Z');
const MIN = 60_000;
const at = (msAgo: number) => new Date(NOW.getTime() - msAgo);

let n = 0;
function row(overrides: Partial<LedgerRow> = {}): LedgerRow {
  n += 1;
  const created = overrides.createdAt ?? at(3 * 86_400_000);
  return {
    id: `r${String(n).padStart(4, '0')}`,
    text: 'The food was lovely but we waited a long time.',
    stars: 3,
    reviewDate: created,
    createdAt: created,
    updatedAt: created,
    analysedAt: created,
    source: 'REP_OS_QR',
    snapshotId: null,
    sentiment: 'MIXED',
    issueTags: '[]',
    praiseTags: '[]',
    themesJson: JSON.stringify([
      { key: 'wait_time', label: 'Long waiting time', kind: 'ISSUE', sentiment: 'NEGATIVE', severity: 'high' },
    ]),
    dimensionsJson: '{}',
    signalsJson: '[]',
    analysisStatus: 'ANALYSED',
    analysisVersion: ANALYSIS_VERSION,
    triageVersion: 1,
    responseAction: 'NONE',
    draftStatus: 'NONE',
    draftVersion: 0,
    handledAt: null,
    redacted: false,
    ...overrides,
  };
}

/** A customer who has just submitted: stored, stamped, not read yet. */
const justSent = (msAgo: number, extra: Partial<LedgerRow> = {}) =>
  row({
    createdAt: at(msAgo),
    reviewDate: at(msAgo),
    updatedAt: at(msAgo),
    analysedAt: null,
    analysisStatus: 'PENDING',
    analysisVersion: 0,
    sentiment: 'UNCLASSIFIED',
    themesJson: '[]',
    ...extra,
  });

const history = () => [row(), row(), row()];

describe('the live line', () => {
  it('says new feedback is being read only while it genuinely has not been', () => {
    const feed = buildFreshFeed({
      ledger: [...history(), justSent(2 * MIN), justSent(1 * MIN, { analysisStatus: 'PROCESSING' })],
      now: NOW,
      readingPaused: false,
    });
    expect(feed.live).toEqual({ kind: 'READING', count: 2 });
  });

  it('says "waiting", not "reading", while the account is paused', () => {
    const feed = buildFreshFeed({ ledger: [...history(), justSent(2 * MIN)], now: NOW, readingPaused: true });
    expect(feed.live).toEqual({ kind: 'HELD', count: 1 });
  });

  it('does not count a failed reading as being read now', () => {
    const feed = buildFreshFeed({
      ledger: [...history(), justSent(2 * MIN, { analysisStatus: 'FAILED' })],
      now: NOW,
      readingPaused: false,
    });
    expect(feed.live).toBeNull();
    expect(feed.latest[0]!.state).toBe('FAILED');
  });

  it('says "just read" for what arrived today and was read in the last few minutes', () => {
    const feed = buildFreshFeed({
      ledger: [
        ...history(),
        row({ createdAt: at(4 * MIN), reviewDate: at(4 * MIN), analysedAt: at(3 * MIN) }),
        row({ createdAt: at(6 * MIN), reviewDate: at(6 * MIN), analysedAt: at(5 * MIN) }),
      ],
      now: NOW,
      readingPaused: false,
    });
    expect(feed.live).toEqual({ kind: 'JUST_READ', count: 2 });
  });

  it('stops saying "just" once the reading is older than the window', () => {
    const feed = buildFreshFeed({
      ledger: [row({ createdAt: at(40 * MIN), reviewDate: at(40 * MIN), analysedAt: at(JUST_READ_MS + MIN) })],
      now: NOW,
      readingPaused: false,
    });
    expect(feed.live).toBeNull();
  });

  it('never announces an engine upgrade re-reading old feedback as new', () => {
    // Read a minute ago, but it ARRIVED a week ago: that is a re-read.
    const feed = buildFreshFeed({
      ledger: [row({ createdAt: at(7 * 86_400_000), reviewDate: at(7 * 86_400_000), analysedAt: at(MIN) })],
      now: NOW,
      readingPaused: false,
    });
    expect(feed.live).toBeNull();
  });

  it('prefers "reading" when some are read and some are not, because that is what is happening', () => {
    const feed = buildFreshFeed({
      ledger: [row({ createdAt: at(4 * MIN), reviewDate: at(4 * MIN), analysedAt: at(3 * MIN) }), justSent(MIN)],
      now: NOW,
      readingPaused: false,
    });
    expect(feed.live).toEqual({ kind: 'READING', count: 1 });
  });

  it('says nothing on a quiet day', () => {
    expect(buildFreshFeed({ ledger: history(), now: NOW, readingPaused: false }).live).toBeNull();
    expect(buildFreshFeed({ ledger: [], now: NOW, readingPaused: false }).live).toBeNull();
  });

  it('never re-counts an older reading by an older engine as unread', () => {
    // Read before, now waiting for a newer engine: understood already, not "new".
    const feed = buildFreshFeed({
      ledger: [row({ analysisVersion: 0, analysisStatus: 'ANALYSED' })],
      now: NOW,
      readingPaused: false,
    });
    expect(feed.live).toBeNull();
    expect(feed.latest[0]!.state).toBe('READ');
  });
});

describe('latest from customers', () => {
  it('shows the newest three, newest first — read or not', () => {
    const ledger = [row(), justSent(10 * MIN), row({ createdAt: at(30 * MIN), reviewDate: at(30 * MIN) }), justSent(2 * MIN), row()];
    const feed = buildFreshFeed({ ledger, now: NOW, readingPaused: false });
    expect(feed.latest).toHaveLength(LATEST_ON_HOME);
    expect(feed.latest.map((e) => e.at.getTime())).toEqual([at(2 * MIN), at(10 * MIN), at(30 * MIN)].map((d) => d.getTime()));
    expect(feed.latest[0]!.state).toBe('NEW');
    expect(feed.total).toBe(5);
  });

  it('dates a pasted review by the customer, not by when it was pasted', () => {
    // Imported a minute ago, written in March: it is not the latest thing a customer said.
    const pasted = row({ source: 'PUBLIC_REVIEW', createdAt: at(MIN), reviewDate: new Date('2026-03-02T00:00:00Z') });
    const fresh = justSent(20 * MIN);
    const feed = buildFreshFeed({ ledger: [pasted, fresh], now: NOW, readingPaused: false });
    expect(feed.latest[0]!.id).toBe(fresh.id);
  });

  it('claims a time to the minute only for the feedback card, which stamps its submissions', () => {
    const feed = buildFreshFeed({
      ledger: [justSent(2 * MIN), row({ source: 'PUBLIC_REVIEW', reviewDate: at(5 * 86_400_000) }), row({ source: 'REP_OS_QR', reviewDate: null })],
      now: NOW,
      readingPaused: false,
    });
    const bySource = feed.latest.map((e) => [e.sourceLabel, e.exact]);
    expect(feed.latest[0]!.exact).toBe(true);
    expect(bySource.filter(([, exact]) => exact).length).toBe(1);
  });

  it('keeps a rating with no words, rather than hiding the customer who left it', () => {
    const feed = buildFreshFeed({ ledger: [justSent(MIN, { text: '   ', stars: 5 })], now: NOW, readingPaused: false });
    expect(feed.latest[0]).toMatchObject({ text: '', stars: 5 });
  });

  it('names topics only once Headway has read the entry, the way the page names them', () => {
    const feed = buildFreshFeed({
      ledger: [row({ createdAt: at(MIN), reviewDate: at(MIN) }), justSent(2 * MIN)],
      now: NOW,
      readingPaused: false,
      labelFor: (key) => (key === 'wait_time' ? 'Waiting time' : null),
    });
    expect(feed.latest[0]!.topics).toEqual([{ key: 'wait_time', label: 'Waiting time' }]);
    expect(feed.latest[1]!.topics).toEqual([]);
  });

  it('reads the ledger once, in one pass, however large it is', () => {
    const big = Array.from({ length: 10_000 }, (_, i) => row({ createdAt: at((i + 5) * MIN), reviewDate: at((i + 5) * MIN) }));
    const newest = justSent(MIN);
    const started = performance.now();
    const feed = buildFreshFeed({ ledger: [...big, newest], now: NOW, readingPaused: false });
    const took = performance.now() - started;
    expect(feed.latest[0]!.id).toBe(newest.id);
    expect(feed.total).toBe(10_001);
    // Generous: a linear scan of 10,000 rows is a few milliseconds.
    expect(took).toBeLessThan(500);
  });
});

describe('when a customer said it', () => {
  const format = (d: Date) => `on ${d.toISOString().slice(0, 10)}`;

  it('is relative only where the time is real and recent', () => {
    expect(whenSaid({ at: at(20_000), exact: true }, NOW, EN, format)).toBe('just now');
    expect(whenSaid({ at: at(12 * MIN), exact: true }, NOW, EN, format)).toBe('12 min ago');
    expect(whenSaid({ at: at(3 * 60 * MIN), exact: true }, NOW, EN, format)).toBe('3 hours ago');
    expect(whenSaid({ at: at(60 * MIN), exact: true }, NOW, EN, format)).toBe('1 hour ago');
    expect(whenSaid({ at: at(NEW_WINDOW_MS + MIN), exact: true }, NOW, EN, format)).toBe('on 2026-09-17');
  });

  it('gives a date, never a time, for anything not stamped on arrival', () => {
    expect(whenSaid({ at: at(5 * MIN), exact: false }, NOW, EN, format)).toBe('on 2026-09-18');
  });

  it('never says "in 2 minutes" for a clock that runs ahead', () => {
    expect(whenSaid({ at: new Date(NOW.getTime() + 2 * MIN), exact: true }, NOW, EN, format)).toBe('just now');
  });

  it('says it in Hindi and Marathi too', () => {
    for (const locale of ['hi', 'mr'] as const) {
      const t = translatorFor(locale);
      const said = whenSaid({ at: at(12 * MIN), exact: true }, NOW, t, format);
      expect(said).toMatch(/[ऀ-ॿ]/);
      expect(said).toContain('12');
    }
  });
});
