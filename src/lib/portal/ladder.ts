import {
  MIN_MENTIONS_TO_NAME,
  TIER_LIMITED_MIN,
  TIER_STANDARD_MIN,
} from '@/lib/intelligence/engine';
import type { ThemeSummary, ThemeSummaryRow } from '@/lib/feedback/analysis';
import { isCurrentAnalysis } from '@/lib/feedback/state';
import type { Pack } from '@/lib/packs';
import { formatDate } from '@/lib/format';
import { AUTO_PERIOD_MIN_DAYS, AUTO_PERIOD_MIN_RESPONSES } from '@/lib/snapshots/periods';
import { EN } from '@/lib/i18n/translator';
import type { PortalTranslator } from '@/lib/i18n/translator';
import { FIRST_READING_AT } from './readiness';
import { quotesFor, type EvidenceIndex, type Quote } from './evidence';
import type { PortalSignal, PortalView } from './view';
import type { TrendReadiness } from './trends';

/**
 * THE EVIDENCE LADDER — one answer to "what do we know right now?" (Oct 2026).
 *
 * Headway used to think in two states: not enough feedback, and a reading.
 * Below five responses every page showed a countdown card ("3 more responses
 * to go"); from five to nine, Home said "No strong pattern yet" and Trends said
 * "waiting for your first check-in". Each was honest and the sum read as a
 * product that does nothing until some threshold. That is not what the
 * evidence says: one response is already one customer heard, two that agree
 * are already worth watching, and a first read at five can say a great deal
 * without calling anything a pattern.
 *
 * So the model is a ladder, not a gate. MORE EVIDENCE → STRONGER CLAIMS:
 *
 *   OBSERVATION        one response mentions it          "One customer mentioned this."
 *   EARLY SIGNAL       it repeats, but the evidence is   "2 of 3 customers mentioned this.
 *                      too thin to stand behind           Still early — Headway is watching it."
 *   EMERGING PATTERN   3+ mentions in 10+ read           "Emerging pattern: 3 of 14."
 *   STRONG PATTERN     6+ mentions in 25+ read           "Strong recurring pattern: 7 of 30."
 *   TREND              two comparable periods, and a     (Trends — `health/compare.ts`)
 *                      share move the comparison rule
 *                      accepts
 *
 * The rungs ARE the engine's floors, not new ones. `levelOf` is
 * `intelligence/engine.ts`'s confidence rule (STRONG / MODERATE / EARLY) with
 * the two rungs below the naming floor added, and a test holds the two
 * together. Nothing here lets a claim outrun its evidence; it only stops the
 * product hiding what the evidence already supports.
 *
 * And the business as a whole sits at one STAGE, by how much has been read:
 *
 *   NONE               0       nothing read yet
 *   PULSE              1–4     what each customer said; repeats watched
 *   FIRST_READ         5–9     a first read: likes, what stands out, what to watch
 *   EMERGING_PICTURE   10–24   patterns can emerge when the evidence supports them
 *   STRONG_PATTERNS    25+     strong patterns, where earned
 *
 * Direction (is anything getting better or worse?) is a separate question with
 * its own readiness, because it needs two comparable periods however much has
 * been read in total — see `directionOf` and `snapshots/periods.ts`.
 *
 * ONE STATE, EVERY SURFACE. Home, Feedback, Customers, Trends, Check-in and the
 * period reports all take this object from `getEvidenceState`, built from the
 * same request-memoised reads, so no page can decide its own readiness and
 * contradict the next. Before this, Home said "No strong pattern yet" while
 * Trends said "waiting for your first check-in" and Feedback said "5 read",
 * three different stories about one pile.
 *
 * NO COUNTDOWNS. Nothing here says "3 more responses to unlock". The owner is
 * told what is known, what is not yet sure, what Headway is watching and what
 * more feedback will make clearer — never a number to reach.
 *
 * Pure: no database, no clock, handed its language.
 */

/** Bump when a rung, a stage or the wording rules change. */
export const LADDER_VERSION = 2;

/** The first read. The same line the website quotes (`PRODUCT_RULES.firstReadingAt`). */
export const FIRST_READ_AT = FIRST_READING_AT;
/** Enough read for a repeat to be a pattern — the engine's MODERATE floor. */
export const EMERGING_AT = TIER_LIMITED_MIN;
/** Enough read for a pattern to be strong — the engine's STRONG floor. */
export const STRONG_AT = TIER_STANDARD_MIN;

/** A topic said twice has repeated: an early signal, never a pattern on its own. */
export const EARLY_SIGNAL_MENTIONS = 2;
/** The naming floor (`MIN_MENTIONS_TO_NAME`). */
export const EMERGING_MENTIONS = MIN_MENTIONS_TO_NAME;
/** Twice the naming floor: the engine's STRONG mention count. */
export const STRONG_MENTIONS = MIN_MENTIONS_TO_NAME * 2;

export type EvidenceStage = 'NONE' | 'PULSE' | 'FIRST_READ' | 'EMERGING_PICTURE' | 'STRONG_PATTERNS';

