import type {
  Responsibility,
  ResponsibilityItem,
  ResponsibilityState,
} from '@/lib/responsibility/engine';
import type { PortalMood, PortalOutcome, PortalSignal, PortalView } from '@/lib/portal/view';
import { spoken } from '@/lib/portal/view';
import { quotesFor, type EvidenceIndex, type Quote } from './evidence';
import { formatDate } from '@/lib/format';
import { EN } from '@/lib/i18n/translator';
import type { PortalTranslator } from '@/lib/i18n/translator';

/**
 * THE FOCUS — what an owner reads in ten seconds (M24).
 *
 * Home used to be a briefing: a picture, a decision card, a panel of what
 * Headway is carrying, the thing itself in four labelled layers, the
 * strengths, the figures. Every block was honest and every block was the
 * same size, so the owner still had to read the page to find the one thing
 * that mattered. This module decides that one thing, and the three proofs
 * that let the owner check it without leaving the page:
 *
 *   RIGHT NOW    "Slow service is the main thing to fix."
 *   WHY          "Customers like your food — 32 praised it. The main problem
 *                 they mention is slow service."
 *   EVIDENCE     39% of feedback → 34 of 87, three customers in their words
 *                More often after the change → 32% before, 47% after
 *                At both recent check-ins → raised at 2 of your last 2
 *   WHAT TO DO   "Before you undo the change, check what else changed."
 *   CHECK NEXT   "Headway is checking whether slow service comes up more or
 *                 less at your next check-in …"
 *
 * Each fact appears once. The share chip carries the three quotes, so the
 * block no longer repeats them under the reading (final experience pass).
 *
 * It computes nothing new. The responsibility layer already decided what
 * needs the owner; the view already read every theme; the measurement engine
 * already compared before and after; the evidence index already holds the
 * rows. This chooses, orders and words. Pure: everything it needs is passed in.
 *
 * THE LANGUAGE IS PASSED IN (M31b). Every sentence below comes out of the
 * dictionary through `t`, and `t` arrives on the input object — it is never
 * looked up and never branched on. The WHY line in particular is three whole
 * sentences, not an English clause with a verb dropped into the middle of it:
 * Hindi and Marathi put the verb at the end, so a sentence assembled from
 * fragments can only ever be assembled in English.
 */

export type ProofPopulation = {
  before: { count: number; total: number; share: string; scope: string };
  after: { count: number; total: number; share: string; scope: string };
  /** "Mentioned more often after the change". */
  reading: string;
  tone: 'good' | 'bad' | 'neutral';
  /** The engine's own sentences, for "Why Headway says this". */
  why: string[];
  /** The no-causation sentence, verbatim. */
  caveat: string;
  /** When the change was recorded, for the label. */
  changeDate: Date | null;
};

export type FocusProof = {
  key: 'share' | 'outcome' | 'movement' | 'recurrence' | 'rated';
  /** The chip. Short: "39% of feedback". */
  label: string;
  /** The line that opens under it: "34 of 87 feedback entries mention slow service." */
  detail: string;
  tone: 'good' | 'bad' | 'neutral';
  /** For the share chip: three customers, in their words. */
  quotes: Quote[];
  /** "See all 34 mentions" → the filtered evidence. */
  seeAll: { label: string; href: string } | null;
  /** For the outcome chip: the two piles. */
  population: ProofPopulation | null;
  /** For the movement chip: both check-ins, named. */
  comparison: string | null;
};

export type FocusNext = {
  /** One concise, practical action. */
  headline: string;
  /** The suggestion or the constraint note, when there is one. */
  detail: string | null;
  /** Why this is the step, in the engine's words. Behind "Why". */
  why: string[];
  /** "Headway is checking whether …" — the open loop. */
  watching: string | null;
};

export type Focus = {
  mood: PortalMood;
  state: ResponsibilityState;
  /** The largest text on the page. */
  headline: string;
  /** Under it, small: what the headline rests on. */
  basis: string;
  /** The theme the focus is about, when it is about one. */
  theme: { key: string; label: string; kind: 'PRAISE' | 'ISSUE' } | null;
  proofs: FocusProof[];
  /** The one gold button. */
  cta: { label: string; href: string } | null;
  /** WHY: one or two sentences, never a paragraph. */
  synthesis: string | null;
  /** WHAT TO DO, and what Headway will check next. */
  next: FocusNext | null;
};

