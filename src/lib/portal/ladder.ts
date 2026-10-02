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
export const LADDER_VERSION = 1;

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
  /** The evidence sentence, without the topic's name (the row heads with it). */
  line: string;
  /** What the owner might do, scaled to the rung. Null when there is nothing to do. */
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

function lineFor(kind: 'PRAISE' | 'ISSUE', level: FindingLevel, mentions: number, read: number, share: number, t: PortalTranslator): string {
  const vars = { count: mentions, total: read, pct: share };
  const early = read < EMERGING_AT;
  if (kind === 'PRAISE') {
    switch (level) {
      case 'OBSERVATION':
        return t('ladder.line.praise.observation');
      case 'EARLY_SIGNAL':
        return t('ladder.line.praise.signal', vars);
      case 'EMERGING_PATTERN':
        return t('ladder.line.praise.emerging', vars);
      default:
        return t('ladder.line.praise.strong', vars);
    }
  }
  switch (level) {
    case 'OBSERVATION':
      return early ? t('ladder.line.issue.observation.early') : t('ladder.line.issue.observation.later');
    case 'EARLY_SIGNAL':
      return early ? t('ladder.line.issue.signal.early', vars) : t('ladder.line.issue.signal.later', vars);
    case 'EMERGING_PATTERN':
      return t('ladder.line.issue.emerging', vars);
    default:
      return t('ladder.line.issue.strong', vars);
  }
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
    case 'WATCH':
      return { level: 'WATCH', eyebrow: null, text: t('ladder.action.watch') };
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

function moodOf(pile: PileFacts, t: PortalTranslator): StandsOut | null {
  const { happy, mixed, unhappy } = pile;
  const total = happy + mixed + unhappy;
  if (total < 2) return null;
  const vars = { happy, mixed, unhappy, total, count: total };
  const majority = (x: number) => x * 2 > total;
  let title: string;
  let tone: StandsOut['tone'] = 'neutral';
  if (happy === total) {
    title = t('ladder.mood.allHappy', vars);
    tone = 'good';
  } else if (unhappy === total) {
    title = t('ladder.mood.allUnhappy', vars);
    tone = 'bad';
  } else if (majority(happy)) {
    title = unhappy === 0 ? t('ladder.mood.happyNoneUnhappy', vars) : t('ladder.mood.happy', vars);
    tone = 'good';
  } else if (majority(unhappy)) {
    title = t('ladder.mood.unhappy', vars);
    tone = 'bad';
  } else if (majority(mixed)) {
    title = t('ladder.mood.mixed', vars);
  } else {
    title = t('ladder.mood.split', vars);
  }
  return { kind: 'MOOD', findingKey: null, title, line: null, tone };
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
function standsOutOf(findings: Finding[], pile: PileFacts, t: PortalTranslator): StandsOut | null {
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
    };
  }
  return moodOf(pile, t);
}

function firstResponseOf(findings: Finding[], pile: PileFacts, t: PortalTranslator): string[] {
  const lines: string[] = [];
  const average = averageOf(pile);
  lines.push(average !== null ? t('ladder.first.rated', { stars: average }) : t('ladder.first.noRating'));
  if (pile.happy === 1) lines.push(t('ladder.first.tone.happy'));
  else if (pile.unhappy === 1) lines.push(t('ladder.first.tone.unhappy'));
  else if (pile.mixed === 1) lines.push(t('ladder.first.tone.mixed'));
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
  const base = {
    periods: r.checkins,
    title: t('ladder.direction.title'),
    method,
    methodTitle: t('ladder.direction.methodTitle'),
  };
  if (r.state === 'READY') {
    return {
      ...base,
      state: 'READY',
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
      body: t('ladder.direction.tooThin', { previous: r.previous?.held ?? 0, current: r.latest?.held ?? 0 }),
      automatic,
    };
  }
  if (r.state === 'ONE_CHECKIN' && r.latest) {
    return {
      ...base,
      state: 'BASELINE_SET',
      body: t.plural('ladder.direction.baselineSet', r.latest.held, {
        date: r.latest.at ? formatDate(r.latest.at) : r.latest.label,
      }),
      automatic,
    };
  }
  return {
    ...base,
    state: r.read > 0 ? 'BUILDING_BASELINE' : 'NOT_STARTED',
    body: r.read > 0 ? t('ladder.direction.building') : t('ladder.direction.notStarted'),
    automatic,
  };
}

function copyFor(
  stage: EvidenceStage,
  read: number,
  waiting: number,
  repeated: boolean,
  patterns: number,
  direction: Direction,
  t: PortalTranslator,
): EvidenceState['copy'] {
  const readLine = t.plural('ladder.read', read);
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
        readLine,
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
        readLine,
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
        readLine,
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
        readLine,
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
        readLine,
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
        line: lineFor(row.kind, level, row.count, read, share, t),
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
    },
    findings,
    likes,
    concerns,
    patterns,
    watching,
    standsOut: read >= 2 ? standsOutOf(findings, pile, t) : null,
    repeated,
    firstResponse: read === 1 ? firstResponseOf(findings, pile, t) : null,
    direction,
    copy: copyFor(stage, read, pile.waiting, repeated, patterns.length, direction, t),
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