export type FindingLevel = 'OBSERVATION' | 'EARLY_SIGNAL' | 'EMERGING_PATTERN' | 'STRONG_PATTERN';

/** What an owner is asked to do, scaled to the evidence. */
export type ActionLevel = 'WATCH' | 'CHECK' | 'ACT' | 'KEEP';

export function stageOf(read: number): EvidenceStage {
  const n = Number.isFinite(read) ? Math.max(0, Math.floor(read)) : 0;
  if (n === 0) return 'NONE';
  if (n < FIRST_READ_AT) return 'PULSE';
  if (n < EMERGING_AT) return 'FIRST_READ';
  if (n < STRONG_AT) return 'EMERGING_PICTURE';
  return 'STRONG_PATTERNS';
}

/**
 * The rung one topic stands on: `mentions` of `read` responses.
 *
 * The top two rungs are exactly the engine's MODERATE and STRONG
 * (`confidenceFor`); three or more mentions in fewer than ten read is the
 * engine's EARLY, which here is an early signal like any other repeat.
 */
export function levelOf(mentions: number, read: number): FindingLevel | null {
  if (!(mentions > 0) || !(read > 0)) return null;
  if (mentions >= STRONG_MENTIONS && read >= STRONG_AT) return 'STRONG_PATTERN';
  if (mentions >= EMERGING_MENTIONS && read >= EMERGING_AT) return 'EMERGING_PATTERN';
  if (mentions >= EARLY_SIGNAL_MENTIONS) return 'EARLY_SIGNAL';
  return 'OBSERVATION';
}

const LEVEL_RANK: Record<FindingLevel, number> = {
  OBSERVATION: 1,
  EARLY_SIGNAL: 2,
  EMERGING_PATTERN: 3,
  STRONG_PATTERN: 4,
};

export function isPattern(level: FindingLevel): boolean {
  return level === 'EMERGING_PATTERN' || level === 'STRONG_PATTERN';
}

/**
 * Low evidence asks the owner to keep an eye on it; emerging evidence says it
 * is worth checking; only strong evidence says what to do. Praise that is a
 * pattern is something to keep doing; praise below that asks nothing.
 */
export function actionLevelOf(kind: 'PRAISE' | 'ISSUE', level: FindingLevel): ActionLevel | null {
  if (kind === 'PRAISE') return isPattern(level) ? 'KEEP' : null;
  if (level === 'STRONG_PATTERN') return 'ACT';
  if (level === 'EMERGING_PATTERN') return 'CHECK';
  return 'WATCH';
}

// ---------------------------------------------------------------------------
// The pile: how customers feel, counted over the read responses
// ---------------------------------------------------------------------------

/**
 * Everything the pulse states, counted over the same read responses the stage
 * counts. One pile, so "Of 5 responses read" and "4 star ratings" are always
 * about the same five: the rating line used to sit under "From 5 customers"
 * while its average came from four ratings, with nothing saying so.
 */
export type PileFacts = {
  /** Every response this business holds, read or not. */
  collected: number;
  /** Read by the current reader — the evidence. */
  read: number;
  /** Collected, not read yet (being read, waiting, or to be re-read). */
  waiting: number;
  /** Could not be read on the last try; tried again automatically. */
  failed: number;
  happy: number;
  /** Mixed and neutral together: neither praise nor a complaint on balance. */
  mixed: number;
  unhappy: number;
  /** Read responses that carry a 1–5 star rating. */
  rated: number;
  /** Sum of those ratings, so the average is computed in one place. */
  ratingSum: number;
  /** Read responses with words in them. */
  withWords: number;
};

type PileRow = {
  analysisStatus: string;
  analysisVersion: number;
  sentiment: string;
  stars: number | null;
  text: string;
};

export function pileFrom(rows: PileRow[]): PileFacts {
  const out: PileFacts = {
    collected: rows.length,
    read: 0,
    waiting: 0,
    failed: 0,
    happy: 0,
    mixed: 0,
    unhappy: 0,
    rated: 0,
    ratingSum: 0,
    withWords: 0,
  };
  for (const row of rows) {
    if (!isCurrentAnalysis(row)) {
      out.waiting += 1;
      if (row.analysisStatus === 'FAILED') out.failed += 1;
      continue;
    }
    out.read += 1;
    if (row.sentiment === 'POSITIVE') out.happy += 1;
    else if (row.sentiment === 'NEGATIVE') out.unhappy += 1;
    else if (row.sentiment === 'MIXED' || row.sentiment === 'NEUTRAL') out.mixed += 1;
    if (row.stars !== null && row.stars >= 1 && row.stars <= 5) {
      out.rated += 1;
      out.ratingSum += row.stars;
    }
    if (row.text.trim().length > 0) out.withWords += 1;
  }
  return out;
}

/** The mean rating to one decimal, or null when nobody rated. 4.75 is 4.8. */
export function averageOf(pile: Pick<PileFacts, 'rated' | 'ratingSum'>): number | null {
  if (pile.rated <= 0) return null;
  return Math.round((pile.ratingSum / pile.rated) * 10) / 10;
}

