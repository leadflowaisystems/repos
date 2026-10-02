import { describe, expect, it } from 'vitest';
import { getPackOrFallback, type Pack } from '@/lib/packs';
import { MESSAGES } from '@/lib/i18n/strings';
import { EN, translatorFor } from '@/lib/i18n/translator';
import { buildIntelligence } from '@/lib/intelligence/engine';
import { computeHealthCard } from '@/lib/health/health';
import { EMPTY_CONTEXT } from '@/lib/context/apply';
import { buildEvidenceState, levelOf, stageOf, type PileFacts } from '@/lib/portal/ladder';
import { buildTrendReadiness } from '@/lib/portal/trends';
import { buildPortalView, type PortalInput } from '@/lib/portal/view';
import { NO_PULSE, theme, themes } from '@/lib/portal/test-fixtures';
import { runLadder, type Response } from './eval/ladder-scenarios';
import { SEMANTIC_V2_DEV } from './eval/semantic-v2-dev';
import { SEMANTIC_V2_DEV2 } from './eval/semantic-v2-dev2';
import { SEMANTIC_V2_DEV3 } from './eval/semantic-v2-dev3';
import { SEMANTIC_V2_DEV4 } from './eval/semantic-v2-dev4';

/**
 * M50 — ONE LADDER, SEVEN VERTICALS (Oct 2026).
 *
 * The evidence ladder is shared; the content is not. Every vertical climbs the
 * same rungs at the same counts, and every vertical's rungs are filled with
 * its own topics, its own labels and its own suggestions — never a café's.
 * The ladder's own words name no trade at all.
 *
 * Real text comes from the DEVELOPMENT rounds of the second semantic corpus
 * only (`tests/eval/semantic-v2-dev*.ts`, 36–47 examples per vertical). The
 * locked and blind sets are not read here: they are kept for measurement.
 */

const VERTICALS = ['clinic', 'coaching', 'gym', 'real_estate', 'restaurant', 'salon', 'wedding_vendor'] as const;
const CAFE_WORDS = /\b(coffee|cappuccino|food|dish|dishes|menu|waiter|waiters|restaurant|cafe|café|meal|kitchen|biryani|pizza|burger|chai|drinks?)\b/i;

function corpus(vertical: (typeof VERTICALS)[number]): Response[] {
  return [...SEMANTIC_V2_DEV, ...SEMANTIC_V2_DEV2, ...SEMANTIC_V2_DEV3, ...SEMANTIC_V2_DEV4]
    .filter((e) => e.pack === vertical)
    .map((e) => ({ text: e.text, stars: e.stars ?? null }));
}

const pile = (read: number, happy = read): PileFacts => ({
  collected: read,
  read,
  waiting: 0,
  failed: 0,
  happy,
  mixed: 0,
  unhappy: read - happy,
  rated: 0,
  ratingSum: 0,
  withWords: read,
});

/** One pack's evidence state from known counts: its first complaint and first praise. */
function stateFor(pack: Pack, read: number, issueMentions: number, praiseMentions: number, locale: 'en' | 'hi' | 'mr' = 'en') {
  const t = locale === 'en' ? EN : translatorFor(locale);
  const issue = pack.issueTaxonomy[0]!;
  const praise = pack.praiseTaxonomy[0]!;
  const th = themes(
    praiseMentions > 0 ? [theme(praise.key, praise.label, 'PRAISE', praiseMentions)] : [],
    issueMentions > 0 ? [theme(issue.key, issue.label, 'ISSUE', issueMentions, issue.severity)] : [],
    read,
  );
  const intelligence = buildIntelligence({
    client: { id: 'c1', businessName: 'Test', vertical: pack.id },
    pack,
    themes: th,
    totalFeedback: read,
    pulse: NO_PULSE,
    notes: [],
    t,
  });
  const input: PortalInput = {
    intelligence,
    card: computeHealthCard({ pack, snapshots: [], now: new Date(2026, 9, 1) }),
    actions: [],
    snapshots: [],
    pack,
    themes: th,
    context: EMPTY_CONTEXT,
    t,
  };
  const view = buildPortalView(input);
  return {
    issue,
    praise,
    state: buildEvidenceState({ view, themes: th, pile: pile(read), trendReadiness: buildTrendReadiness(input), pack, t }),
  };
}

describe('the ladder’s own words name no trade', () => {
  it('no ladder phrase mentions food, coffee, a menu or a kitchen, in English', () => {
    for (const [key, phrase] of Object.entries(MESSAGES)) {
      if (!key.startsWith('ladder.')) continue;
      expect(phrase.en, key).not.toMatch(CAFE_WORDS);
    }
  });
});

