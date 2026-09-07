import type {
  Responsibility,
  ResponsibilityItem,
  ResponsibilityState,
} from '@/lib/responsibility/engine';
import type { PortalMood, PortalOutcome, PortalSignal, PortalView } from '@/lib/portal/view';
import { pieces, spoken } from '@/lib/portal/view';
import { quotesFor, type EvidenceIndex, type Quote } from './evidence';
import { formatDate } from '@/lib/format';

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
 *   SEE          "Slow service is the one thing worth your attention."
 *   UNDERSTAND   "Customers are not unhappy about the food. What they keep
 *                 raising is slow service."
 *   EVIDENCE     39% of feedback → 34 of 87, three customers in their words
 *                Worse after your change → 32% before, 47% after
 *                At both recent check-ins → raised at 2 of your last 2
 *   ACTION       "Check what else changed before undoing anything."
 *
 * It computes nothing new. The responsibility layer already decided what
 * needs the owner; the view already read every theme; the measurement engine
 * already compared before and after; the evidence index already holds the
 * rows. This chooses, orders and words. Pure: everything it needs is passed in.
 */

export type ProofPopulation = {
  before: { count: number; total: number; share: string; scope: string };
  after: { count: number; total: number; share: string; scope: string };
  /** "More often after the change". */
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
  /** The line that opens under it: "34 of 87 pieces of feedback mention it." */
  detail: string;
  tone: 'good' | 'bad' | 'neutral';
  /** For the share chip: three customers, in their words. */
  quotes: Quote[];
  /** "See all 34" → the filtered evidence. */
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
  /** WHAT HEADWAY WANTS YOU TO KNOW: one or two sentences, never a paragraph. */
  synthesis: string | null;
  /** SHOW ME THE EVIDENCE: the quotes behind the headline. */
  evidence: { quotes: Quote[]; count: number; total: number; href: string } | null;
  /** YOUR NEXT STEP. */
  next: FocusNext | null;
};

