import type { EvidenceIndex, Quote } from './evidence';
import { quotesFor } from './evidence';
import type { PortalAction, PortalActionState, PortalSignal, PortalView } from './view';
import type { SinceLastVisit } from '@/lib/retention/service';
import type { ActionStatus } from '@/lib/improve/model';
import type { Responsibility } from '@/lib/responsibility/engine';
import type { AnalysisCoverage } from '@/lib/feedback/analysis';
import { EN } from '@/lib/i18n/translator';
import type { PortalTranslator } from '@/lib/i18n/translator';

/**
 * THE OWNER'S BRIEF — what Home says in the first ten seconds (mobile pass).
 *
 * The workspace could already answer every question an owner has. It answered
 * them in the order the SOFTWARE discovered them: a conclusion, then the
 * method behind the conclusion, then the evidence behind the method. An owner
 * standing behind a counter reads the first line and leaves, so everything
 * after the first line was, in practice, not read at all.
 *
 * So this builder reorders the same judgements — it makes none of its own —
 * into the four things a person actually wants off a phone:
 *
 *   TODAY            how much came in, and how it split
 *   NEEDS ATTENTION  the one strongest problem, with what to do about it
 *   CUSTOMERS LIKE   the one strongest thing to protect
 *   WHAT CHANGED     movement, as short lines
 *
 * NOTHING HERE IS A NEW READING. Every count, sentence and direction is
 * carried across from `buildPortalView` and `buildResponsibility`, which are
 * the only two places in this product allowed to decide what feedback means.
 * If a number appears here it appeared there first. That is the rule that
 * keeps a presentation pass from quietly becoming a second analytics engine
 * disagreeing with the first.
 *
 * PURE, AND HANDED ITS LANGUAGE. Same contract as `buildFocus` next door: no
 * database, no clock, no locale lookup. A test can build one from fixtures and
 * a page can build one from a request, and they get the same brief.
 */

/**
 * HOW THE READ PILE SPLITS — happy, mixed, unhappy.
 *
 * Three counts, nothing else. An owner could read "87 feedback entries" on
 * every page of this product and still not know whether 87 was good news. It
 * is the first thing a person asks about a pile of feedback and it was the one
 * thing the pages never said.
 *
 * COUNTED OVER THE LIVE PILE, NOT OVER THE LAST CHECK-IN. The health card has
 * carried a `distribution` since M8 and it was the obvious place to get this —
 * but it summarises the feedback attached to the LATEST SNAPSHOT, while the
 * figure beside it on screen ("87 read") is the whole analysed history. Wiring
 * the strip to it put three counts under a headline they did not add up to,
 * which is the fastest way to teach an owner that the numbers here cannot be
 * trusted. `AnalysisCoverage` counts the same rows the headline counts.
 *
 * NEUTRAL IS FOLDED INTO MIXED on purpose. Four buckets is a chart; three is a
 * sentence. An owner acts the same way on "neutral" as on "mixed" — neither is
 * a complaint and neither is praise — so splitting them buys a bar segment and
 * costs a decision. UNKNOWN is left out entirely: it is a reading that did not
 * land, not a thing a customer felt.
 *
 * Counts, never shares. A share of nine feedback entries is a number that
 * looks like a finding and is not one.
 */
export type BriefMix = {
  happy: number;
  mixed: number;
  unhappy: number;
  /** The three added up: the pile these counts describe. */
  read: number;
};

/** Which way a count moved between the last two check-ins, when it could be read. */
export type BriefTrend = {
  /** "↑" / "↓" / "→" — the mark, chosen from direction and never from words. */
  mark: '↑' | '↓' | '→';
  /** "More than last check-in" — the engine's own comparison, short. */
  label: string;
  /**
   * "6 → 9 mentions" at the last two check-ins, when the engine could read
   * both. Already written in the owner's language by the intelligence engine.
   * Counts, never a percentage: a share of nine is a finding that is not one.
   */
  counts: string | null;
  /**
   * Whether this movement is good news for the owner.
   *
   * NOT the same as the direction. Complaints going up is `bad`; praise going
   * up is `good`. The mark says which way, the tone says whether to worry, and
   * conflating the two is how a product ends up drawing a rising complaint in
   * green.
   */
  tone: 'good' | 'bad' | 'neutral';
};