describe('every vertical climbs the same rungs at the same counts', () => {
  const STEPS: Array<[number, number, number]> = [
    // read, complaint mentions, praise mentions
    [1, 1, 0],
    [3, 2, 1],
    [5, 2, 2],
    [12, 3, 4],
    [30, 7, 9],
    [100, 12, 30],
  ];

  for (const vertical of VERTICALS) {
    describe(vertical, () => {
      const pack = getPackOrFallback(vertical);

      it('has its own taxonomy to climb with', () => {
        expect(pack.id).toBe(vertical);
        expect(pack.issueTaxonomy.length).toBeGreaterThan(3);
        expect(pack.praiseTaxonomy.length).toBeGreaterThan(3);
      });

      for (const [read, issueMentions, praiseMentions] of STEPS) {
        it(`at ${read} read: the shared rungs, its own topics and its own suggestion`, () => {
          const { issue, praise, state } = stateFor(pack, read, issueMentions, praiseMentions);
          expect(state.stage).toBe(stageOf(read));
          const complaint = state.findings.find((f) => f.key === issue.key)!;
          expect(complaint.level).toBe(levelOf(issueMentions, read));
          expect(complaint.label).toBe(issue.label);
          if (praiseMentions > 0) {
            const liked = state.findings.find((f) => f.key === praise.key)!;
            expect(liked.level).toBe(levelOf(praiseMentions, read));
            expect(liked.label).toBe(praise.label);
          }
          // The suggestion, when the evidence earns one, is this pack's own.
          if (complaint.level === 'EMERGING_PATTERN' || complaint.level === 'STRONG_PATTERN') {
            // The pack's suggestion as the owner reads it everywhere else:
            // the dictionary's wording of it, the pack's own as the fallback
            // (intelligence/engine.ts `actionFor`).
            expect(complaint.action?.text).toBe(EN.soft(`pack.${pack.id}.${issue.key}.action`) ?? issue.action);
            expect(complaint.action?.level).toBe(complaint.level === 'STRONG_PATTERN' ? 'ACT' : 'CHECK');
          } else {
            expect(complaint.action).toBeNull();
          }
          // Nothing but this pack's keys, and no café words outside the café.
          const keys = new Set([...pack.issueTaxonomy, ...pack.praiseTaxonomy].map((x) => x.key));
          for (const f of state.findings) expect(keys.has(f.key), f.key).toBe(true);
          if (vertical !== 'restaurant') {
            const text = JSON.stringify(state.findings.map((f) => [f.levelLabel, f.line])) + state.copy.title + state.copy.intro;
            expect(text).not.toMatch(CAFE_WORDS);
          }
        });
      }

      it('says the same in Hindi and Marathi, with the pack’s own translated names', () => {
        for (const locale of ['hi', 'mr'] as const) {
          const { issue, state } = stateFor(pack, 30, 7, 9, locale);
          const complaint = state.findings.find((f) => f.key === issue.key)!;
          expect(complaint.level).toBe('STRONG_PATTERN');
          expect(complaint.line).toMatch(/[ऀ-ॿ]/);
          expect(complaint.line).toContain('7');
          expect(complaint.line).toContain('30');
        }
      });
    });
  }
});

describe('real feedback from each vertical climbs the ladder honestly', () => {
  for (const vertical of VERTICALS) {
    it(`${vertical}: its own words, at 1, 5, 12 and 30 responses`, () => {
      const pack = getPackOrFallback(vertical);
      const words = corpus(vertical);
      expect(words.length).toBeGreaterThanOrEqual(30);
      const keys = new Set([...pack.issueTaxonomy, ...pack.praiseTaxonomy].map((x) => x.key));
      for (const n of [1, 5, 12, 30]) {
        const r = runLadder(words.slice(0, n), { pack: vertical });
        const s = r.state;
        expect(s.read).toBe(n);
        expect(s.stage).toBe(stageOf(n));
        // Something useful from the first response.
        expect(s.findings.length > 0 || s.standsOut !== null || (s.firstResponse?.length ?? 0) > 0).toBe(true);
        for (const f of s.findings) {
          expect(keys.has(f.key), `${vertical}: ${f.key} is not this pack's`).toBe(true);
          expect(f.level).toBe(levelOf(f.mentions, n));
          if (n < 10) expect(f.level === 'EMERGING_PATTERN' || f.level === 'STRONG_PATTERN').toBe(false);
        }
        if (n < 10) expect(r.brief.attention).toBeNull();
        // Every count agrees across Home's state and the engine's named topics.
        for (const sig of [...r.view.unhappy, ...r.view.loved, ...r.view.early]) {
          expect(s.findings.find((f) => f.kind === sig.kind && f.key === sig.themeKey)?.mentions).toBe(sig.evidenceCount);
        }
      }
    });
  }
});
