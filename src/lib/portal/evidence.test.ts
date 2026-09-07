import { describe, expect, it } from 'vitest';
import { buildEvidenceIndex, quotableCount, quotesFor } from './evidence';

/**
 * THE EVIDENCE BEHIND A NUMBER (M24).
 *
 * Three customers in their own words under a figure, chosen the same way
 * every time: newest first, one door at a time, readable over long, and
 * never a row with no words.
 */

function row(
  id: string,
  text: string,
  at: string,
  source: 'REP_OS_QR' | 'PUBLIC_REVIEW' = 'PUBLIC_REVIEW',
  themes: string[] = ['wait_time'],
  stars: number | null = 2,
) {
  return {
    id,
    text,
    stars,
    reviewDate: new Date(at),
    createdAt: new Date(at),
    source,
    themesJson: JSON.stringify(themes.map((key) => ({ key, label: key, kind: 'ISSUE', sentiment: 'NEGATIVE', severity: 'high' }))),
  };
}

const ROWS = [
  row('a', 'Waited over an hour past my appointment time and nobody said why.', '2026-05-01'),
  row('b', 'Forty minutes past the slot again. Same as last month.', '2026-05-08'),
  row('c', 'The wait was long but the doctor was worth it.', '2026-05-15', 'REP_OS_QR'),
  row('d', 'Slow.', '2026-05-20', 'REP_OS_QR'),
  row('e', '', '2026-05-22', 'REP_OS_QR', ['wait_time'], 2),
  row('f', 'An hour in the waiting room with a toddler is not what I booked for, and the desk could not say how long it would be, and nobody offered water or an apology, which after the third visit like this is the part that actually made me write something down.', '2026-05-25', 'PUBLIC_REVIEW'),
  row('g', 'Lovely doctor, explained everything.', '2026-05-26', 'PUBLIC_REVIEW', ['doctor_care'], 5),
];

describe('the evidence index', () => {
  it('indexes only rows with words and a theme, newest first', () => {
    const index = buildEvidenceIndex(ROWS);
    expect(index.total).toBe(7);
    const wait = index.byTheme.get('wait_time') ?? [];
    // e has no words; g is another theme.
    expect(wait.map((r) => r.id)).toEqual(['f', 'd', 'c', 'b', 'a']);
    expect(index.byTheme.get('doctor_care')?.map((r) => r.id)).toEqual(['g']);
  });

  it('picks three quotes: newest first, both doors represented, fragments and essays last', () => {
    const quotes = quotesFor(buildEvidenceIndex(ROWS), 'wait_time');
    expect(quotes).toHaveLength(3);
    // "Slow." is too short to quote; the essay is skipped while readable rows remain.
    expect(quotes.map((q) => q.id)).toEqual(['c', 'b', 'a']);
    expect(quotes.map((q) => q.source)).toContain('REP_OS_QR');
    expect(quotes.map((q) => q.source)).toContain('PUBLIC_REVIEW');
    expect(quotes[0]?.sourceLabel).toBe('Feedback QR');
    expect(quotes[1]?.sourceLabel).toBe('Public review');
    // Newest first, whatever door they came through.
    const times = quotes.map((q) => q.at.getTime());
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });

  it('respects the before and after windows the measurement engine splits on', () => {
    const index = buildEvidenceIndex(ROWS);
    const change = new Date('2026-05-10');
    expect(quotesFor(index, 'wait_time', { since: change }).map((q) => q.id)).toEqual(['f', 'c']);
    expect(quotesFor(index, 'wait_time', { until: change }).map((q) => q.id)).toEqual(['b', 'a']);
    expect(quotableCount(index, 'wait_time', { since: change })).toBe(3);
    expect(quotableCount(index, 'wait_time', { until: change })).toBe(2);
  });

  it('falls back to the essay rather than leaving a slot empty', () => {
    const index = buildEvidenceIndex(ROWS.filter((r) => ['a', 'f', 'd'].includes(r.id)));
    const quotes = quotesFor(index, 'wait_time');
    expect(quotes.map((q) => q.id)).toEqual(['f', 'a']);
  });

  it('never quotes a row with no words, and says nothing for an unknown theme', () => {
    const index = buildEvidenceIndex([row('x', '', '2026-05-01', 'REP_OS_QR')]);
    expect(quotesFor(index, 'wait_time')).toEqual([]);
    expect(quotesFor(index, 'nothing')).toEqual([]);
    expect(quotableCount(index, 'wait_time')).toBe(0);
  });

  it('survives a malformed themes column rather than taking a page down', () => {
    const index = buildEvidenceIndex([{ ...row('m', 'Waited ages for the desk.', '2026-05-01'), themesJson: '{not json' }]);
    expect(index.byTheme.size).toBe(0);
  });
});
