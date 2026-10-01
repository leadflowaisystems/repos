import { describe, expect, it } from 'vitest';
import { normalizeFeedback } from '@/lib/analysis/normalize';
import { summariseThemeRows } from '@/lib/feedback/analysis';
import { computeHealthCard, computePulse } from '@/lib/health/health';
import { buildIntelligence } from '@/lib/intelligence/engine';
import { buildPortalView } from '@/lib/portal/view';
import { EMPTY_CONTEXT } from '@/lib/context/apply';
import { getPackOrFallback } from '@/lib/packs';
import { SEMANTIC_V2_DEV } from './eval/semantic-v2-dev';

/**
 * M46 — ONE READING OF WHAT THE CUSTOMER SAID, EVERYWHERE.
 *
 * Surfaces may prioritise differently; they may not disagree about what a
 * customer said. Every count on Customers, Home, Trends, Check-in,
 * Improvements and the period reports is a count of the topics stored on each
 * response — the same topics the Feedback page shows on that response. This
 * reads the development corpus through the real reader, stores it as the
 * pipeline does, and checks that every aggregate equals the per-response
 * truth, topic by topic, vertical by vertical.
 */

const NOW = new Date(2026, 8, 30);

describe('every surface counts the same topics the response shows', () => {
  const packs = [...new Set(SEMANTIC_V2_DEV.map((e) => e.pack))];
  for (const packId of packs) {
    it(packId, () => {
      const pack = getPackOrFallback(packId);
      const examples = SEMANTIC_V2_DEV.filter((e) => e.pack === packId);
      // Stored exactly as feedback/analysis.ts stores a reading.
      const rows = examples.map((e) => {
        const n = normalizeFeedback({ text: e.text, stars: e.stars, pack, ai: null });
        return { id: e.id, themesJson: JSON.stringify(n.themes), n };
      });

      // Per response: the stored themes are the reading's own topics, each on its own side.
      for (const r of rows) {
        expect(r.n.issueTags).toEqual(r.n.themes.filter((t) => t.kind === 'ISSUE').map((t) => t.key));
        expect(r.n.praiseTags).toEqual(r.n.themes.filter((t) => t.kind === 'PRAISE').map((t) => t.key));
        // A set-aside clause is explained on the response itself.
        if (r.n.abstentions.length > 0) expect(r.n.reasons.join(' ')).toMatch(/not counted/);
      }

      // The counts every surface is built from.
      const summary = summariseThemeRows(rows, pack);
      const truth = new Map<string, string[]>();
      for (const r of rows) for (const t of r.n.themes) truth.set(t.key, [...(truth.get(t.key) ?? []), r.id]);
      for (const row of [...summary.issues, ...summary.praises]) {
        expect(row.count, row.key).toBe(truth.get(row.key)?.length ?? 0);
        expect([...row.itemIds].sort(), row.key).toEqual([...(truth.get(row.key) ?? [])].sort());
      }
      expect(summary.issues.length + summary.praises.length).toBe(truth.size);

      // What the owner reads: every named topic carries that same count.
      const pulse = computePulse({ pack, snapshots: [], now: NOW });
      const intelligence = buildIntelligence({
        client: { id: 'c1', businessName: 'Synthetic', vertical: packId },
        pack,
        themes: summary,
        totalFeedback: rows.length,
        pulse,
        notes: [],
      });
      const view = buildPortalView({
        intelligence,
        card: computeHealthCard({ pack, snapshots: [], now: NOW }),
        actions: [],
        snapshots: [],
        pack,
        themes: summary,
        context: EMPTY_CONTEXT,
      });
      for (const s of [...view.unhappy, ...view.loved, ...view.early]) {
        expect(s.evidenceCount, s.themeKey).toBe(truth.get(s.themeKey)?.length ?? 0);
        // A problem is never shown as praise, or the reverse.
        const stored = rows.flatMap((r) => r.n.themes).find((t) => t.key === s.themeKey);
        expect(stored?.kind, s.themeKey).toBe(s.kind);
      }
    });
  }
});
