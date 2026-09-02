import { describe, expect, it } from 'vitest';
import type { HealthStatus } from '@/lib/health/rules';
import {
  BAND_LABELS,
  BAND_NOW,
  BAND_SOON,
  FOLLOW_UP_NUDGE_DAYS,
  PRIORITY_VERSION,
  STALE_SNAPSHOT_DAYS,
  bandFor,
  compareForBoard,
  nextActionFor,
  prioritise,
  prioritySignals,
  type NextActionKey,
  type PriorityInput,
} from './priority';

const NOW = new Date('2026-03-16T00:00:00.000Z');

function input(overrides: Partial<PriorityInput> = {}): PriorityInput {
  return {
    clientId: 'c1',
    businessName: 'Sunrise Dental Clinic',
    status: 'HEALTHY' as HealthStatus,
    topSignalDetail: null,
    trendDeclining: false,
    topIssue: null,
    feedback: {
      total: 40,
      unread: 0,
      needsYou: 0,
      awaitingDraft: 0,
      draftsReady: 0,
    },
    actions: { awaitingDecision: 0, readyToMeasure: 0 },
    lastFollowUpAt: null,
    daysSinceLastSnapshot: 10,
    snapshotCount: 2,
    lastActivityAt: new Date('2026-03-14T00:00:00.000Z'),
    ownerUpdateReady: false,
    now: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('who needs the operator first', () => {
  it('puts a client on Attention above a healthy one', () => {
    const attention = prioritise(
      input({ status: 'ATTENTION', topSignalDetail: 'Negative feedback is 40%.' }),
    );
    const healthy = prioritise(input());
    expect(attention.rank).toBeGreaterThan(healthy.rank);
    expect(attention.band).toBe('NOW');
  });

  it('puts a serious recurring complaint above a mild one', () => {
    const severe = prioritise(
      input({ topIssue: { label: 'Long waiting time', count: 9, severe: true } }),
    );
    const mild = prioritise(
      input({ topIssue: { label: 'Parking / access', count: 4, severe: false } }),
    );
    expect(severe.rank).toBeGreaterThan(mild.rank);
  });

  it('counts a review only the operator can answer as urgent', () => {
    const result = prioritise(input({ feedback: { ...input().feedback, needsYou: 2 } }));
    expect(result.signals.map((s) => s.key)).toContain('needs_you');
    expect(result.reasons.join(' ')).toContain('your own words');
  });

  it('counts a declining trend', () => {
    const declining = prioritise(input({ trendDeclining: true }));
    expect(declining.signals.map((s) => s.key)).toContain('declining');
    expect(declining.rank).toBeGreaterThan(prioritise(input()).rank);
  });

  it('counts a reply backlog and unread feedback separately', () => {
    const result = prioritise(
      input({ feedback: { ...input().feedback, unread: 5, awaitingDraft: 3 } }),
    );
    const keys = result.signals.map((s) => s.key);
    expect(keys).toContain('unread_feedback');
    expect(keys).toContain('reply_backlog');
  });

  it('nudges about a follow-up only once it has aged', () => {
    const fresh = prioritise(
      input({ lastFollowUpAt: new Date('2026-03-14T00:00:00.000Z') }),
    );
    const old = prioritise(
      input({ lastFollowUpAt: new Date('2026-01-01T00:00:00.000Z') }),
    );
    expect(fresh.signals.map((s) => s.key)).not.toContain('follow_up_noted');
    expect(old.signals.map((s) => s.key)).toContain('follow_up_noted');
    expect(FOLLOW_UP_NUDGE_DAYS).toBe(14);
  });

  it('never calls a noted follow-up an outstanding task', () => {
    // Minutes record what happened. Nothing in RepOS tracks whether a
    // follow-up was closed, so the wording must not imply that it does.
    const result = prioritise(
      input({ lastFollowUpAt: new Date('2026-01-01T00:00:00.000Z') }),
    );
    const reason = result.reasons.find((r) => r.includes('follow-up'));
    expect(reason).toBeDefined();
    expect(reason).toMatch(/noted/i);
    expect(reason).not.toMatch(/overdue|outstanding|incomplete|unresolved|task/i);
  });

  it('mentions a stale snapshot', () => {
    const result = prioritise(input({ daysSinceLastSnapshot: STALE_SNAPSHOT_DAYS + 5 }));
    expect(result.signals.map((s) => s.key)).toContain('stale_snapshot');
  });

  it('mentions a client with no feedback at all', () => {
    const result = prioritise(
      input({ feedback: { ...input().feedback, total: 0 }, snapshotCount: 0 }),
    );
    expect(result.signals.map((s) => s.key)).toContain('no_feedback');
  });

  it('leaves a quiet, healthy client at the bottom', () => {
    const result = prioritise(input());
    expect(result.rank).toBe(0);
    expect(result.band).toBe('NOTHING');
    expect(result.reasons).toEqual([]);
    // Nothing fired at all, not merely a zero total.
    expect(prioritySignals(input())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('the ordering explains itself', () => {
  it('gives every point a sentence the operator can read', () => {
    const result = prioritise(
      input({
        status: 'ATTENTION',
        topSignalDetail: 'Negative feedback is 40% of 30 reviews.',
        topIssue: { label: 'Long waiting time', count: 9, severe: true },
        feedback: { total: 40, unread: 4, needsYou: 1, awaitingDraft: 2, draftsReady: 0 },
      }),
    );

    expect(result.signals.length).toBeGreaterThan(3);
    expect(result.reasons.length).toBe(result.signals.length);
    for (const signal of result.signals) {
      expect(signal.reason.length).toBeGreaterThan(0);
      expect(signal.weight).toBeGreaterThan(0);
    }
    // The rank is the sum of the named signals and nothing else.
    expect(result.rank).toBe(result.signals.reduce((sum, s) => sum + s.weight, 0));
  });

  it('lists the heaviest reason first', () => {
    const result = prioritise(
      input({
        status: 'ATTENTION',
        topSignalDetail: 'Negative feedback is high.',
        feedback: { ...input().feedback, unread: 3 },
      }),
    );
    expect(result.reasons[0]).toBe('Negative feedback is high.');
  });

  it('uses no score, probability or model anywhere', () => {
    const serialised = JSON.stringify(prioritise(input({ status: 'ATTENTION' })));
    expect(serialised).not.toMatch(/probability|confidence_score|model|prediction/i);
  });

  it('reuses the health engine wording rather than inventing its own', () => {
    const detail = 'Negative feedback is 40% of 30 stored reviews.';
    const result = prioritise(input({ status: 'ATTENTION', topSignalDetail: detail }));
    expect(result.reasons).toContain(detail);
  });

  it('bands on fixed thresholds', () => {
    expect(bandFor(0)).toBe('NOTHING');
    expect(bandFor(BAND_SOON - 1)).toBe('WHEN_FREE');
    expect(bandFor(BAND_SOON)).toBe('SOON');
    expect(bandFor(BAND_NOW)).toBe('NOW');
    expect(BAND_LABELS.NOW).toMatch(/now/i);
  });

  it('is stable for the same input', () => {
    expect(prioritise(input({ status: 'WATCH' }))).toEqual(
      prioritise(input({ status: 'WATCH' })),
    );
    expect(prioritise(input()).version).toBe(PRIORITY_VERSION);
  });

  it('breaks a tie by name, so the order never shuffles between refreshes', () => {
    const rows = [
      { rank: 30, businessName: 'Zeta Salon' },
      { rank: 30, businessName: 'Alpha Clinic' },
      { rank: 50, businessName: 'Mid Cafe' },
    ];
    const sorted = [...rows].sort(compareForBoard);
    expect(sorted.map((r) => r.businessName)).toEqual([
      'Mid Cafe',
      'Alpha Clinic',
      'Zeta Salon',
    ]);
    // Shuffled input, identical output.
    const reshuffled = [rows[1]!, rows[2]!, rows[0]!].sort(compareForBoard);
    expect(reshuffled.map((r) => r.businessName)).toEqual(
      sorted.map((r) => r.businessName),
    );
  });
});

// ---------------------------------------------------------------------------

describe('the next action is always something RepOS can actually do', () => {
  const cases: Array<[string, Partial<PriorityInput>, NextActionKey, string]> = [
    [
      'no feedback at all',
      { feedback: { total: 0, unread: 0, needsYou: 0, awaitingDraft: 0, draftsReady: 0 } },
      'ADD_FEEDBACK',
      '/clients/c1/feedback',
    ],
    [
      'feedback waiting to be read',
      { feedback: { total: 10, unread: 4, needsYou: 0, awaitingDraft: 0, draftsReady: 0 } },
      'READ_FEEDBACK',
      '/clients/c1/feedback',
    ],
    [
      'reviews only the operator can answer',
      { feedback: { total: 10, unread: 0, needsYou: 2, awaitingDraft: 0, draftsReady: 0 } },
      'HANDLE_YOURSELF',
      '/clients/c1/feedback?action=NEEDS_HUMAN',
    ],
    [
      'replies with no draft yet',
      { feedback: { total: 10, unread: 0, needsYou: 0, awaitingDraft: 3, draftsReady: 0 } },
      'DRAFT_REPLIES',
      '/clients/c1/feedback',
    ],
    [
      'an owner update ready to send',
      { ownerUpdateReady: true },
      'PREPARE_OWNER_UPDATE',
      '/clients/c1#owner-update',
    ],
    [
      'drafts waiting to be checked',
      { feedback: { total: 10, unread: 0, needsYou: 0, awaitingDraft: 0, draftsReady: 4 } },
      'REVIEW_DRAFTS',
      '/clients/c1/feedback?draft=READY',
    ],
    [
      'no snapshot yet',
      { snapshotCount: 0, daysSinceLastSnapshot: null },
      'TAKE_SNAPSHOT',
      '/clients/c1/snapshots/new',
    ],
    [
      'a stale snapshot',
      { daysSinceLastSnapshot: STALE_SNAPSHOT_DAYS + 1 },
      'TAKE_SNAPSHOT',
      '/clients/c1/snapshots/new',
    ],
    ['nothing waiting', {}, 'NOTHING', '/clients/c1'],
  ];

  for (const [name, overrides, key, href] of cases) {
    it(`offers the right next step for ${name}`, () => {
      const action = nextActionFor(input(overrides));
      expect(action.key).toBe(key);
      expect(action.href).toBe(href);
      expect(action.label.length).toBeGreaterThan(0);
      expect(action.detail.length).toBeGreaterThan(0);
    });
  }

  it('reads unread feedback before anything else', () => {
    // Nothing downstream is trustworthy until the feedback has been read, so
    // this must win even when other work is also waiting.
    const action = nextActionFor(
      input({
        feedback: { total: 20, unread: 5, needsYou: 3, awaitingDraft: 4, draftsReady: 2 },
        ownerUpdateReady: true,
      }),
    );
    expect(action.key).toBe('READ_FEEDBACK');
  });

  it('never invents a workflow state RepOS does not record', () => {
    for (const [, overrides] of cases) {
      const action = nextActionFor(input(overrides));
      expect(`${action.label} ${action.detail}`).not.toMatch(
        /snooze|assign|in progress|schedule|remind|due date|mark complete/i,
      );
    }
  });

  it('only ever links inside RepOS', () => {
    for (const [, overrides] of cases) {
      const action = nextActionFor(input(overrides));
      expect(action.href.startsWith('/')).toBe(true);
      expect(action.href).not.toMatch(/^https?:|wa\.me|mailto:|tel:/);
    }
  });
});
