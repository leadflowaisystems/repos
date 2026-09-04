import { describe, expect, it } from 'vitest';
import { getPackOrFallback, _resetPackCache } from '@/lib/packs';
import type { StoredFeedback, StoredSnapshot } from '@/lib/health/health';
import { presenceFrom, recurrenceFor } from './history';

_resetPackCache();
const clinic = getPackOrFallback('clinic');

function fb(issue: string | null, praise: string | null = null): StoredFeedback {
  return {
    sentiment: issue ? 'NEGATIVE' : 'POSITIVE',
    issueTags: issue ? [issue] : [],
    praiseTags: praise ? [praise] : [],
    stars: issue ? 1 : 5,
    reviewDate: null,
  };
}

function snap(id: string, label: string, day: number, feedback: StoredFeedback[]): StoredSnapshot {
  return {
    id,
    label,
    capturedAt: new Date(2026, 0, day),
    rating: 4.4,
    reviewCount: 100,
    unansweredCount: 0,
    reviewsPerWeek: 1,
    daysSinceLastPost: 1,
    photoRecencyDays: 1,
    generatedAt: null,
    feedback,
  };
}

const waits = (n: number) => Array.from({ length: n }, () => fb('wait_time'));
const care = (n: number) => Array.from({ length: n }, () => fb(null, 'doctor_care'));

describe('what keeps coming back', () => {
  it('says nothing with fewer than two readable check-ins', () => {
    const one = presenceFrom([snap('a', 'Jan', 1, [...waits(5), ...care(3)])], clinic);
    expect(one.checkins).toBe(1);
    expect(recurrenceFor(one, 'ISSUE', 'wait_time').line).toBeNull();
  });

  it('calls a theme recurring only when it cleared the floor at two or more check-ins', () => {
    const two = presenceFrom(
      [
        snap('b', 'Feb', 20, [...waits(4), ...care(3)]),
        snap('a', 'Jan', 1, [...waits(5), ...care(3)]),
      ],
      clinic,
    );
    const wait = recurrenceFor(two, 'ISSUE', 'wait_time');
    expect(wait.recurring).toBe(true);
    expect(wait.line).toBe('Raised at 2 of your last 2 check-ins.');
    const praise = recurrenceFor(two, 'PRAISE', 'doctor_care');
    expect(praise.line).toBe('Praised at 2 of your last 2 check-ins.');
  });

  it('calls a theme new only when it was absent from every earlier check-in', () => {
    const two = presenceFrom(
      [
        snap('b', 'Feb', 20, [...waits(4), ...care(3)]),
        snap('a', 'Jan', 1, [...care(3), fb('cleanliness')]),
      ],
      clinic,
    );
    const wait = recurrenceFor(two, 'ISSUE', 'wait_time');
    expect(wait.isNew).toBe(true);
    expect(wait.recurring).toBe(false);
    expect(wait.line).toMatch(/latest check-in only/);
  });

  it('does not count a check-in with too little feedback to read', () => {
    const map = presenceFrom(
      [
        snap('c', 'Mar', 40, [...waits(4)]),
        snap('b', 'Feb', 20, [fb('wait_time')]), // one item: unreadable
        snap('a', 'Jan', 1, [...waits(3)]),
      ],
      clinic,
    );
    expect(map.checkins).toBe(2);
    expect(map.skipped).toBe(1);
    expect(recurrenceFor(map, 'ISSUE', 'wait_time').line).toBe('Raised at 2 of your last 2 check-ins.');
  });

  it('reports a theme that faded from the latest check-in without calling it a trend', () => {
    const two = presenceFrom(
      [snap('b', 'Feb', 20, [...care(4)]), snap('a', 'Jan', 1, [...waits(4)])],
      clinic,
    );
    const wait = recurrenceFor(two, 'ISSUE', 'wait_time');
    expect(wait.faded).toBe(true);
    expect(wait.line).toMatch(/not at your latest/);
  });

  it('never invents presence for a theme below the floor', () => {
    const two = presenceFrom(
      [snap('b', 'Feb', 20, [...waits(2), ...care(3)]), snap('a', 'Jan', 1, [...waits(2), ...care(3)])],
      clinic,
    );
    expect(recurrenceFor(two, 'ISSUE', 'wait_time').line).toBeNull();
  });
});