// ---------------------------------------------------------------------------
// The state
// ---------------------------------------------------------------------------

export type Finding = {
  key: string;
  /** The pack's name for the topic, in the owner's language. */
  label: string;
  kind: 'PRAISE' | 'ISSUE';
  severity: 'low' | 'medium' | 'high';
  /** Read responses that mention it — each response at most once. */
  mentions: number;
  /** Out of how many read responses: the denominator, always stated. */
  read: number;
  /** Whole percent of `read`. Worded only from EMERGING up: a share of five is not a finding. */
  share: number;
  level: FindingLevel;
  /** "Early signal" — the rung, in the owner's language. */
  levelLabel: string;
  /**
   * Which way it moved between the last two comparable check-ins, when the
   * engine read a direction or a genuine steady. Never inferred here.
   */
  movement: PortalSignal['movementDirection'];
  /**
   * The evidence, as counts with the denominator: "2 of 5 customers", and the
   * share from a pattern up ("7 of 30 customers · 23%"). The rung itself is
   * `levelLabel`, shown beside it, so the line never says it again (quieter
   * ladder pass).
   */
  line: string;
  /**
   * What the owner might do, scaled to the rung. Null when there is nothing to
   * do — and for a topic only being watched, whose rung already says so.
   */
  action: { level: ActionLevel; eyebrow: string | null; text: string } | null;
};

export type StandsOut = {
  kind: 'FINDING' | 'MOOD';
  /** The finding it is about, for a FINDING. */
  findingKey: string | null;
  /** The topic's name for a FINDING; the whole sentence for a MOOD. */
  title: string;
  line: string | null;
  tone: 'good' | 'bad' | 'neutral';
  /** The rung, for a FINDING, so the headline can carry it as a chip. */
  finding: Finding | null;
};

export type DirectionState = 'NOT_STARTED' | 'BUILDING_BASELINE' | 'BASELINE_SET' | 'TOO_THIN' | 'READY';

export type Direction = {
  state: DirectionState;
  /** Comparison points so far, automatic ones included. */
  periods: number;
  title: string;
  /** Where the comparison stands, in plain words. Never a chore for the owner. */
  body: string;
  /** "Headway keeps collecting automatically" — said until a comparison exists. */
  automatic: string | null;
  /** How a comparable period and a real change are decided. */
  method: string;
  methodTitle: string;
};

export type EvidenceState = {
  version: number;
  stage: EvidenceStage;
  read: number;
  collected: number;
  waiting: number;
  failed: number;

  pulse: {
    happy: number;
    mixed: number;
    unhappy: number;
    /** The three added up — the pile the mood counts describe. */
    counted: number;
    rated: number;
    average: number | null;
    /** "Of 5 responses read" */
    basis: string;
    /** "4 star ratings · 4.8★ average" | "No star ratings yet" */
    ratings: string;
    /** The compact form under the counts: "4.8★ from 4 ratings" | "No star ratings yet". */
    from: string;
  };

  /** Every topic any read response mentioned, strongest evidence first. */
  findings: Finding[];
  /** Praise, strongest first. */
  likes: Finding[];
  /** Complaints, strongest first. */
  concerns: Finding[];
  /** Emerging and strong patterns, complaints first. */
  patterns: Finding[];
  /** Complaints below a pattern: what Headway is watching. */
  watching: Finding[];
  /** The single strongest thing the evidence supports saying. */
  standsOut: StandsOut | null;
  /**
   * How customers felt, as one short sentence ("Most customers are happy.").
   * Pages show it only when no topic was read at all (`headlineOf`): over
   * topics it restated the counts beside it. Null below two read.
   */
  mood: StandsOut | null;
  /** Whether anything at all has repeated. */
  repeated: boolean;
  /** At one response: what that customer said, line by line. */
  firstResponse: string[] | null;

  direction: Direction;

  copy: {
    /** The stage, as a label: "First read". */
    eyebrow: string;
    title: string;
    intro: string;
    /** "Nothing has repeated yet …" / "nothing has repeated enough …", when true. */
    nothingRepeated: string | null;
    /** What Headway is not yet sure about. */
    notSure: string | null;
    /** What more feedback will make clearer. */
    clearer: string | null;
    /** What Headway is doing, as it is doing it. */
    doing: string[];
    /** "5 responses read" */
    readLine: string;
    /** "5 responses" — said once, beside the stage. */
    countLine: string;
    /**
     * HOW SURE, IN ONE LINE (quieter ladder pass): "Still early — nothing has
     * repeated yet." The one place a page states its confidence; the longer
     * `notSure`, `clearer` and `doing` sit behind "How Headway decides". Null
     * once a complaint is a pattern, because the rung on it says so.
     */
    note: string | null;
  };
};

export type EvidenceInput = {
  /** The portal view, for the engine's own suggestion and movement per topic. */
  view: Pick<PortalView, 'unhappy' | 'loved' | 'early'>;
  /** Every topic's count over the read responses, including those mentioned once. */
  themes: ThemeSummary;
  pile: PileFacts;
  trendReadiness: TrendReadiness;
  pack: Pack;
  t?: PortalTranslator;
};