/** One thing worth a line on the brief, in the order a person reads a decision. */
export type BriefCard = {
  themeKey: string;
  /** "Waiting time" — the pack's own label, as the rest of the product says it. */
  label: string;
  /** PATTERN → MAGNITUDE: how many feedback entries mention it. */
  count: number;
  /** "18 of 87" — the count against the pile it came from. */
  basis: string;
  /** CHANGE: movement between the last two check-ins, when there was one to read. */
  trend: BriefTrend | null;
  /** One short sentence: what customers are saying. Never a paragraph. */
  line: string;
  /**
   * WHAT THIS MEANS — one concrete fact behind the line, or nothing.
   *
   * Only ever something the product actually recorded: the specific that
   * unhappy customers tapped most on the feedback page, or how many check-ins
   * in a row it has come up. Never an inference such as "mostly at lunch",
   * which Headway has no data to support — a made-up reason is worse than
   * none, because the owner will act on it.
   */
  meaning: string | null;
  /** ACTION: the single next move, in the engine's words. */
  action: string | null;
  /** Where the count and the button go: the feedback entries this counts. */
  href: string;
  /** EVIDENCE: two or three customers, in their own words. */
  quotes: Quote[];
  /**
   * WHERE THE LOOP STANDS on this theme, and what the owner may do next.
   *
   * `actionId` is the loop's own id, null until somebody decides something.
   * The theme it is about is `themeKey` on the card, which is what opens a
   * loop that does not exist yet — never an insight id, which carries tool
   * vocabulary the portal may not show. `state` is the same
   * `PortalActionState` every other page reads, so the brief cannot disagree
   * with the action centre about what has been decided.
   *
   * `line` is what to say when there is nothing to press: an action already
   * measured, or one the owner declined. A dead button would be worse than a
   * sentence, and silence would be worse than either.
   */
  loop: {
    actionId: string | null;
    /** The loop's own status, which is what decides the legal buttons. */
    status: ActionStatus | null;
    state: PortalActionState;
    /** One line naming the state, when the state is worth naming. */
    line: string | null;
  };
};

/** One topic that moved between the last two check-ins. */
export type BriefMove = {
  key: string;
  label: string;
  /** "24 → 39 mentions", written by the engine; null when it could not count both. */
  counts: string | null;
  line: string;
  /** Good or bad news for the owner. */
  tone: 'good' | 'bad';
  kind: 'ISSUE' | 'PRAISE';
};

/** One change the owner made, and what customers did afterward. */
export type BriefChange = {
  key: string;
  about: string;
  /**
   * Where it stands. BETTER/WORSE/NO_CHANGE/NOT_ENOUGH are the measurement
   * engine's own verdicts; WATCHING means the change was made and Headway is
   * still collecting the feedback that follows it.
   */
  state: 'BETTER' | 'WORSE' | 'NO_CHANGE' | 'NOT_ENOUGH' | 'WATCHING';
  /** "18/30" before and "3/30" after, once measured. */
  before: string | null;
  after: string | null;
  /** New feedback so far against what a check needs, while still watching. */
  awaiting: { have: number; need: number } | null;
};

/**
 * THE OWNER'S RECORD — what they changed, and what happened after.
 *
 * This is the legitimate reason to keep paying for Headway, so it is built
 * only from what the improvement loop actually stored: the changes marked
 * done, and the measurement engine's verdicts on them. No score, no money,
 * no streak. If nothing has been changed yet it does not exist, rather than
 * showing an empty shelf that looks like a failure.
 */
export type BriefMemory = {
  /** The three most recent changes, newest first. */
  recent: BriefChange[];
  /** The last thirty days, counted. Rolling rather than the calendar month,
   *  so the first of the month does not wipe the story. */
  last30: { made: number; better: number; watching: number };
  /**
   * The month's clearest result: the change measured in the last thirty days
   * after which the topic fell furthest, as the engine's own two counts.
   * Only a measured IMPROVED result qualifies — a change still being watched
   * has no result, and "biggest" is never claimed for a guess.
   */
  biggest: BriefChange | null;
};

