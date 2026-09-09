import type { Pack, TaxonomyEntry } from '@/lib/packs';
import { EN, type PortalTranslator } from '@/lib/i18n/translator';

/**
 * HOW BUSINESS CONTEXT MAY TOUCH REPOS (M13).
 *
 * Pure functions that read what the owner told RepOS and decide, from pack
 * configuration alone, how it shapes a recommendation or a card. Nothing here
 * counts feedback, moves a theme, or changes a trend: the evidence layers
 * (M6, M10, M11) never see this module. It only chooses between advice the
 * pack already holds and attaches the owner's words to the theme they are
 * about.
 *
 * Context may make a suggestion more practical. It may never make a
 * complaint quieter.
 */

export const CONTEXT_KINDS = [
  'PRIORITY',
  'FOCUS',
  'OPERATING',
  'CONSTRAINT',
  'TRIED',
  'DEFINITION',
  'ANSWER',
] as const;

export type ContextKind = (typeof CONTEXT_KINDS)[number];

/** How the operator's form and the owner's page name each kind. */
export const KIND_LABELS: Record<ContextKind, string> = {
  PRIORITY: 'What matters most right now',
  FOCUS: 'Current focus',
  OPERATING: 'How the business operates',
  CONSTRAINT: 'Not to recommend',
  TRIED: 'Already tried',
  DEFINITION: 'Worth knowing',
  ANSWER: 'Answered a question',
};

export const CONTEXT_PROVENANCE = [
  'OWNER_TOLD_US',
  'DERIVED_FROM_ACTION',
  'DERIVED_FROM_FEEDBACK',
] as const;

export type ContextProvenance = (typeof CONTEXT_PROVENANCE)[number];

export const CONSTRAINT_KEYS = ['STAFF', 'DISCOUNT', 'PRICE', 'SPEND', 'OTHER'] as const;

export type ConstraintKey = (typeof CONSTRAINT_KEYS)[number];

export const CONSTRAINT_LABELS: Record<ConstraintKey, string> = {
  STAFF: 'No new staff right now',
  DISCOUNT: 'No discounts or offers',
  PRICE: 'No price changes',
  SPEND: 'No extra spending',
  OTHER: 'Something else',
};

/** "extra staff", for a sentence. */
export const CONSTRAINT_NOUNS: Record<ConstraintKey, string> = {
  STAFF: 'extra staff',
  DISCOUNT: 'a discount or offer',
  PRICE: 'a price change',
  SPEND: 'extra spending',
  OTHER: 'something you have ruled out',
};

/** The active, owner-told context the reasoning layers read. */
export type ContextItem = {
  id: string;
  kind: ContextKind;
  provenance: ContextProvenance;
  text: string;
  themeKey: string | null;
  constraintKey: ConstraintKey | null;
  questionKey: string | null;
  actionId: string | null;
  recordedAt: Date;
};

export type ContextSet = {
  items: ContextItem[];
};

export const EMPTY_CONTEXT: ContextSet = { items: [] };

function ownerTold(set: ContextSet): ContextItem[] {
  return set.items.filter((i) => i.provenance === 'OWNER_TOLD_US');
}

/** Everything the owner told RepOS about one theme, in their words. */
export function contextForTheme(set: ContextSet, themeKey: string): ContextItem[] {
  return ownerTold(set).filter((i) => i.themeKey === themeKey && i.kind !== 'PRIORITY' && i.kind !== 'FOCUS');
}

/** True when the owner said this theme is what matters most or their focus. */
export function ownerPriority(set: ContextSet, themeKey: string): ContextItem | null {
  return (
    ownerTold(set).find(
      (i) => (i.kind === 'PRIORITY' || i.kind === 'FOCUS') && i.themeKey === themeKey,
    ) ?? null
  );
}

/** The answer already given to the pack question for this theme, if any. */
export function answerFor(set: ContextSet, themeKey: string): ContextItem | null {
  return ownerTold(set).find((i) => i.kind === 'ANSWER' && i.questionKey === themeKey) ?? null;
}

export function constraints(set: ContextSet): ContextItem[] {
  return ownerTold(set).filter((i) => i.kind === 'CONSTRAINT' && i.constraintKey !== null);
}

