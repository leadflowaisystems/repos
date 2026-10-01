import type { EvalExample, EvalSentiment } from './semantic-dataset';

/**
 * THE SECOND GOLD CORPUS (final semantic correctness pass, Sep 2026).
 *
 * 300 new pieces of synthetic feedback, written by hand BEFORE any change in
 * this pass, labelled against the pack taxonomies as a careful reader would:
 *
 *   DEV     200 examples  (semantic-v2-dev.ts)      tuned against
 *   LOCKED  100 examples  (semantic-v2-locked.ts)   not run until every code
 *                                                   change was finished; run
 *                                                   once; never patched
 *
 * On top of the first corpus's labels, each example may carry:
 *
 *   traps     topics that would pin on the BUSINESS something the sentence
 *             says someone else did ("the baraat ran late" → punctuality).
 *             Also forbidden; counted separately as wrong attribution.
 *   abstain   the sentence gives nothing safe to file. The right output is
 *             no topic at all.
 *
 * Nothing here is produced by a model, at test time or otherwise.
 */

export type V2Category =
  | EvalExample['category']
  | 'attribution'
  | 'clause'
  | 'negation'
  | 'sarcasm'
  | 'idiom'
  | 'vague'
  | 'temporal'
  | 'causal'
  | 'event'
  | 'quantitative';

export type V2Example = Omit<EvalExample, 'category'> & {
  category: V2Category;
  set: 'DEV' | 'LOCKED' | 'FRESH2';
  /** Topics that would be a wrong attribution to the business. */
  traps: string[];
  /** Nothing in the sentence can safely be filed. */
  abstain: boolean;
};

type Labels = {
  /** praise that must be found */
  p?: string[];
  /** problems that must be found */
  i?: string[];
  /** defensible either way */
  t?: string[];
  /** forbidden */
  x?: string[];
  /** wrong-attribution traps (also forbidden) */
  a?: string[];
  /** other acceptable overall sentiments */
  also?: EvalSentiment[];
  /** a second reader is warranted */
  ai?: boolean;
  /** nothing can safely be filed */
  abstain?: boolean;
};

export function v2(
  set: 'DEV' | 'LOCKED' | 'FRESH2',
  id: string,
  pack: EvalExample['pack'],
  category: V2Category,
  text: string,
  stars: number | null,
  sentiment: EvalSentiment,
  l: Labels = {},
): V2Example {
  const traps = l.a ?? [];
  return {
    id,
    pack,
    category,
    text,
    stars,
    set,
    traps,
    abstain: l.abstain ?? false,
    expected: {
      sentiment,
      alsoAccept: l.also,
      praise: l.p ?? [],
      issues: l.i ?? [],
      tolerated: l.t,
      prohibited: [...(l.x ?? []), ...traps],
      dimensions: [],
      routing: l.ai ? 'AI' : 'KEYWORD',
    },
  };
}