function severityOf(pack: Pack, row: ThemeSummaryRow): 'low' | 'medium' | 'high' {
  if (row.kind === 'ISSUE') {
    return pack.issueTaxonomy.find((x) => x.key === row.key)?.severity ?? row.severity ?? 'medium';
  }
  return row.severity ?? 'medium';
}

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 } as const;

/**
 * Strongest evidence first; then more mentions; then the more serious
 * complaint; then the topic's KEY — never its label, which is translated, so
 * two equal topics come in the same order, and the same one "stands out", in
 * every language.
 */
export function compareFindings(a: Finding, b: Finding): number {
  return (
    LEVEL_RANK[b.level] - LEVEL_RANK[a.level] ||
    b.mentions - a.mentions ||
    (a.kind === 'ISSUE' && b.kind === 'ISSUE' ? SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] : 0) ||
    a.key.localeCompare(b.key)
  );
}

/**
 * The evidence, as counts: "2 of 5 customers". The rung is the chip beside it
 * ("Early signal"), so the line does not say it again, and the share is added
 * only from a pattern up — a percentage of five is not a finding.
 */
function lineFor(level: FindingLevel, mentions: number, read: number, share: number, t: PortalTranslator): string {
  const vars = { count: mentions, total: read, pct: share };
  return isPattern(level) ? t('ladder.line.ofPct', vars) : t('ladder.line.of', vars);
}

function levelLabelFor(kind: 'PRAISE' | 'ISSUE', level: FindingLevel, t: PortalTranslator): string {
  if (level === 'OBSERVATION') {
    return kind === 'PRAISE' ? t('ladder.level.observation.praise') : t('ladder.level.observation.issue');
  }
  return t(`ladder.level.${level}`);
}

/**
 * The action, scaled. The text of a CHECK or ACT is the pack's own suggestion,
 * with the owner's constraints already applied by the view — never invented
 * here — and nothing at all when the pack has none: no generic advice just
 * because an issue exists.
 */
function actionFor(
  kind: 'PRAISE' | 'ISSUE',
  level: FindingLevel,
  signal: PortalSignal | null,
  t: PortalTranslator,
): Finding['action'] {
  const actionLevel = actionLevelOf(kind, level);
  switch (actionLevel) {
    case 'KEEP':
      return { level: 'KEEP', eyebrow: null, text: t('ladder.action.keep') };
    // Below a pattern the owner is asked for nothing: "Mentioned once" and
    // "Early signal" already say Headway is watching, and "Keep an eye on
    // this" under every one of them was the page saying it twice.
    case 'WATCH':
      return null;
    case 'CHECK': {
      const text = signal?.suggestion ?? null;
      return text ? { level: 'CHECK', eyebrow: t('ladder.action.check'), text } : null;
    }
    case 'ACT': {
      const text = signal?.suggestion ?? null;
      return text ? { level: 'ACT', eyebrow: t('ladder.action.act'), text } : null;
    }
    default:
      return null;
  }
}

/**
 * HOW CUSTOMERS FELT, AS ONE SHORT SENTENCE. The counts sit right beside it
 * in every place it is shown ("4 Happy · 1 Mixed · 0 Unhappy"), so the
 * sentence carries the reading, not the numbers again. Below five read it says
 * "so far" in the past tense: two of three customers is not "most customers".
 */
function moodOf(pile: PileFacts, read: number, t: PortalTranslator): StandsOut | null {
  const { happy, mixed, unhappy } = pile;
  const total = happy + mixed + unhappy;
  if (total < 2) return null;
  const early = read < FIRST_READ_AT;
  // "Most" is said for two in three or more — or for a majority the other side
  // barely contests (a fifth or less). Without the numbers in the sentence,
  // "most customers are happy" over 13 happy and 11 unhappy would be a true
  // majority and a misleading headline; that is "more happy than unhappy", and
  // anything closer is "split".
  const majority = (x: number) => x * 2 > total;
  const most = (x: number, against: number) => x * 3 >= total * 2 || (majority(x) && against * 5 <= total);
  let title: string;
  let tone: StandsOut['tone'] = 'neutral';
  if (happy === total) {
    title = t('ladder.mood.allHappy');
    tone = 'good';
  } else if (unhappy === total) {
    title = t('ladder.mood.allUnhappy');
    tone = 'bad';
  } else if (most(happy, unhappy)) {
    title = early ? t('ladder.mood.early.happy') : t('ladder.mood.happy');
    tone = 'good';
  } else if (most(unhappy, happy)) {
    title = early ? t('ladder.mood.early.unhappy') : t('ladder.mood.unhappy');
    tone = 'bad';
  } else if (mixed * 3 >= total * 2) {
    title = early ? t('ladder.mood.early.mixed') : t('ladder.mood.mixed');
  } else if (majority(happy) && happy > unhappy) {
    title = early ? t('ladder.mood.early.leanHappy') : t('ladder.mood.leanHappy');
    tone = 'good';
  } else if (majority(unhappy) && unhappy > happy) {
    title = early ? t('ladder.mood.early.leanUnhappy') : t('ladder.mood.leanUnhappy');
    tone = 'bad';
  } else {
    title = early ? t('ladder.mood.early.split') : t('ladder.mood.split');
  }
  return { kind: 'MOOD', findingKey: null, title, line: null, tone, finding: null };
}