export type AppliedSuggestion = {
  /** The advice to show: the pack's action, or its alternative when the owner ruled the first out. */
  text: string | null;
  /** The constraint that applied, when one did. */
  constraint: ContextItem | null;
  /** "You told us extra staff is not possible right now, so this is the version that does not need it." */
  note: string | null;
  /** True when the pack had no practical alternative and the original still needs what was ruled out. */
  blocked: boolean;
};

/**
 * The pack's advice for a theme, with the owner's constraints applied.
 *
 * A constraint never removes the theme or its evidence; it only decides which
 * of the pack's two pieces of advice is practical, and says so in the owner's
 * own terms. With no matching constraint the pack's action is returned as is.
 */
export function applyConstraints(
  entry: TaxonomyEntry | undefined,
  set: ContextSet,
  t: PortalTranslator = EN,
  packId?: string,
): AppliedSuggestion {
  // The pack's own wording, in the owner's language when the dictionary has it.
  // Looked up here as well as in the intelligence layer because THIS text wins
  // over the recommendation when a constraint applies, so localizing only the
  // other path left the suggestion in English exactly when a constraint was
  // recorded.
  const localized = (field: 'action' | 'alternativeAction'): string | null => {
    const own = entry?.[field]?.trim() || null;
    if (!own || !packId || !entry) return own;
    const suffix = field === 'action' ? 'action' : 'alternativeAction';
    return t.soft(`pack.${packId}.${entry.key}.${suffix}`) ?? own;
  };
  const action = localized('action');
  if (!entry || !action) return { text: action, constraint: null, note: null, blocked: false };

  const needs = entry.actionNeeds ?? [];
  const hit = constraints(set).find((c) => c.constraintKey && (needs as string[]).includes(c.constraintKey));
  if (!hit || !hit.constraintKey) return { text: action, constraint: null, note: null, blocked: false };

  const noun = t.soft(`insight.constraint.noun.${hit.constraintKey}`) ?? CONSTRAINT_NOUNS[hit.constraintKey];
  const alternative = localized('alternativeAction');
  if (alternative) {
    return {
      text: alternative,
      constraint: hit,
      note: t('insight.constraint.alternative', { noun }),
      blocked: false,
    };
  }
  return {
    text: action,
    constraint: hit,
    note: t('insight.constraint.blocked', { noun }),
    blocked: true,
  };
}

/** The pack entry for a theme, either side of the taxonomy. */
export function packEntry(pack: Pack, themeKey: string): TaxonomyEntry | undefined {
  return (
    pack.issueTaxonomy.find((t) => t.key === themeKey) ??
    pack.praiseTaxonomy.find((t) => t.key === themeKey)
  );
}

/**
 * "You told us …", always attributed, never restated as a customer's words.
 *
 * `question` is the pack question an ANSWER answered, when the caller knows
 * it, so the answer reads with what it was an answer to.
 */
export function youToldUs(
  item: ContextItem,
  question?: string | null,
  translator?: PortalTranslator,
): string {
  // The frame is Headway's; the text inside it is the owner's own sentence and
  // is passed through untouched.
  const t = translator ?? EN;
  const text = item.text.trim().replace(/\.$/, '');
  switch (item.kind) {
    case 'PRIORITY':
      return t('insight.youToldUs.priority', { text: lowerFirst(text) });
    case 'FOCUS':
      return t('insight.youToldUs.focus', { text: lowerFirst(text) });
    case 'CONSTRAINT': {
      const noun =
        item.constraintKey && item.constraintKey !== 'OTHER'
          ? (t.soft(`insight.constraint.noun.${item.constraintKey}`) ??
             CONSTRAINT_NOUNS[item.constraintKey])
          : null;
      const consequence = noun ? t('insight.youToldUs.wontSuggest', { noun }) : '';
      return `${t('insight.youToldUs.plain', { text: lowerFirst(text) })}${consequence}`;
    }
    case 'TRIED':
      return t('insight.youToldUs.tried', { text: lowerFirst(text) });
    case 'ANSWER':
      return question
        ? t('insight.youToldUs.answer', { question: question.trim(), text: lowerFirst(text) })
        : t('insight.youToldUs.plain', { text });
    default:
      return t('insight.youToldUs.plain', { text });
  }
}

function lowerFirst(s: string): string {
  // Keep acronyms and proper-looking words as typed; only soften a leading capital
  // on an ordinary word so the sentence reads naturally after "You told us …".
  return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