export type Brief = {
  /**
   * Who this brief is for, and what Headway is doing for them — all of it
   * read from the business's own records, none of it invented.
   */
  header: {
    businessName: string;
    verticalLabel: string;
    /** Topics Headway is following for this business right now. */
    watching: number;
    /**
     * How many things the responsibility engine says need the owner now —
     * the band leads with this, because "1 thing needs your attention" is the
     * owner's question and "watching 7 topics" is Headway's.
     */
    needsYou: number;
    /** Feedback that arrived since this person last looked, when any did. */
    arrivedSinceVisit: number | null;
    /** Changes Headway checked while they were away — the reward, arriving. */
    checkedWhileAway: Array<{ id: string; title: string; better: boolean | null }>;
  };
  /** How much has been read, and how it split three ways. */
  mix: BriefMix;
  /** Arrived and still being read. Stated only when it is not zero. */
  waiting: number;
  /**
   * The one strongest current problem, when there is one.
   *
   * One, not a list. A phone screen that offers three problems has told the
   * owner to pick, which is the work they came here to have done for them.
   */
  attention: BriefCard | null;
  /** The one strongest thing customers like, when there is one. */
  loved: BriefCard | null;
  /**
   * Up to two more things going well (mobile polish pass), from the same
   * ranked pile and the same "going well" filter the Customers page uses —
   * so Home never calls something going well that Customers files elsewhere.
   */
  alsoLoved: BriefCard[];
  /**
   * What moved since the last check-in: one row per topic, at most three —
   * the topic's own name, the engine's two counts, and which kind of change
   * it is. `line` is the engine's sentence, kept for when there are no counts.
   */
  changed: BriefMove[];
  /** How many topics moved in all, of which `changed` shows three. */
  changedTotal: number;
  /**
   * True when there is feedback but nothing needs the owner.
   *
   * A tool that is willing to say "nothing needs you today" is a tool an
   * owner can trust on the days it says something does. Nothing here is
   * manufactured to fill the space.
   */
  calm: boolean;
  /** The owner's record of changes, when there is one. */
  memory: BriefMemory | null;
  /**
   * True when there is not yet enough feedback to say anything.
   *
   * The pages say so in their own words; the brief only reports the state, so
   * an empty first week renders as one honest line rather than four empty
   * headings.
   */
  tooEarly: boolean;
};

export type BriefInput = {
  view: PortalView;
  responsibility: Responsibility;
  evidence: EvidenceIndex;
  /**
   * How much of the pile has been read, and what each entry was read as.
   *
   * Passed in rather than taken off the view, because the view is built from
   * snapshots and this is the live pile — see the note on BriefMix. It comes
   * from `getAnalysisCoverage`, which reads the same request-cached ledger the
   * responsibility bundle already read, so asking for it costs no extra query.
   */
  coverage: AnalysisCoverage;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  /**
   * What happened while this person was away, when there is a person to
   * remember. Passed in, like everything else here: the builder reads no
   * database and no clock.
   */
  since?: SinceLastVisit | null;
  /** The moment the brief is for. Passed in so the builder has no clock. */
  now?: Date;
  t?: PortalTranslator;
};

/** How many customers stand for a theme on the brief. Two on a phone, never a wall. */
const QUOTES_ON_BRIEF = 2;

/**
 * The movement mark and whether it is good news.
 *
 * Read off `movementDirection`, which the intelligence engine set, and never
 * off `movementLine` — that sentence is translated, and a regex over it would
 * turn every arrow grey the moment an owner switched to Marathi. The product
 * has made this mistake before; see the notes in portal/history.ts.
 */
export function trendOf(signal: PortalSignal, t: PortalTranslator): BriefTrend | null {
  const direction = signal.movementDirection;
  if (direction === null) return null;
  if (direction === 'STABLE') {
    return { mark: '→', label: t('brief.trend.same'), counts: signal.movementCounts, tone: 'neutral' };
  }

  // THE ENGINE'S STATE IS GOOD-OR-BAD, NOT UP-OR-DOWN. `movementDirection`
  // comes from `intelligence/engine.ts`, which sets
  //   good = sentiment === 'ISSUE' ? !rose : rose
  //   state = good ? 'IMPROVING' : 'WORSENING'
  // so for PRAISE, IMPROVING means the count ROSE. The first version of this
  // function read the state as a direction, which drew praise that had fallen
  // as a green "↑ more than last check-in" — a false signal on the one screen
  // an owner trusts at a glance. The arrow is the count's direction; the tone
  // is whether that is good news. They are recovered separately here.
  const rose = signal.kind === 'ISSUE' ? direction === 'WORSENING' : direction === 'IMPROVING';
  return {
    mark: rose ? '↑' : '↓',
    // The words are the verdict an owner acts on — "Getting worse" for a
    // complaint that rose AND for praise that fell. The arrow beside them is
    // the count's own direction, so the two can never be confused.
    label: direction === 'IMPROVING' ? t('brief.trend.better') : t('brief.trend.worse'),
    counts: signal.movementCounts,
    tone: direction === 'IMPROVING' ? 'good' : 'bad',
  };
}

/**
 * One signal, as a card.
 *
 * `brief` is the engine's one-sentence reading of the theme and it is used
 * verbatim. The temptation here is to write a better sentence from the parts;
 * resisting it is what keeps the brief and the page it links to saying the
 * same thing.
 */
