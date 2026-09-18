import { describe, expect, it } from 'vitest';
import type { FeedbackRow } from '@/lib/feedback/service';
import { translatorFor } from '@/lib/i18n/translator';
import { MESSAGES } from '@/lib/i18n/strings';
import { clinic } from '@/lib/portal/test-fixtures';
import { reviewItemOf } from './pages';

/**
 * A TOPIC IS NAMED IN THE OWNER'S LANGUAGE, AND FILED UNDER THE SAME KEY.
 *
 * A reading stores each topic with its canonical key and the English label it
 * had at the time. Every surface that names a topic reads the pack dictionary
 * (`pack.<type>.<key>`) — the same one the intelligence uses — so the list,
 * the entry page and Home's latest rows say "प्रतीक्षा…" to a Hindi reader
 * while the key in the URL, the filter and the analytics never changes.
 */

const WAIT = { key: 'wait_time', label: 'Long waiting time', kind: 'ISSUE', sentiment: 'NEGATIVE', severity: 'high' } as const;

function row(): FeedbackRow {
  return {
    id: 'r1',
    clientId: 'c1',
    text: 'Waited an hour past my appointment.',
    preview: 'Waited an hour past my appointment.',
    stars: 2,
    reviewDate: new Date('2026-09-01T10:00:00Z'),
    source: 'REP_OS_QR',
    sourceLabel: 'Feedback card',
    redacted: false,
    redactions: [],
    analysed: true,
    state: 'ANALYSED',
    createdAt: new Date('2026-09-01T10:00:00Z'),
    sentiment: 'NEGATIVE',
    themes: [WAIT],
    confidence: 'HIGH',
    reasons: [],
    language: 'en',
    analysisError: null,
    responseClass: 'COMPLAINT',
    responseAction: 'REPLY_RECOMMENDED',
    priorityBand: 'HIGH',
    priorityRank: 10,
    priorityReasons: [],
    draftText: null,
    draftLanguage: null,
    draftSource: 'NONE',
    draftStatus: 'NONE',
    draftCurrent: false,
    draftNotes: [],
    draftError: null,
    handledAt: null,
    answers: [],
  } as unknown as FeedbackRow;
}

describe('topic names follow the owner, keys do not', () => {
  it('has the clinic topic in the dictionary in all three languages', () => {
    const entry = MESSAGES[`pack.${clinic.id}.${WAIT.key}` as keyof typeof MESSAGES];
    expect(entry).toBeTruthy();
  });

  for (const locale of ['hi', 'mr'] as const) {
    it(`names the topic in ${locale} and keeps its canonical key`, () => {
      const item = reviewItemOf(row(), translatorFor(locale), clinic.id);
      expect(item.topics).toHaveLength(1);
      expect(item.topics[0]!.key).toBe('wait_time');
      expect(item.topics[0]!.label).toMatch(/[ऀ-ॿ]/);
      expect(item.themes[0]).toBe(item.topics[0]!.label);
    });
  }

  it('keeps the English the pack gives it, in English', () => {
    const item = reviewItemOf(row(), translatorFor('en'), clinic.id);
    expect(item.topics[0]).toEqual({ key: 'wait_time', label: MESSAGES[`pack.${clinic.id}.wait_time` as keyof typeof MESSAGES].en });
  });

  it('falls back to the stored label, never the bare key, when no pack is known', () => {
    const item = reviewItemOf(row(), translatorFor('hi'));
    expect(item.topics[0]).toEqual({ key: 'wait_time', label: 'Long waiting time' });
  });
});
