import { sourceLabel } from '@/lib/feedback/service';
import { parseJson } from '@/lib/format';
import type { NormalizedTheme } from '@/lib/analysis/normalize';

/**
 * THE EVIDENCE BEHIND A NUMBER (M24).
 *
 * Every figure the workspace states — "34 of 87", "32% → 47%" — is a count of
 * stored feedback rows, and the rows are always one tap away on Reviews. What
 * an owner cannot do from a count alone is SEE it: three customers, in their
 * own words, saying the thing the number summarises. This module picks those
 * three.
 *
 * Nothing here is a reading. The themes on a row were decided by the analysis
 * layer; this only chooses which of the rows that already carry a theme are
 * shown first, and it chooses deterministically:
 *
 *   - most recent first, so the evidence is the current state of the business;
 *   - never two rows from the same door while another door has one to offer,
 *     so a table-card submission and a public review sit side by side;
 *   - a full sentence over a fragment, and a readable length over an essay.
 *
 * A row with no words never becomes a quote: a rating is evidence, but it is
 * not something a customer said, and the page must never put words in a
 * customer's mouth.
 */

export type EvidenceRow = {
  id: string;
  text: string;
  stars: number | null;
  /** The customer's own date where it was parsed, otherwise when it arrived. */
  at: Date;
  source: string;
  themeKeys: string[];
};

export type Quote = {
  id: string;
  text: string;
  stars: number | null;
  at: Date;
  source: string;
  sourceLabel: string;
};

export type EvidenceIndex = {
  /** Read rows, whether or not they carry words. */
  total: number;
  /** Rows by theme key, most recent first. Only rows with words. */
  byTheme: Map<string, EvidenceRow[]>;
};

export const EMPTY_EVIDENCE: EvidenceIndex = { total: 0, byTheme: new Map() };

/** Below this a text is a fragment ("ok", "slow"), not something worth quoting. */
const MIN_QUOTE_LENGTH = 20;
/** Above this a quote stops being scannable; shorter ones are preferred, not required. */
const COMFORTABLE_LENGTH = 220;

export function buildEvidenceIndex(
  rows: Array<{
    id: string;
    text: string;
    stars: number | null;
    reviewDate: Date | null;
    createdAt: Date;
    source: string;
    themesJson: string;
  }>,
): EvidenceIndex {
  const byTheme = new Map<string, EvidenceRow[]>();
  for (const row of rows) {
    const text = row.text.replace(/\s+/g, ' ').trim();
    const themeKeys = parseJson<NormalizedTheme[]>(row.themesJson, [])
      .map((t) => t?.key)
      .filter((k): k is string => typeof k === 'string' && k.length > 0);
    if (text.length === 0 || themeKeys.length === 0) continue;
    const evidence: EvidenceRow = {
      id: row.id,
      text,
      stars: row.stars,
      at: row.reviewDate ?? row.createdAt,
      source: row.source,
      themeKeys,
    };
    for (const key of themeKeys) {
      const list = byTheme.get(key) ?? [];
      list.push(evidence);
      byTheme.set(key, list);
    }
  }
  for (const list of byTheme.values()) {
    list.sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id));
  }
  return { total: rows.length, byTheme };
}

export type QuoteOptions = {
  limit?: number;
  /** Only rows dated on or after this. The "after the change" pile. */
  since?: Date | null;
  /** Only rows dated before this. The "before the change" pile. */
  until?: Date | null;
};

/**
 * Up to `limit` representative quotes for one theme.
 *
 * The rule is the one in the module comment: recency, then one door at a
 * time, then readability. It is a selection, not a ranking — the owner is
 * told how many there are in total and can read every one on Reviews.
 */
export function quotesFor(index: EvidenceIndex, themeKey: string, options: QuoteOptions = {}): Quote[] {
  const limit = options.limit ?? 3;
  const rows = (index.byTheme.get(themeKey) ?? []).filter((row) => {
    if (options.since && row.at.getTime() < options.since.getTime()) return false;
    if (options.until && row.at.getTime() >= options.until.getTime()) return false;
    return row.text.length >= MIN_QUOTE_LENGTH;
  });
  if (rows.length === 0) return [];

  // Two passes: readable lengths first, then anything. Within a pass the rows
  // are already newest first, and a source is skipped while it is ahead of the
  // others so the sample shows every door feedback came through.
  const chosen: EvidenceRow[] = [];
  const perSource = new Map<string, number>();
  const sources = new Set(rows.map((row) => row.source)).size;
  const take = (candidates: EvidenceRow[]) => {
    for (const row of candidates) {
      if (chosen.length >= limit) return;
      if (chosen.some((c) => c.id === row.id)) continue;
      const used = perSource.get(row.source) ?? 0;
      const least = Math.min(...[...new Set(rows.map((r) => r.source))].map((s) => perSource.get(s) ?? 0));
      if (sources > 1 && used > least) continue;
      chosen.push(row);
      perSource.set(row.source, used + 1);
    }
  };
  take(rows.filter((row) => row.text.length <= COMFORTABLE_LENGTH));
  take(rows);
  // Balance can leave a slot empty when one door has run out; fill it plainly.
  if (chosen.length < limit) {
    for (const row of rows) {
      if (chosen.length >= limit) break;
      if (!chosen.some((c) => c.id === row.id)) chosen.push(row);
    }
  }

  return chosen
    .sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id))
    .map((row) => ({
      id: row.id,
      text: row.text,
      stars: row.stars,
      at: row.at,
      source: row.source,
      sourceLabel: sourceLabel(row.source),
    }));
}

/** How many rows with words carry this theme, within the same window. */
export function quotableCount(index: EvidenceIndex, themeKey: string, options: QuoteOptions = {}): number {
  return (index.byTheme.get(themeKey) ?? []).filter((row) => {
    if (options.since && row.at.getTime() < options.since.getTime()) return false;
    if (options.until && row.at.getTime() >= options.until.getTime()) return false;
    return true;
  }).length;
}