/**
 * THE ONE THING THAT STANDS OUT — the strongest claim the evidence supports.
 *
 * A pattern, complaints before praise because the owner can act on them; then
 * a complaint that has repeated, because that is the one thing worth knowing
 * early; otherwise the plain count of how customers felt. Praise below a
 * pattern is already under "what customers seem to like", so it is not said
 * twice.
 */
function standsOutOf(findings: Finding[], mood: StandsOut | null): StandsOut | null {
  const pick =
    findings.find((f) => f.kind === 'ISSUE' && isPattern(f.level)) ??
    findings.find((f) => f.kind === 'PRAISE' && isPattern(f.level)) ??
    findings.find((f) => f.kind === 'ISSUE' && f.level === 'EARLY_SIGNAL') ??
    null;
  if (pick) {
    return {
      kind: 'FINDING',
      findingKey: pick.key,
      title: pick.label,
      line: pick.line,
      tone: pick.kind === 'ISSUE' ? 'bad' : 'good',
      finding: pick,
    };
  }
  return mood;
}

/**
 * At one response: the rating and what they named, a line each. How they felt
 * is the pulse right above it (one Mixed), so it is not said again here.
 */
function firstResponseOf(findings: Finding[], pile: PileFacts, t: PortalTranslator): string[] {
  const lines: string[] = [];
  const average = averageOf(pile);
  lines.push(average !== null ? t('ladder.first.rated', { stars: average }) : t('ladder.first.noRating'));
  const join = (labels: string[]) =>
    labels.length <= 1
      ? (labels[0] ?? '')
      : t('evidence.list.pair', { rest: labels.slice(0, -1).join(', '), last: labels[labels.length - 1] ?? '' });
  const praised = findings.filter((f) => f.kind === 'PRAISE').map((f) => f.label);
  const mentioned = findings.filter((f) => f.kind === 'ISSUE').map((f) => f.label);
  if (praised.length > 0) lines.push(t('ladder.first.praised', { things: join(praised) }));
  if (mentioned.length > 0) lines.push(t('ladder.first.mentioned', { things: join(mentioned) }));
  if (praised.length + mentioned.length === 0) {
    lines.push(pile.withWords > 0 ? t('ladder.first.nothingNamed') : t('ladder.first.noWords'));
  }
  return lines;
}

/**
 * WHICH WAY THINGS ARE MOVING, and what it waits for — read off the same
 * trend readiness the Trends shelves come from, so the sentence and the
 * shelves cannot disagree. Every state says what Headway is doing by itself;
 * none asks the owner to record, run or wait on a check-in.
 */
export function directionOf(r: TrendReadiness, t: PortalTranslator = EN): Direction {
  const method = t('ladder.direction.method', {
    min: r.periodMinResponses ?? AUTO_PERIOD_MIN_RESPONSES,
    days: r.periodMinDays ?? AUTO_PERIOD_MIN_DAYS,
  });
  // The title is the answer for each state ("Not enough history yet"), not
  // the question: the old one heading ("Which way things are moving") made
  // the owner read a paragraph to find out there was no answer yet.
  const base = {
    periods: r.checkins,
    method,
    methodTitle: t('ladder.direction.methodTitle'),
  };
  if (r.state === 'READY') {
    return {
      ...base,
      state: 'READY',
      title: t('ladder.direction.title.ready'),
      body: t('ladder.direction.ready', {
        previous: r.previous?.held ?? 0,
        previousDate: r.previous?.label ?? '',
        current: r.latest?.held ?? 0,
        currentDate: r.latest?.label ?? '',
      }),
      automatic: null,
    };
  }
  const automatic = t('ladder.direction.automatic');
  if (r.state === 'TOO_THIN') {
    return {
      ...base,
      state: 'TOO_THIN',
      title: t('ladder.direction.title.tooThin'),
      body: t('ladder.direction.tooThin', { previous: r.previous?.held ?? 0, current: r.latest?.held ?? 0 }),
      automatic,
    };
  }
  if (r.state === 'ONE_CHECKIN' && r.latest) {
    return {
      ...base,
      state: 'BASELINE_SET',
      title: t('ladder.direction.title.baselineSet'),
      body: t.plural('ladder.direction.baselineSet', r.latest.held, {
        date: r.latest.at ? formatDate(r.latest.at) : r.latest.label,
      }),
      automatic,
    };
  }
  return {
    ...base,
    state: r.read > 0 ? 'BUILDING_BASELINE' : 'NOT_STARTED',
    title: r.read > 0 ? t('ladder.direction.title.building') : t('ladder.direction.title.notStarted'),
    body: r.read > 0 ? t('ladder.direction.building') : t('ladder.direction.notStarted'),
    automatic,
  };
}

