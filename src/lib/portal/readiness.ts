import type { AnalysisCoverage } from '@/lib/feedback/analysis';
import { EN } from '@/lib/i18n/translator';
import type { PortalTranslator } from '@/lib/i18n/translator';

/**
 * IS THERE ENOUGH FEEDBACK TO SHOW A READING YET?
 *
 * A new business receives its first two or three responses and opens the
 * workspace to find... very little. Every page was individually honest about
 * that — "too early to tell", "nothing to compare yet" — but each said it in
 * its own words, some pages still drew a pattern off three entries, and the
 * sum of it read as a product that was broken or not set up.
 *
 * So there is ONE answer to "is this business ready for a reading", decided
 * here, and every page that shows one asks it first:
 *
 *   NONE       nothing has arrived. Say how feedback arrives and where the
 *              card and link are.
 *   BUILDING   some has arrived, fewer than FIRST_READING_AT. Say how many,
 *              how many more, and what the owner can do meanwhile.
 *   READY      render the page as it always was.
 *
 * THIS IS A PRESENTATION FLOOR, NOT A NEW ANALYTICAL RULE. It sits in front of
 * the pages and changes nothing underneath them: the intelligence engine's own
 * evidence floor (`MIN_MENTIONS_TO_NAME`) and every other safeguard still
 * decide, at five responses and at five hundred, what may be called a pattern.
 * Reaching five does not name anything; it only lets the pages that apply
 * those safeguards speak.
 *
 * WHAT COUNTS. Every response this business holds, whatever it came through,
 * minus those whose reading FAILED — a response Headway could not read cannot
 * contribute to a reading, and counting it would promise a page that then
 * shows nothing. A response still waiting to be read DOES count: it is about to
 * be read, and the pages already say "being read now" in their own words.
 *
 * PURE. The one read, `getReadiness`, lives in `./service` beside every other
 * portal read, and takes the same request-memoised ledger every page already
 * loads (`loadFeedbackLedger`), so asking costs no query. Keeping this file free
 * of the database is also what lets the public website quote FIRST_READING_AT.
 */

/** The number of usable responses before the first reading is shown. */
export const FIRST_READING_AT = 5;

export type ReadinessState = 'NONE' | 'BUILDING' | 'READY';

export type Readiness = {
  state: ReadinessState;
  /** Usable responses received so far. */
  count: number;
  /** The line: FIRST_READING_AT. Carried so the copy never hard-codes it. */
  target: number;
  /** How many more until the line; zero once READY. */
  remaining: number;
  /** One short of the line — its own wording, because it is close. */
  almost: boolean;
  /** Shorthand for `state === 'READY'`, which is what every page asks. */
  ready: boolean;
};

/** The responses that can contribute to a reading. */
export function usableResponses(coverage: Pick<AnalysisCoverage, 'total' | 'failed'>): number {
  return Math.max(0, coverage.total - coverage.failed);
}

export function readinessOf(usable: number, target: number = FIRST_READING_AT): Readiness {
  const count = Number.isFinite(usable) ? Math.max(0, Math.floor(usable)) : 0;
  const remaining = Math.max(0, target - count);
  const state: ReadinessState = count === 0 ? 'NONE' : remaining > 0 ? 'BUILDING' : 'READY';
  return {
    state,
    count,
    target,
    remaining,
    almost: state === 'BUILDING' && remaining === 1,
    ready: state === 'READY',
  };
}

/**
 * What the owner is told, in their language. Null once READY — there is
 * nothing to say, and the page renders as it always did.
 */
export type ReadinessCopy = {
  eyebrow: string;
  title: string;
  body: string;
  /** "2 / 5 responses" */
  progress: string;
  /** "3 more responses to go" */
  remaining: string;
  next: string;
  /** What the owner will see at the line. */
  promise: string;
};

export function readinessCopy(r: Readiness, t: PortalTranslator = EN): ReadinessCopy | null {
  if (r.ready) return null;
  const shared = {
    progress: t('readiness.progress', { count: r.count, target: r.target }),
    remaining: t.plural('readiness.remaining', r.remaining),
    next: t('readiness.next.body'),
    promise: t('readiness.promise', { target: r.target }),
  };
  if (r.state === 'NONE') {
    return {
      eyebrow: t('readiness.none.eyebrow'),
      title: t('readiness.none.title'),
      body: t('readiness.none.body'),
      ...shared,
    };
  }
  return {
    eyebrow: t('readiness.building.eyebrow'),
    title: r.almost ? t('readiness.almost.title') : t('readiness.building.title'),
    body: r.almost
      ? t.plural('readiness.almost.body', r.count, { target: r.target })
      : t.plural('readiness.building.body', r.count),
    ...shared,
  };
}