function cardFor(
  signal: PortalSignal,
  evidence: EvidenceIndex,
  basePath: string,
  t: PortalTranslator,
): BriefCard {
  const href = `${basePath}/reviews?theme=${encodeURIComponent(signal.themeKey)}`;
  return {
    themeKey: signal.themeKey,
    label: signal.themeLabel,
    count: signal.evidenceCount,
    basis: t('brief.basis', { count: signal.evidenceCount, total: signal.evidenceTotal }),
    trend: trendOf(signal, t),
    line: signal.brief,
    meaning: meaningOf(signal, t),
    // A problem carries the pack's suggestion; praise carries the next step,
    // which for something going well is "keep doing it". Either way one line.
    action: signal.kind === 'ISSUE' ? (signal.suggestion ?? signal.nextStep) : signal.nextStep,
    href,
    quotes: quotesFor(evidence, signal.themeKey, { limit: QUOTES_ON_BRIEF }),
    loop: {
      actionId: signal.actionId,
      status: signal.actionStatus,
      state: signal.actionState,
      line: loopLine(signal.actionState, t),
    },
  };
}

/**
 * One recorded fact that explains the line, or null.
 *
 * First choice is what customers themselves tapped: the specific picked most
 * often by those who rated this part of the visit low. It is their words, not
 * a reading of them. Second is how persistent it is, which the history
 * module already wrote as a sentence. Nothing else qualifies.
 */
function meaningOf(signal: PortalSignal, t: PortalTranslator): string | null {
  const top = signal.tapped?.specifics[0];
  if (top && top.count > 0) {
    return t.plural('brief.meaning.tapped', top.count, { specific: top.label });
  }
  return signal.recurrence;
}

/** The measurement engine's verdict, as the record's state. */
function changeState(a: PortalAction): BriefChange['state'] {
  switch (a.outcome?.result) {
    case 'IMPROVED':
      return 'BETTER';
    case 'WORSENED':
      return 'WORSE';
    case 'NO_CLEAR_CHANGE':
      return 'NO_CHANGE';
    case 'INSUFFICIENT_DATA':
      return 'NOT_ENOUGH';
    default:
      return 'WATCHING';
  }
}

const DAY = 86_400_000;

/**
 * The owner's record, from the changes they actually made.
 *
 * A change counts once it is DONE — agreed-but-not-made is a plan, not a
 * change, and declined is a decision not to. Newest first, by when Headway
 * last had news of it: the verdict if there is one, the change otherwise.
 */
function memoryOf(actions: PortalAction[], now: Date): BriefMemory | null {
  const made = actions.filter((a) => a.doneAt !== null && (a.stage === 'DONE' || a.stage === 'CHECKED'));
  if (made.length === 0) return null;

  const when = (a: PortalAction) => (a.measuredAt ?? a.doneAt ?? a.suggestedAt).getTime();
  const since = now.getTime() - 30 * DAY;

  // Ranked by how far the topic's share of feedback fell — each side over
  // its own pile, because the two piles are never the same size. The share is
  // only used to choose; the owner is shown the counts.
  const share = (count: number, total: number) => (total > 0 ? count / total : 0);
  const measuredBetter = made
    .filter((a) => a.outcome?.result === 'IMPROVED' && (a.measuredAt?.getTime() ?? 0) >= since)
    .sort(
      (x, y) =>
        share(y.outcome!.beforeCount, y.outcome!.beforeTotal) -
        share(y.outcome!.afterCount, y.outcome!.afterTotal) -
        (share(x.outcome!.beforeCount, x.outcome!.beforeTotal) - share(x.outcome!.afterCount, x.outcome!.afterTotal)),
    );
  const top = measuredBetter[0] ?? null;

  // The biggest change is said once, above the list — never again in it.
  const recent = made
    .filter((a) => a.id !== top?.id)
    .sort((x, y) => when(y) - when(x))
    .slice(0, 3)
    .map((a) => ({
      key: a.id,
      about: a.about,
      state: changeState(a),
      before: a.outcome ? `${a.outcome.beforeCount}/${a.outcome.beforeTotal}` : null,
      after: a.outcome ? `${a.outcome.afterCount}/${a.outcome.afterTotal}` : null,
      awaiting: a.outcome ? null : a.awaiting,
    }));

  return {
    biggest: top
      ? {
          key: top.id,
          about: top.about,
          state: 'BETTER',
          before: `${top.outcome!.beforeCount}/${top.outcome!.beforeTotal}`,
          after: `${top.outcome!.afterCount}/${top.outcome!.afterTotal}`,
          awaiting: null,
        }
      : null,
    recent,
    last30: {
      made: made.filter((a) => (a.doneAt?.getTime() ?? 0) >= since).length,
      better: made.filter(
        (a) => a.outcome?.result === 'IMPROVED' && (a.measuredAt?.getTime() ?? 0) >= since,
      ).length,
      watching: made.filter((a) => !a.outcome).length,
    },
  };
}