/**
 * THE ONE CONFIDENCE LINE (quieter ladder pass). Four stacked blocks used to
 * say one idea — "nothing has repeated yet", "not sure yet", "what more
 * feedback will show", "what Headway is doing". Each page now says it once,
 * in the fewest words that are still true; the longer reasoning sits behind
 * "How Headway decides". Nothing here is a countdown.
 */
function noteFor(
  read: number,
  repeated: boolean,
  issuePatterns: number,
  issueSignals: number,
  t: PortalTranslator,
): string | null {
  if (read === 0) return null;
  if (read === 1) return t('ladder.note.single');
  if (read < EMERGING_AT) return repeated ? t('ladder.note.earlyRepeat') : t('ladder.note.early');
  if (issuePatterns > 0) return null;
  // A complaint that has repeated is on the page with "Early signal" beside
  // it; "no recurring problem" right under it would read as a contradiction.
  return issueSignals > 0 ? t('ladder.note.notYetPattern') : t('ladder.note.noProblemPattern');
}

function copyFor(
  stage: EvidenceStage,
  read: number,
  waiting: number,
  repeated: boolean,
  patterns: number,
  issuePatterns: number,
  issueSignals: number,
  direction: Direction,
  t: PortalTranslator,
): EvidenceState['copy'] {
  const shared = {
    readLine: t.plural('ladder.read', read),
    countLine: t.plural('ladder.count', read),
    note: noteFor(read, repeated, issuePatterns, issueSignals, t),
  };
  const doing: string[] = [t('ladder.doing.reads')];
  switch (stage) {
    case 'NONE':
      return {
        eyebrow: t('ladder.stage.NONE'),
        title: waiting > 0 ? t.plural('ladder.title.none.reading', waiting) : t('ladder.title.none.empty'),
        intro: waiting > 0 ? t.plural('ladder.intro.none.reading', waiting) : t('ladder.intro.none.empty'),
        nothingRepeated: null,
        notSure: null,
        clearer: null,
        doing,
        ...shared,
      };
    case 'PULSE':
      doing.push(t('ladder.doing.separate'));
      return {
        eyebrow: t('ladder.stage.PULSE'),
        title: read === 1 ? t('ladder.title.pulse.first') : t.plural('ladder.title.pulse.some', read),
        intro: read === 1 ? t('ladder.intro.pulse.first') : t('ladder.intro.pulse.some'),
        nothingRepeated: read >= 2 && !repeated ? t('ladder.nothingRepeated') : null,
        notSure: read === 1 ? t('ladder.notSure.first') : t('ladder.notSure.pulse'),
        clearer: t('ladder.clearer.early'),
        doing,
        ...shared,
      };
    case 'FIRST_READ':
      doing.push(t('ladder.doing.separate'));
      return {
        eyebrow: t('ladder.stage.FIRST_READ'),
        title: t('ladder.title.firstRead'),
        intro: t.plural('ladder.intro.firstRead', read),
        nothingRepeated: !repeated ? t('ladder.nothingRepeated') : null,
        notSure: t('ladder.notSure.firstRead'),
        clearer: repeated ? t('ladder.clearer.firstRead') : t('ladder.clearer.early'),
        doing,
        ...shared,
      };
    case 'EMERGING_PICTURE':
      doing.push(t('ladder.doing.patterns'));
      if (direction.state === 'READY') doing.push(t('ladder.doing.compares'));
      return {
        eyebrow: t('ladder.stage.EMERGING_PICTURE'),
        title: t('ladder.title.emerging'),
        intro: t.plural('ladder.intro.emerging', read),
        nothingRepeated: patterns === 0 ? t('ladder.noPatternYet') : null,
        notSure: patterns > 0 ? t('ladder.notSure.emerging') : t('ladder.notSure.firstRead'),
        clearer: t('ladder.clearer.emerging'),
        doing,
        ...shared,
      };
    default:
      doing.push(t('ladder.doing.patterns'));
      if (direction.state === 'READY') doing.push(t('ladder.doing.compares'));
      return {
        eyebrow: t('ladder.stage.STRONG_PATTERNS'),
        title: t('ladder.title.strong'),
        intro: t.plural('ladder.intro.strong', read),
        nothingRepeated: patterns === 0 ? t('ladder.noPatternYet') : null,
        notSure: direction.state === 'READY' ? null : t('ladder.notSure.direction'),
        clearer: direction.state === 'READY' ? t('ladder.clearer.strong') : t('ladder.clearer.direction'),
        doing,
        ...shared,
      };
  }
}

/**
 * The evidence state of one business. Every number in it is a count of read
 * responses the inputs already carry; every sentence is worded for the rung
 * its evidence reached, and no higher.
 */