export type FocusInput = {
  responsibility: Responsibility;
  view: PortalView;
  evidence: EvidenceIndex;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
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

function outcomeReading(outcome: PortalOutcome): { reading: string; tone: 'good' | 'bad' | 'neutral' } {
  switch (outcome.result) {
    case 'IMPROVED':
      return { reading: 'Less often after the change', tone: 'good' };
    case 'WORSENED':
      return { reading: 'More often after the change', tone: 'bad' };
    case 'NO_CLEAR_CHANGE':
      return { reading: 'No clear change after the change', tone: 'neutral' };
    default:
      return { reading: 'Not enough feedback after the change', tone: 'neutral' };
  }
}

/** "32% → 47%" as two piles, from the measurement the engine froze. */
export function populationFrom(
  outcome: PortalOutcome,
  action: PortalView['actions'][number] | null,
): ProofPopulation | null {
  const before = parseLine(outcome.beforeLine);
  const after = parseLine(outcome.afterLine);
  if (!before || !after || !outcome.beforeShare || !outcome.afterShare) return null;
  const { reading, tone } = outcomeReading(outcome);
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

/** "14 of 44 reviews (32%)" → 14 and 44. The engine's own line, not a recount. */
function parseLine(line: string): { count: number; total: number } | null {
  const m = /^(\d+) of (\d+)\b/.exec(line.trim());
  if (!m) return null;
  return { count: Number(m[1]), total: Number(m[2]) };
}

function outcomeChip(outcome: PortalOutcome): { label: string; tone: 'good' | 'bad' | 'neutral' } {
  switch (outcome.result) {
    case 'IMPROVED':
      return { label: 'Less often after your change', tone: 'good' };
    case 'WORSENED':
      return { label: 'More often after your change', tone: 'bad' };
    case 'NO_CLEAR_CHANGE':
      return { label: 'About the same after your change', tone: 'neutral' };
    default:
      return { label: 'Too early to compare', tone: 'neutral' };
  }
}

/** "Raised at 2 of your last 2 check-ins." → "At both recent check-ins". */
function recurrenceChip(signal: PortalSignal): string | null {
  const m = /at (\d+) of your last (\d+) check-ins/i.exec(signal.recurrence ?? '');
  if (m) {
    const [, raised, of] = m;
    if (raised === of && of === '2') return 'At both recent check-ins';
    return `At ${raised} of your last ${of} check-ins`;
  }
  if (signal.isNew) return 'New at your latest check-in';
  return null;
}

function movementChip(signal: PortalSignal): { label: string; tone: 'good' | 'bad' | 'neutral' } | null {
  const d = signal.movementDirection;
  if (!d) return null;
  const issue = signal.kind === 'ISSUE';
  if (d === 'STABLE') return { label: 'Steady across your check-ins', tone: 'neutral' };
  const rose = issue ? d === 'WORSENING' : d === 'IMPROVING';
  const good = d === 'IMPROVING';
  return {
    label: rose ? 'More at your latest check-in' : 'Less at your latest check-in',
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
): FocusProof[] {
  const out: FocusProof[] = [];
  const issue = signal.kind === 'ISSUE';
  const tone: 'good' | 'bad' = issue ? 'bad' : 'good';

  out.push({
    key: 'share',
    label: `${signal.share} of feedback`,
    detail: `${signal.evidenceCount} of the ${pieces(signal.evidenceTotal)} Headway has read mention it.`,
    tone,
    quotes: quotesFor(evidence, signal.themeKey, { limit: 3 }),
    seeAll: {
      label: `See all ${signal.evidenceCount}`,
      href: reviewsHref(basePath, signal.themeKey),
    },
    population: null,
    comparison: null,
  });

  if (signal.outcome) {
    const chip = outcomeChip(signal.outcome);
    const action = view.actions.find((a) => a.themeKey === signal.themeKey && a.outcome) ?? null;
    const population = populationFrom(signal.outcome, action);
    out.push({
      key: 'outcome',
      label: chip.label,
      detail:
        population
          ? `${population.before.share} of feedback before the change, ${population.after.share} after.`
          : signal.outcome.headline,
      tone: chip.tone,
      quotes: [],
      seeAll: null,
      population,
      comparison: null,
    });
  } else {
    const chip = movementChip(signal);
    if (chip) {
      out.push({
        key: 'movement',
        label: chip.label,
        detail: signal.movementLine ?? signal.movementBrief,
        tone: chip.tone,
        quotes: [],
        seeAll: null,
        population: null,
        comparison: signal.movementCounts ? `${signal.movementCounts} at your last two check-ins` : null,
      });
    }
  }

  const recurrence = recurrenceChip(signal);
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
        label: `Rated ${rated.average.toFixed(1)}/5 by ${rated.rated}`,
        detail: `${rated.low} of the ${rated.rated} customers who rated ${spoken(rated.label)} on your feedback page put it at 3 or below.`,
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
): string {
  if (view.basedOn === 0) {
    return view.soFar.waiting > 0
      ? 'Feedback has arrived. Headway is reading it now.'
      : 'No customer feedback yet.';
  }
  if (r.state === 'WAITING_FOR_EVIDENCE' && !top) {
    return `Still early days — ${pieces(view.basedOn)} read.`;
  }
  if (top) {
    if (top.themeLabel && top.state === 'DO_NOW') {
      return `${top.themeLabel} is the one thing worth your attention.`;
    }
    return top.headline;
  }
  return 'Nothing needs you right now.';
}

function synthesisFor(top: ResponsibilityItem | null, view: PortalView): string | null {
  const keep = view.keep;
  const issue = top?.themeKey && top.kind === 'ISSUE' ? signalFor(view, top.themeKey) : null;

  if (view.basedOn === 0) return null;

  if (issue) {
    const why =
      issue.outcome?.result === 'WORSENED'
        ? ', and it has come up more since your change'
        : issue.outcome?.result === 'IMPROVED'
          ? ', though less often since your change'
          : issue.movementDirection === 'WORSENING'
            ? ', and it came up more at your latest check-in'
            : issue.movementDirection === 'IMPROVING'
              ? ', though it came up less at your latest check-in'
              : '';
    const verb = issue.isRecurring || issue.movementDirection === 'WORSENING' ? 'keep raising' : 'raise most';
    if (keep && keep.themeKey !== issue.themeKey) {
      return `Customers are not unhappy about your ${spoken(keep.themeLabel)} — ${keep.evidenceCount} praised it. What they ${verb} is ${spoken(issue.themeLabel)}${why}.`;
    }
    return `Nothing is praised often enough yet to call a strength. What customers ${verb} is ${spoken(issue.themeLabel)}${why}.`;
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

  const eased = view.first && view.first.outcome?.result === 'IMPROVED' ? view.first : null;
  if (keep && eased) {
    return `Customers praise your ${spoken(keep.themeLabel)} most — ${keep.evidenceCount} of the ${pieces(keep.evidenceTotal)} read. ${eased.themeLabel} is still mentioned, but it has come up less often since your change.`;
  }
  if (keep && view.first) {
    return `Customers praise your ${spoken(keep.themeLabel)} most — ${keep.evidenceCount} of the ${pieces(keep.evidenceTotal)} read. ${view.first.themeLabel} is still mentioned; Headway is watching it and will say if it needs you.`;
  }
  if (keep) {
    return `Customers praise your ${spoken(keep.themeLabel)} most — ${keep.evidenceCount} of the ${pieces(keep.evidenceTotal)} read. Nothing is coming up often enough to call a weakness.`;
  }
  if (view.basedOn > 0 && view.unhappy.length === 0 && view.loved.length === 0) {
    return 'Nothing has been said often enough yet for Headway to call it a pattern.';
  }
  return null;
}

function nextFor(top: ResponsibilityItem | null, view: PortalView): FocusNext | null {
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
        headline: 'Check what else changed before undoing anything.',
        detail: suggestion ? `The original suggestion still stands: ${suggestion}` : null,
        why: [outcome.headline, outcome.caveat || outcome.note],
        watching: signal.watchLine,
      };
    }
    if (top.state === 'DO_NOW' && signal.returning) {
      return {
        headline: 'Check whether the earlier conditions have returned before making another change.',
        detail: suggestion ? `The original suggestion: ${suggestion}` : null,
        why: [signal.brief],
        watching: signal.watchLine,
      };
    }
    if (top.state === 'DO_NOW' && signal.advice === 'HOLD') {
      return {
        headline: 'Decide whether to act now or wait: it is coming up less on its own.',
        detail: signal.suggestion ? `If it climbs again, start here: ${signal.suggestion}` : null,
        why: [signal.brief, ...signal.why.slice(0, 1)],
        watching: signal.watchLine,
      };
    }
    if (top.state === 'DO_NOW') {
      return {
        headline: signal.suggestion ?? 'Decide what to change, and tell your Headway contact.',
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
      headline: `Nothing to do. Keep doing what customers describe under ${spoken(keep.themeLabel)}.`,
      detail: null,
      why: [keep.brief],
      watching: keep.watchLine,
    };
  }
  return null;
}

export function buildFocus(input: FocusInput): Focus {
  const { responsibility: r, view, evidence, basePath } = input;
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

  const proofs = signal ? proofsFor(signal, view, evidence, basePath) : [];

  const cta = signal
    ? { label: top ? 'Look at this first' : 'See what changed', href: signalHref(basePath, signal.themeKey) }
    : top
      ? { label: 'Read the comments that need you', href: `${basePath}/reviews?needs=reply` }
      : view.keep
        ? { label: 'See what is going well', href: signalHref(basePath, view.keep.themeKey) }
        : null;

  const share = proofs.find((p) => p.key === 'share');
  const evidenceBlock =
    signal && share
      ? {
          quotes: share.quotes,
          count: signal.evidenceCount,
          total: signal.evidenceTotal,
          href: reviewsHref(basePath, signal.themeKey),
        }
      : null;

  return {
    mood: view.mood,
    state: r.state,
    headline: headlineFor(top, r, view),
    basis: view.basis,
    theme,
    proofs,
    cta,
    synthesis: synthesisFor(top, view),
    evidence: evidenceBlock,
    next: nextFor(top, view),
  };
}

// ---------------------------------------------------------------------------
// The check-in, in one sentence
// ---------------------------------------------------------------------------

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}

function things(n: number, singular: string, plural: string): string {
  return `${countWord(n)} ${n === 1 ? singular : plural}`;
}

export type CheckinBlock = {
  kind: 'DO' | 'PROTECT' | 'WATCH';
  label: string;
  item: ResponsibilityItem;
  signal: PortalSignal | null;
};

export type CheckinPulse = {
  /** "One thing needs you. Two things need watching. Four things are holding steady." */
  sentence: string;
  blocks: CheckinBlock[];
};

/**
 * The whole check-in above the fold: three counts in one sentence, and the
 * three blocks an owner leaves with.
 */
export function checkinPulse(r: Responsibility, view: PortalView, compared: boolean): CheckinPulse {
  const needs = r.needsYou.length;
  const watching = r.watching.filter((i) => i.state === 'WATCH').length;
  const steady = compared ? view.steady.length : 0;

  const parts: string[] = [];
  parts.push(needs === 0 ? 'Nothing needs you.' : `${things(needs, 'thing needs', 'things need')} you.`);
  if (watching > 0) parts.push(`${things(watching, 'thing needs', 'things need')} watching.`);
  if (compared) {
    parts.push(
      steady === 0
        ? 'Nothing is holding steady.'
        : `${things(steady, 'thing is', 'things are')} holding steady.`,
    );
  } else if (view.basedOn > 0) {
    parts.push('A second check-in will show what is holding steady.');
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
export function activityFacts(view: PortalView, r: Responsibility, basePath: string): ActivityFact[] {
  const collected = view.soFar.read + view.soFar.waiting;
  if (collected === 0) return [];
  const signals = view.loved.length + view.unhappy.length;
  const issues = r.needsYou.filter((i) => i.kind === 'ISSUE').length;
  const checked = view.actions.filter((a) => a.stage === 'CHECKED').length;
  const inProgress = view.actions.filter((a) => a.stage === 'AGREED' || a.stage === 'DONE').length;

  const facts: ActivityFact[] = [
    { label: 'Pieces of feedback read', value: String(view.basedOn), href: `${basePath}/reviews` },
    {
      label: 'Recurring signals',
      value: String(signals),
      href: signals > 0 ? `${basePath}/analysis` : null,
    },
    {
      label: issues === 1 ? 'Active issue' : 'Active issues',
      value: String(issues),
      href: issues > 0 ? basePath : null,
    },
  ];
  if (checked + inProgress > 0) {
    facts.push({
      label: checked > 0 ? (checked === 1 ? 'Improvement compared' : 'Improvements compared') : 'Improvements being checked',
      value: String(checked > 0 ? checked : inProgress),
      href: `${basePath}/improvements`,
    });
  }
  return facts;
}

/** "ends 21 Sep 2026" for the service section. */
export function trialLine(trialEndsAt: Date | null, days: number | null): string | null {
  if (!trialEndsAt) return null;
  const when = formatDate(trialEndsAt);
  if (days === null) return `Ends ${when}`;
  if (days < 0) return `Ended ${when}`;
  return `Ends ${when}`;
}