/**
 * The state of the loop, as one line, only where a line is worth having.
 *
 * NONE and SUGGESTED say nothing, because on those the buttons are the
 * message: an undecided suggestion with "You have not decided yet" written
 * above the choice is the page nagging. The other three states have no button
 * to press, so they get a sentence instead of silence.
 */
export function loopLine(state: PortalActionState, t: PortalTranslator): string | null {
  switch (state) {
    case 'IN_PROGRESS':
      return t('loop.state.yours');
    case 'CHECKED':
      return t('loop.state.watching');
    case 'DECLINED':
      return t('loop.state.notDoing');
    default:
      return null;
  }
}

export function buildBrief(input: BriefInput): Brief {
  const t = input.t ?? EN;
  const { view, responsibility: r, evidence, coverage, basePath } = input;
  const now = input.now ?? new Date(0);
  const since = input.since ?? null;

  // The problem the owner is shown is the one the responsibility engine put
  // first, not the one with the biggest number. The engine already weighs
  // recurrence, severity and whether a decision is outstanding; picking by
  // count here would quietly overrule it on the one screen that matters.
  const leadKey = r.needsYou[0]?.themeKey ?? null;
  const lead =
    (leadKey ? view.unhappy.find((s) => s.themeKey === leadKey) : null) ??
    view.first ??
    view.unhappy[0] ??
    null;

  // The strength is chosen the same way, from the pile the view already
  // ranked. `keep` is the engine's own answer to "what would I protect".
  const strength = view.keep ?? view.loved[0] ?? null;
  const alsoStrong = view.loved
    .filter((s) => s !== strength && (s.bucket === 'KEEP' || (s.bucket !== 'WATCH' && s.bucket !== 'EARLY')))
    .slice(0, 2);

  // Movement, shortest first: what got worse, then what got better. Three is
  // the ceiling — a fourth line on a phone is a list, and a list is reading.
  // One row per topic, never the same topic twice: the engine's sentence is
  // generic ("mentioned more this time"), so rows are told apart by the
  // topic's own name and counts, not by the sentence.
  const seen = new Set<string>();
  const moved: BriefMove[] = [
    ...view.unhappy
      .filter((s) => s.movementDirection === 'WORSENING' && s.movementBrief)
      .map((s) => ({ s, tone: 'bad' as const })),
    ...view.loved
      .filter((s) => s.movementDirection === 'IMPROVING' && s.movementBrief)
      .map((s) => ({ s, tone: 'good' as const })),
  ]
    .filter(({ s }) => (seen.has(s.themeKey) ? false : (seen.add(s.themeKey), true)))
    .map(({ s, tone }) => ({
      key: s.themeKey,
      label: s.themeLabel,
      counts: s.movementCounts,
      line: s.movementBrief ?? '',
      tone,
      kind: s.kind,
    }));
  const changed = moved.slice(0, 3);

  // NEUTRAL joins MIXED, UNKNOWN is left out, and the total is the three
  // added up — never `coverage.analysed`, so the strip can never print three
  // counts under a headline they do not reach.
  const c = coverage.sentimentCounts;
  const happy = c.POSITIVE ?? 0;
  const mixed = (c.MIXED ?? 0) + (c.NEUTRAL ?? 0);
  const unhappy = c.NEGATIVE ?? 0;

  const attention = lead ? cardFor(lead, evidence, basePath, t) : null;
  const tooEarly = view.basedOn === 0;

  return {
    header: {
      businessName: view.businessName,
      verticalLabel: view.verticalLabel,
      watching: view.unhappy.length + view.loved.length,
      needsYou: r.needsYou.length,
      arrivedSinceVisit: since && since.arrived > 0 ? since.arrived : null,
      checkedWhileAway: (since?.measured ?? []).map((m) => ({
        id: m.id,
        title: m.title,
        better:
          m.result === 'IMPROVED' ? true : m.result === 'WORSENED' ? false : null,
      })),
    },
    mix: { happy, mixed, unhappy, read: happy + mixed + unhappy },
    waiting: view.soFar.waiting,
    attention,
    loved: strength ? cardFor(strength, evidence, basePath, t) : null,
    alsoLoved: strength ? alsoStrong.map((s) => cardFor(s, evidence, basePath, t)) : [],
    changed,
    changedTotal: moved.length,
    calm: !tooEarly && attention === null,
    memory: memoryOf(view.actions, now),
    tooEarly,
  };
}