export function buildEvidenceState(input: EvidenceInput): EvidenceState {
  const t = input.t ?? EN;
  const { pile, pack } = input;
  // The stage counts what the engine counted — the theme summary's read pile —
  // so a topic's denominator and the stage's are the same number.
  const read = input.themes.analysedCount;
  const stage = stageOf(read);

  const signals = new Map<string, PortalSignal>();
  for (const s of [...input.view.early, ...input.view.loved, ...input.view.unhappy]) {
    signals.set(`${s.kind}:${s.themeKey}`, s);
  }

  const findings: Finding[] = [...input.themes.issues, ...input.themes.praises]
    .filter((row) => row.count > 0)
    .map((row): Finding => {
      const level = levelOf(row.count, read) ?? 'OBSERVATION';
      const share = read > 0 ? Math.round((row.count / read) * 100) : 0;
      const signal = signals.get(`${row.kind}:${row.key}`) ?? null;
      return {
        key: row.key,
        // The label the rest of the page uses: the view's when the topic is
        // named, otherwise the pack's in the owner's language, then the stored.
        label: signal?.themeLabel ?? t.soft(`pack.${pack.id}.${row.key}`) ?? row.label,
        kind: row.kind,
        severity: severityOf(pack, row),
        mentions: row.count,
        read,
        share,
        level,
        levelLabel: levelLabelFor(row.kind, level, t),
        movement: signal?.movementDirection ?? null,
        line: lineFor(level, row.count, read, share, t),
        action: actionFor(row.kind, level, signal, t),
      };
    })
    .sort(compareFindings);

  const likes = findings.filter((f) => f.kind === 'PRAISE');
  const concerns = findings.filter((f) => f.kind === 'ISSUE');
  const patterns = [
    ...concerns.filter((f) => isPattern(f.level)),
    ...likes.filter((f) => isPattern(f.level)),
  ];
  const watching = concerns.filter((f) => !isPattern(f.level));
  const repeated = findings.some((f) => f.mentions >= EARLY_SIGNAL_MENTIONS);
  const direction = directionOf(input.trendReadiness, t);

  const average = averageOf(pile);
  const counted = pile.happy + pile.mixed + pile.unhappy;
  const mood = read >= 2 ? moodOf(pile, read, t) : null;

  return {
    version: LADDER_VERSION,
    stage,
    read,
    collected: pile.collected,
    waiting: pile.waiting,
    failed: pile.failed,
    pulse: {
      happy: pile.happy,
      mixed: pile.mixed,
      unhappy: pile.unhappy,
      counted,
      rated: pile.rated,
      average,
      basis: t.plural('ladder.pulse.basis', counted),
      ratings:
        average === null
          ? t('ladder.pulse.noRatings')
          : t.plural('ladder.pulse.rated', pile.rated, { average: average.toFixed(1) }),
      from:
        average === null
          ? t('ladder.pulse.noRatings')
          : t.plural('ladder.pulse.from', pile.rated, { average: average.toFixed(1) }),
    },
    findings,
    likes,
    concerns,
    patterns,
    watching,
    standsOut: read >= 2 ? standsOutOf(findings, mood) : null,
    mood,
    repeated,
    firstResponse: read === 1 ? firstResponseOf(findings, pile, t) : null,
    direction,
    copy: copyFor(stage, read, pile.waiting, repeated, patterns.length, concerns.filter((f) => isPattern(f.level)).length, concerns.filter((f) => f.level === 'EARLY_SIGNAL').length, direction, t),
  };
}

/**
 * Every figure the state words, for the numeric guard: prose about a business
 * may only carry numbers its evidence holds.
 */
export function evidenceNumbers(state: EvidenceState): Set<string> {
  const out = new Set<string>();
  const add = (n: number | null | undefined) => {
    if (typeof n === 'number' && Number.isFinite(n)) out.add(String(n));
  };
  for (const n of [
    state.read,
    state.collected,
    state.waiting,
    state.failed,
    state.pulse.happy,
    state.pulse.mixed,
    state.pulse.unhappy,
    state.pulse.counted,
    state.pulse.rated,
    state.direction.periods,
  ]) {
    add(n);
  }
  // The average as the pulse writes it ("4.8") and as a single rating is
  // written ("They rated you 4★").
  if (state.pulse.average !== null) {
    out.add(state.pulse.average.toFixed(1));
    add(state.pulse.average);
  }
  for (const f of state.findings) {
    add(f.mentions);
    add(f.read);
    add(f.share);
  }
  return out;
}

// ---------------------------------------------------------------------------
// What Home shows (quieter ladder pass; semantic Home pass)
// ---------------------------------------------------------------------------

/**
 * HOME'S BUDGET. Home is a briefing, not the whole reading: at most this many
 * rows per list, strongest evidence first. Everything else is one tap away on
 * Customers, which lists every topic on its rung.
 */
export const HOME_LIMITS = { patterns: 3, likes: 3, watching: 2 } as const;

/**
 * THE HEADLINE — only when there is a topic worth leading with: a pattern, or
 * a complaint that has repeated (`standsOut`). Never a mood sentence over
 * topics: "Most customers are happy" restated the counts shown right above it
 * and took the place where Headway's own reading belongs — what customers
 * talked about (semantic Home pass). The mood sentence remains for a pile
 * with no topic at all (ratings only), where it is the reading.
 *
 * Null too when another card on the page already tells that topic in full
 * (Home's story card).
 */
