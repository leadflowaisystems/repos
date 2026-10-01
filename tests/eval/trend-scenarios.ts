import { buildIntelligence, type ClientIntelligence } from '@/lib/intelligence/engine';
import { computeHealthCard, computePulse, type StoredFeedback, type StoredSnapshot } from '@/lib/health/health';
import type { ThemeSummary, ThemeSummaryRow } from '@/lib/feedback/analysis';
import { EMPTY_CONTEXT } from '@/lib/context/apply';
import { getPackOrFallback } from '@/lib/packs';
import { buildImprovementsView } from '@/lib/portal/pages';
import { buildPortalView, type PortalInput } from '@/lib/portal/view';

/**
 * CONTROLLED TREND SCENARIOS (intelligence audit, Sep 2026).
 *
 * Builds two check-ins whose feedback is known exactly — so many responses,
 * so many of them mentioning one topic — and runs the REAL chain over them:
 *
 *   stored check-ins -> computePulse -> buildIntelligence -> buildPortalView
 *                    -> buildImprovementsView (the Trends page)
 *
 * No database, no clock, no provider. The topic is the restaurant pack's
 * `service_speed` for a complaint and `food_taste` for praise; nothing about
 * the rules depends on which.
 */

export const PACK = getPackOrFallback('restaurant');
export const NOW = new Date(2026, 8, 30);
export const ISSUE = 'service_speed';
export const PRAISE = 'food_taste';

export type Side = { mentions: number; total: number };

function feedback(side: Side, kind: 'ISSUE' | 'PRAISE'): StoredFeedback[] {
  return Array.from({ length: side.total }, (_, i) => {
    const mentions = i < side.mentions;
    return {
      sentiment: mentions ? (kind === 'ISSUE' ? 'NEGATIVE' : 'POSITIVE') : 'NEUTRAL',
      issueTags: mentions && kind === 'ISSUE' ? [ISSUE] : [],
      praiseTags: mentions && kind === 'PRAISE' ? [PRAISE] : [],
      stars: null,
      reviewDate: null,
    } satisfies StoredFeedback;
  });
}

function checkin(id: string, label: string, capturedAt: Date, rows: StoredFeedback[]): StoredSnapshot {
  return {
    id,
    label,
    capturedAt,
    rating: null,
    reviewCount: null,
    unansweredCount: null,
    reviewsPerWeek: null,
    daysSinceLastPost: null,
    photoRecencyDays: null,
    generatedAt: null,
    feedback: rows,
  };
}

function themeRow(key: string, kind: 'ISSUE' | 'PRAISE', count: number): ThemeSummaryRow {
  const entries = kind === 'ISSUE' ? PACK.issueTaxonomy : PACK.praiseTaxonomy;
  const entry = entries.find((e) => e.key === key);
  return {
    key,
    label: entry?.label ?? key,
    kind,
    severity: entry?.severity ?? 'medium',
    count,
    itemIds: Array.from({ length: count }, (_, i) => `${key}-${i}`),
  };
}

export type Scenario = {
  /** The earlier check-in, or null when there is none. */
  previous: Side | null;
  /** The later check-in, or null when there is none. */
  current: Side | null;
  /** Responses that arrived after the latest check-in. */
  since?: Side;
  kind?: 'ISSUE' | 'PRAISE';
};

export type ScenarioResult = {
  intelligence: ClientIntelligence;
  /** The engine's verdict on the topic, or null when it is not a named topic. */
  state: string | null;
  /** Which shelf of the Trends page the topic landed on. */
  shelf: 'WORSE' | 'BETTER' | 'STABLE' | 'NONE';
  comparable: boolean;
  /** Whether the topic cleared the naming floor at all. */
  named: boolean;
  caveat: string | null;
  input: PortalInput;
};

/** Runs one scenario through the real chain. */
export function runScenario(scenario: Scenario): ScenarioResult {
  const kind = scenario.kind ?? 'ISSUE';
  const key = kind === 'ISSUE' ? ISSUE : PRAISE;
  const since = scenario.since ?? { mentions: 0, total: 0 };

  const snapshots: StoredSnapshot[] = [];
  if (scenario.previous) {
    snapshots.push(checkin('s1', 'June', new Date(2026, 5, 27), feedback(scenario.previous, kind)));
  }
  if (scenario.current) {
    snapshots.push(checkin('s2', 'August', new Date(2026, 7, 29), feedback(scenario.current, kind)));
  }

  const mentions = (scenario.previous?.mentions ?? 0) + (scenario.current?.mentions ?? 0) + since.mentions;
  const total = (scenario.previous?.total ?? 0) + (scenario.current?.total ?? 0) + since.total;
  const row = mentions > 0 ? [themeRow(key, kind, mentions)] : [];
  const themes: ThemeSummary = {
    praises: kind === 'PRAISE' ? row : [],
    issues: kind === 'ISSUE' ? row : [],
    analysedCount: total,
    dimensions: [],
  };

  const pulse = computePulse({ pack: PACK, snapshots, now: NOW });
  const intelligence = buildIntelligence({
    client: { id: 'c1', businessName: 'Corner Cafe', vertical: 'restaurant' },
    pack: PACK,
    themes,
    totalFeedback: total,
    pulse,
    notes: [],
  });
  const input: PortalInput = {
    intelligence,
    card: computeHealthCard({ pack: PACK, snapshots, now: NOW }),
    actions: [],
    snapshots,
    pack: PACK,
    themes,
    context: EMPTY_CONTEXT,
  };
  const view = buildPortalView(input);
  const trends = buildImprovementsView(input).trends;

  const insight = [...intelligence.unhappy, ...intelligence.loved].find((i) => i.themeKey === key) ?? null;
  const on = (rows: Array<{ key: string }>) => rows.some((r) => r.key === key);
  void view;
  return {
    intelligence,
    state: insight ? insight.movement.state : null,
    shelf: on(trends.worse) ? 'WORSE' : on(trends.better) ? 'BETTER' : on(trends.stable) ? 'STABLE' : 'NONE',
    comparable: trends.comparable,
    named: insight !== null,
    caveat: intelligence.window.volumeCaveat,
    input,
  };
}