export type FocusInput = {
  responsibility: Responsibility;
  view: PortalView;
  evidence: EvidenceIndex;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  /**
   * The language this portal is being read in, as a translator.
   *
   * Passed in, never looked up: these builders are pure, and a function that
   * asked what language it was in would have to be edited again for the next
   * one. Omitted means English — which is not an oversight but the operator
   * console's deliberate answer, since staff read one language.
   */
  t?: PortalTranslator;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signalFor(view: PortalView, themeKey: string | null): PortalSignal | null {
  if (!themeKey) return null;
  return [...view.unhappy, ...view.loved, ...view.early].find((s) => s.themeKey === themeKey) ?? null;
}

function reviewsHref(basePath: string, themeKey: string): string {
  return `${basePath}/reviews?theme=${encodeURIComponent(themeKey)}`;
}

function signalHref(basePath: string, themeKey: string): string {
  return `${basePath}/analysis?open=${encodeURIComponent(themeKey)}#signal-${encodeURIComponent(themeKey)}`;
}

function outcomeReading(
  outcome: PortalOutcome,
  t: PortalTranslator,
): { reading: string; tone: 'good' | 'bad' | 'neutral' } {
  switch (outcome.result) {
    case 'IMPROVED':
      return { reading: t('focus.outcome.reading.improved'), tone: 'good' };
    case 'WORSENED':
      return { reading: t('focus.outcome.reading.worsened'), tone: 'bad' };
    case 'NO_CLEAR_CHANGE':
      return { reading: t('focus.outcome.reading.noChange'), tone: 'neutral' };
    default:
      return { reading: t('focus.outcome.reading.tooEarly'), tone: 'neutral' };
  }
}

/** "32% → 47%" as two piles, from the measurement the engine froze. */
export function populationFrom(
  outcome: PortalOutcome,
  action: PortalView['actions'][number] | null,
  translator?: PortalTranslator,
): ProofPopulation | null {
  const t = translator ?? EN;
  // The engine's own numbers, not a reading of its sentence.
  const before = { count: outcome.beforeCount, total: outcome.beforeTotal };
  const after = { count: outcome.afterCount, total: outcome.afterTotal };
  if (!outcome.beforeShare || !outcome.afterShare) return null;
  const { reading, tone } = outcomeReading(outcome, t);
  return {
    before: { ...before, share: outcome.beforeShare, scope: outcome.beforeScope },
    after: { ...after, share: outcome.afterShare, scope: outcome.afterScope },
    reading,
    tone,
    why: outcome.why,
    caveat: outcome.caveat || outcome.note,
    changeDate: action?.doneAt ?? outcome.changeDate,
  };
}

function outcomeChip(
  outcome: PortalOutcome,
  t: PortalTranslator,
): { label: string; tone: 'good' | 'bad' | 'neutral' } {
  switch (outcome.result) {
    case 'IMPROVED':
      return { label: t('focus.chip.outcome.improved'), tone: 'good' };
    case 'WORSENED':
      return { label: t('focus.chip.outcome.worsened'), tone: 'bad' };
    case 'NO_CLEAR_CHANGE':
      return { label: t('focus.chip.outcome.noChange'), tone: 'neutral' };
    default:
      return { label: t('focus.chip.outcome.tooEarly'), tone: 'neutral' };
  }
}

/**
 * "Raised at 2 of your last 2 check-ins." → "At both recent check-ins".
 *
 * Reads the signal's two NUMBERS, not its sentence. It used to pull them back
 * out of the English with /at (\d+) of your last (\d+) check-ins/, which found
 * nothing the moment that sentence was written in Hindi or Marathi — so the
 * chip simply disappeared for those readers, with nothing to notice.
 */
function recurrenceChip(signal: PortalSignal, t: PortalTranslator): string | null {
  const raised = signal.recurrenceRaised;
  const outOf = signal.recurrenceOutOf;
  if (raised !== null && outOf !== null && raised >= 1) {
    if (raised === outOf && outOf === 2) return t('focus.chip.recurrence.both');
    return t('focus.chip.recurrence.some', { raised, of: outOf });
  }
  if (signal.isNew) return t('focus.chip.recurrence.new');
  return null;
}

function movementChip(
  signal: PortalSignal,
  t: PortalTranslator,
): { label: string; tone: 'good' | 'bad' | 'neutral' } | null {
  const d = signal.movementDirection;
  if (!d) return null;
  const issue = signal.kind === 'ISSUE';
  if (d === 'STABLE') return { label: t('focus.chip.movement.stable'), tone: 'neutral' };
  const rose = issue ? d === 'WORSENING' : d === 'IMPROVING';
  const good = d === 'IMPROVING';
  return {
    label: rose ? t('focus.chip.movement.more') : t('focus.chip.movement.less'),
    tone: good ? 'good' : 'bad',
  };
}

/**
 * The proofs for one theme, in the order an owner checks them: how big it
 * is, what happened to it, and whether it keeps happening. At most three.
 */
export function proofsFor(
  signal: PortalSignal,
  view: PortalView,
  evidence: EvidenceIndex,
  basePath: string,
  translator?: PortalTranslator,
): FocusProof[] {
  const t = translator ?? EN;
  const out: FocusProof[] = [];
  const issue = signal.kind === 'ISSUE';
  const tone: 'good' | 'bad' = issue ? 'bad' : 'good';

  out.push({
    key: 'share',
    label: t('focus.chip.share', { share: signal.share }),
    // One sentence, one key. "34 of 87 feedback entries mention slow service."
    // used to be built by dropping a count into the middle of another phrase;
    // Hindi and Marathi put the total first, so the whole line is the phrase.
    detail: t.plural('focus.proof.share.detail', signal.evidenceTotal, {
      mentions: signal.evidenceCount,
      theme: spoken(signal.themeLabel),
    }),
    tone,
    quotes: quotesFor(evidence, signal.themeKey, { limit: 3 }),
    seeAll: {
      label: t.plural('focus.proof.share.seeAll', signal.evidenceCount),
      href: reviewsHref(basePath, signal.themeKey),
    },
    population: null,
    comparison: null,
  });

  if (signal.outcome) {
    const chip = outcomeChip(signal.outcome, t);
    const action = view.actions.find((a) => a.themeKey === signal.themeKey && a.outcome) ?? null;
    const population = populationFrom(signal.outcome, action, t);
    out.push({
      key: 'outcome',
      label: chip.label,
      detail:
        population
          ? t('focus.proof.outcome.detail', {
              before: population.before.share,
              after: population.after.share,
            })
          : signal.outcome.headline,
      tone: chip.tone,
      quotes: [],
      seeAll: null,
      population,
      comparison: null,
    });
  } else {
    const chip = movementChip(signal, t);
    if (chip) {
      out.push({
        key: 'movement',
        label: chip.label,
        detail: signal.movementLine ?? signal.movementBrief,
        tone: chip.tone,
        quotes: [],
        seeAll: null,
        population: null,
        comparison: signal.movementCounts
          ? t('focus.proof.movement.comparison', { counts: signal.movementCounts })
          : null,
      });
    }
  }

  const recurrence = recurrenceChip(signal, t);
  if (recurrence && signal.recurrence) {
    out.push({
      key: 'recurrence',
      label: recurrence,
      detail: signal.recurrence,
      tone: signal.isRecurring ? tone : 'neutral',
      quotes: [],
      seeAll: null,
      population: null,
      comparison: null,
    });
  } else if (issue) {
    const rated = view.soFar.rated.find((d) => d.themeKey === signal.themeKey);
    if (rated && rated.rated > 0) {
      out.push({
        key: 'rated',
        label: t.plural('focus.chip.rated', rated.rated, { average: rated.average.toFixed(1) }),
        detail: t.plural('focus.proof.rated.detail', rated.rated, {
          low: rated.low,
          theme: spoken(rated.label),
        }),
        tone: rated.low >= 3 ? 'bad' : 'neutral',
        quotes: [],
        seeAll: null,
        population: null,
        comparison: null,
      });
    }
  }

  return out.slice(0, 3);
}

// ---------------------------------------------------------------------------
// The headline, the synthesis, the next step
// ---------------------------------------------------------------------------

function headlineFor(
  top: ResponsibilityItem | null,
  r: Responsibility,
  view: PortalView,
  t: PortalTranslator,
): string {
  if (view.basedOn === 0) {
    return view.soFar.waiting > 0
      ? t('focus.headline.reading')
      : t('focus.headline.none');
  }
  if (r.state === 'WAITING_FOR_EVIDENCE' && !top) {
    return t('focus.headline.tooEarly');
  }
  if (top) {
    if (top.themeLabel && top.state === 'DO_NOW') {
      // "worth your attention" is a phrase from a report, not from a person.
      // An owner wants to be told what to fix.
      return top.kind === 'ISSUE'
        ? t('focus.headline.fix', { theme: top.themeLabel })
        : t('focus.headline.look', { theme: top.themeLabel });
    }
    return top.headline;
  }
  return t('focus.headline.nothing');
}

function synthesisFor(
  top: ResponsibilityItem | null,
  view: PortalView,
  t: PortalTranslator,
): string | null {
  const keep = view.keep;
  const issue = top?.themeKey && top.kind === 'ISSUE' ? signalFor(view, top.themeKey) : null;

  if (view.basedOn === 0) return null;

  if (issue) {
    // Its own sentence, not a clause hung off the end of the previous one.
    // ", and it has come up more since your change" asked the reader to hold
    // two thoughts at once; two short sentences ask nothing.
    const why =
      issue.outcome?.result === 'WORSENED'
        ? ` ${t('focus.why.change.worsened')}`
        : issue.outcome?.result === 'IMPROVED'
          ? ` ${t('focus.why.change.improved')}`
          : issue.movementDirection === 'WORSENING'
            ? ` ${t('focus.why.movement.worsening')}`
            : issue.movementDirection === 'IMPROVING'
              ? ` ${t('focus.why.movement.improving')}`
              : '';
    // Not a verb dropped into a hole: two whole sentences, because the verb
    // that ends the English clause sits somewhere else in Hindi and Marathi.
    const keeps = issue.isRecurring || issue.movementDirection === 'WORSENING';
    if (keep && keep.themeKey !== issue.themeKey) {
      // Was: "Customers are not unhappy about your food taste and quality."
      // Saying a good thing with two negatives is the worst habit this pass
      // exists to remove.
      const strength = t('focus.why.keep', {
        theme: spoken(keep.themeLabel),
        count: keep.evidenceCount,
      });
      const problem = keeps
        ? t('focus.why.main.keepMentioning', { theme: spoken(issue.themeLabel) })
        : t('focus.why.main.mention', { theme: spoken(issue.themeLabel) });
      return `${strength} ${problem}${why}`;
    }
    const problem = keeps
      ? t('focus.why.mainCustomers.keepMentioning', { theme: spoken(issue.themeLabel) })
      : t('focus.why.mainCustomers.mention', { theme: spoken(issue.themeLabel) });
    return `${t('focus.why.noStrength')} ${problem}${why}`;
  }

  if (top && !top.themeKey) {
    return top.whyItMatters;
  }

  if (top?.themeKey && top.kind === 'PRAISE') {
    return top.whyItMatters;
  }

  if (top?.themeKey) {
    // A follow-up on an agreed change: the theme's own reading says why.
    const s = signalFor(view, top.themeKey);
    return s ? s.brief : top.whyItMatters;
  }

  const praised = keep
    ? t.plural('focus.synthesis.praiseMost', keep.evidenceTotal, {
        theme: spoken(keep.themeLabel),
        mentions: keep.evidenceCount,
      })
    : null;

  const eased = view.first && view.first.outcome?.result === 'IMPROVED' ? view.first : null;
  if (praised && eased) {
    return `${praised} ${t('focus.synthesis.stillEased', { theme: spoken(eased.themeLabel) })}`;
  }
  if (praised && view.first) {
    return `${praised} ${t('focus.synthesis.stillMention', { theme: spoken(view.first.themeLabel) })} ${t('focus.synthesis.watching')}`;
  }
  if (praised) {
    return `${praised} ${t('focus.synthesis.nothingElse')}`;
  }
  if (view.basedOn > 0 && view.unhappy.length === 0 && view.loved.length === 0) {
    return t('focus.synthesis.noPattern');
  }
  return null;
}

function nextFor(
  top: ResponsibilityItem | null,
  view: PortalView,
  t: PortalTranslator,
): FocusNext | null {
  if (view.basedOn === 0) return null;
  const signal = top?.themeKey ? signalFor(view, top.themeKey) : null;
  // What Headway suggested at the time, frozen on the action; the pack's
  // current wording only where nothing was ever suggested.
  const frozen = signal
    ? (view.actions.find((a) => a.themeKey === signal.themeKey && a.stage === 'CHECKED')?.suggested ?? null)
    : null;
  const suggestion = frozen ?? signal?.suggestion ?? null;

  if (top && signal && top.kind === 'ISSUE') {
    const outcome = signal.outcome;
    if (top.state === 'DO_NOW' && outcome?.result === 'WORSENED') {
      return {
        headline: t('focus.next.undo'),
        detail: suggestion ? t('focus.next.suggestionStands', { suggestion }) : null,
        why: [outcome.headline, outcome.caveat || outcome.note],
        watching: signal.watchLine,
      };
    }
    if (top.state === 'DO_NOW' && signal.returning) {
      return {
        headline: t('focus.next.returning'),
        detail: suggestion ? t('focus.next.originalSuggestion', { suggestion }) : null,
        why: [signal.brief],
        watching: signal.watchLine,
      };
    }
    if (top.state === 'DO_NOW' && signal.advice === 'HOLD') {
      return {
        headline: t('focus.next.hold'),
        detail: signal.suggestion
          ? t('focus.next.holdDetail', { suggestion: signal.suggestion })
          : null,
        why: [signal.brief, ...signal.why.slice(0, 1)],
        watching: signal.watchLine,
      };
    }
    if (top.state === 'DO_NOW') {
      return {
        headline: signal.suggestion ?? t('focus.next.decide'),
        detail: signal.suggestionNote,
        why: [signal.brief, ...signal.why.slice(0, 1)],
        watching: signal.watchLine,
      };
    }
    // FOLLOW_UP: the loop's own next move.
    return {
      headline: top.recommendedNextStep,
      detail: signal.actionLine,
      why: top.reasons.map((x) => x.reason).slice(0, 2),
      watching: signal.watchLine,
    };
  }

  if (top) {
    return {
      headline: top.recommendedNextStep,
      detail: null,
      why: top.reasons.map((x) => x.reason).slice(0, 2),
      watching: top.watching,
    };
  }

  const keep = view.keep;
  if (keep) {
    return {
      headline: t('focus.next.keepDoing', { theme: spoken(keep.themeLabel) }),
      detail: null,
      why: [keep.brief],
      watching: keep.watchLine,
    };
  }
  return null;
}

export function buildFocus(input: FocusInput): Focus {
  const { responsibility: r, view, evidence, basePath } = input;
  const t = input.t ?? EN;
  const top = r.needsYou[0] ?? null;
  // With nothing needing the owner, the evidence worth showing is the leading
  // complaint's own state — eased after a change, or simply carried.
  const signal = top?.themeKey
    ? signalFor(view, top.themeKey)
    : top
      ? null
      : view.first && view.first.outcome
        ? view.first
        : null;

  const theme = signal
    ? { key: signal.themeKey, label: signal.themeLabel, kind: signal.kind }
    : null;

  const proofs = signal ? proofsFor(signal, view, evidence, basePath, t) : [];

  // The button is the way to the whole reading of the theme on Customers, and
  // it says so: the instruction itself is the next step, two lines up.
  const cta = signal
    ? {
        label: top
          ? t('focus.cta.seeEverything', { theme: spoken(signal.themeLabel) })
          : t('focus.cta.whatChanged'),
        href: signalHref(basePath, signal.themeKey),
      }
    : top
      ? { label: t('focus.cta.needsReply'), href: `${basePath}/reviews?needs=reply` }
      : view.keep
        ? { label: t('focus.cta.goingWell'), href: signalHref(basePath, view.keep.themeKey) }
        : null;

  return {
    mood: view.mood,
    state: r.state,
    headline: headlineFor(top, r, view, t),
    basis: view.basis,
    theme,
    proofs,
    cta,
    synthesis: synthesisFor(top, view, t),
    next: nextFor(top, view, t),
  };
}

// ---------------------------------------------------------------------------
// The check-in, in one sentence
// ---------------------------------------------------------------------------

/**
 * "No", "One", "Two" … as dictionary keys rather than an English array.
 *
 * A spelled-out count is a number the reader has to be able to read, so it is
 * looked up like any other phrase and then interpolated like any other figure.
 * Index 0 exists to keep the array aligned with the count; the callers below
 * all take the "nothing" sentence before they reach it.
 */
const COUNT_WORDS = [
  'focus.count.0',
  'focus.count.1',
  'focus.count.2',
  'focus.count.3',
  'focus.count.4',
  'focus.count.5',
  'focus.count.6',
  'focus.count.7',
  'focus.count.8',
  'focus.count.9',
] as const;

function countWord(n: number, t: PortalTranslator): string {
  const key = COUNT_WORDS[n];
  return key ? t(key) : String(n);
}

export type CheckinBlock = {
  kind: 'DO' | 'PROTECT' | 'WATCH';
  label: string;
  item: ResponsibilityItem;
  signal: PortalSignal | null;
};

export type CheckinPulse = {
  /** "One thing needs your attention. Two things need watching. Four things are about the same." */
  sentence: string;
  blocks: CheckinBlock[];
};

/**
 * The whole check-in above the fold: three counts in one sentence, and the
 * three blocks an owner leaves with.
 *
 * The block labels stay English here and are not read by the portal: the
 * check-in page looks each one up from `checkin.block.*` by the block's kind,
 * so the word an owner sees is already in their language.
 */
export function checkinPulse(
  r: Responsibility,
  view: PortalView,
  compared: boolean,
  translator?: PortalTranslator,
): CheckinPulse {
  const t = translator ?? EN;
  const needs = r.needsYou.length;
  const watching = r.watching.filter((i) => i.state === 'WATCH').length;
  const steady = compared ? view.steady.length : 0;

  const parts: string[] = [];
  parts.push(
    needs === 0
      ? t('focus.pulse.attention.none')
      : t.plural('focus.pulse.attention', needs, { word: countWord(needs, t) }),
  );
  if (watching > 0) {
    parts.push(t.plural('focus.pulse.watching', watching, { word: countWord(watching, t) }));
  }
  if (compared) {
    parts.push(
      steady === 0
        ? t('focus.pulse.steady.none')
        : t.plural('focus.pulse.steady', steady, { word: countWord(steady, t) }),
    );
  } else if (view.basedOn > 0) {
    parts.push(t('focus.pulse.secondCheckin'));
  }

  const blocks: CheckinBlock[] = [];
  const act = r.needsYou[0] ?? null;
  if (act) blocks.push({ kind: 'DO', label: 'Do', item: act, signal: signalFor(view, act.themeKey) });
  const protect = r.watching.find((i) => i.state === 'KEEP_DOING') ?? null;
  if (protect) {
    blocks.push({ kind: 'PROTECT', label: 'Protect', item: protect, signal: signalFor(view, protect.themeKey) });
  }
  const watch = r.watching.find((i) => i.state === 'WATCH') ?? r.watching.find((i) => i.state === 'WAITING_FOR_EVIDENCE') ?? null;
  if (watch) blocks.push({ kind: 'WATCH', label: 'Watch', item: watch, signal: signalFor(view, watch.themeKey) });

  return { sentence: parts.join(' '), blocks };
}

// ---------------------------------------------------------------------------
// Account: what Headway has done, as four facts
// ---------------------------------------------------------------------------

export type ActivityFact = { label: string; value: string; href: string | null };

/**
 * The owner's activity, counted from what the pages already state. Every
 * figure is one the workspace shows elsewhere; nothing is invented to fill a
 * row, and the section is empty rather than padded when nothing has arrived.
 */
export function activityFacts(
  view: PortalView,
  r: Responsibility,
  basePath: string,
  translator?: PortalTranslator,
): ActivityFact[] {
  const t = translator ?? EN;
  const collected = view.soFar.read + view.soFar.waiting;
  if (collected === 0) return [];
  const signals = view.loved.length + view.unhappy.length;
  const issues = r.needsYou.filter((i) => i.kind === 'ISSUE').length;
  const checked = view.actions.filter((a) => a.stage === 'CHECKED').length;
  const inProgress = view.actions.filter((a) => a.stage === 'AGREED' || a.stage === 'DONE').length;

  const facts: ActivityFact[] = [
    { label: t('focus.activity.read'), value: String(view.basedOn), href: `${basePath}/reviews` },
    {
      label: t('focus.activity.recurring'),
      value: String(signals),
      href: signals > 0 ? `${basePath}/analysis` : null,
    },
    {
      label: t.plural('focus.activity.problems', issues),
      value: String(issues),
      href: issues > 0 ? basePath : null,
    },
  ];
  if (checked + inProgress > 0) {
    facts.push({
      label:
        checked > 0
          ? t.plural('focus.activity.compared', checked)
          : t.plural('focus.activity.checking', inProgress),
      value: String(checked > 0 ? checked : inProgress),
      href: `${basePath}/improvements`,
    });
  }
  return facts;
}

/** "ends 21 Sep 2026" for the service section. */
export function trialLine(
  trialEndsAt: Date | null,
  days: number | null,
  translator?: PortalTranslator,
): string | null {
  const t = translator ?? EN;
  if (!trialEndsAt) return null;
  const when = formatDate(trialEndsAt);
  if (days === null) return t('focus.trial.ends', { date: when });
  if (days < 0) return t('focus.trial.ended', { date: when });
  return t('focus.trial.ends', { date: when });
}