export function headlineOf(state: EvidenceState, omit: string | null = null): StandsOut | null {
  const s = state.standsOut;
  if (s?.kind === 'FINDING') return omit !== null && s.findingKey === omit ? null : s;
  return state.findings.length === 0 ? state.mood : null;
}

export type HomeLists = {
  /** Complaints that are patterns, beside the story card's own. */
  patterns: Finding[];
  /** Praise, strongest first — from the first compliment, said as what it is. */
  likes: Finding[];
  /** Complaints below a pattern, strongest first. */
  watching: Finding[];
  /** Topics left for Customers, so Home can say how many more there are. */
  more: number;
};

/**
 * WHICH TOPICS EARN A ROW ON HOME.
 *
 * DISPLAY IS NOT A CLAIM. A topic one customer raised is evidence worth
 * showing — "Attentive service · Praised once" tells an owner something a
 * 4.8★ average cannot — and its rung says exactly how much it is. What the
 * evidence limits is the CLAIM ("Strong pattern", "What to do"), never
 * whether Headway may say what it read. So every topic may take a row, and
 * the budget, not a mention count, decides which: complaint patterns first,
 * then praise and the complaints still being watched, each strongest first
 * (`compareFindings`), so a repeat always outranks a one-off.
 *
 * The rungs are unchanged: this decides only what Home has room for, never
 * what anything is called.
 */
export function homeLists(state: EvidenceState, omit: string | null = null): HomeLists {
  const headline = headlineOf(state, omit);
  // A story topic counts as shown only when it is one of these findings: the
  // engine can name a theme the live theme summary does not hold (mid re-read).
  const told = omit !== null && state.findings.some((f) => f.key === omit) ? omit : null;
  const shown = new Set<string>([told, headline?.findingKey].filter((k): k is string => typeof k === 'string'));
  const keep = (f: Finding) => !shown.has(f.key);
  const allPatterns = state.concerns.filter((f) => isPattern(f.level)).filter(keep);
  const patterns = allPatterns.slice(0, HOME_LIMITS.patterns);
  const likes = state.likes.filter(keep).slice(0, HOME_LIMITS.likes);
  // When a complaint pattern did not fit, no weaker complaint takes a row
  // ahead of it: "Worth watching" waits, and both are counted under "more".
  const watching = allPatterns.length > patterns.length ? [] : state.watching.filter(keep).slice(0, HOME_LIMITS.watching);
  const listed = shown.size + patterns.length + likes.length + watching.length;
  return { patterns, likes, watching, more: Math.max(0, state.findings.length - listed) };
}

/**
 * RIGHT NOW, IN A FEW ROWS — the strongest topics of either kind, for a page
 * whose job is something else (Trends). Strongest evidence first.
 */
export function topFindings(state: EvidenceState, limit = 3): Finding[] {
  return state.findings.slice(0, limit);
}

/**
 * THE WORDS BEHIND EACH ROW, while the pile is small (low-data pass).
 *
 * Below ten read, every topic on Home rests on one or two customers, so the
 * most useful thing to put under "Attentive service · Praised once" is what
 * that customer wrote: "Good service". It shows why Headway named the topic,
 * and the rung beside it still says it is one customer. From ten read the
 * rows carry counts and shares that speak for themselves, and the story card
 * and topic pages carry the quotes.
 *
 * One quote per row, never the same response under two topics, and only
 * rows Home actually shows.
 */
export function homeQuotes(state: EvidenceState, evidence: EvidenceIndex | null | undefined, omit: string | null = null): Map<string, Quote> {
  if (!evidence || state.read === 0 || state.read >= EMERGING_AT) return new Map();
  const headline = headlineOf(state, omit);
  const lists = homeLists(state, omit);
  const rows = [headline?.finding ?? null, ...lists.patterns, ...lists.likes, ...lists.watching].filter((f): f is Finding => f !== null);
  return pickQuotes(evidence, rows);
}

/**
 * ONE CUSTOMER'S WORDS PER TOPIC, NONE TWICE — for any list of topics on one
 * screen (Home's rows, Customers' full list). The topics with the fewest
 * responses choose first, so one response that mentions two topics ("Loved
 * the cappuccino, but the service was slow") goes to the topic that has
 * nothing else to show; short words count when they are all there is.
 */
export function pickQuotes(evidence: EvidenceIndex, findings: Finding[]): Map<string, Quote> {
  const out = new Map<string, Quote>();
  const candidates = findings
    .map((f, order) => ({ f, order, quotes: quotesFor(evidence, f.key, { limit: 3, allowShort: true }) }))
    .sort((a, b) => a.quotes.length - b.quotes.length || a.order - b.order);
  const used = new Set<string>();
  for (const { f, quotes } of candidates) {
    const quote = quotes.find((q) => !used.has(q.id));
    if (!quote) continue;
    used.add(quote.id);
    out.set(f.key, quote);
  }
  return out;
}
