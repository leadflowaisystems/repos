import Link from 'next/link';
import clsx from 'clsx';
import type { PortalAction } from '@/lib/portal/view';
import { populationFrom } from '@/lib/portal/focus';
import { quotesFor, type EvidenceIndex } from '@/lib/portal/evidence';
import { Population, Quotes, Reveal } from '@/components/portal/disclose';
import { getTranslator } from '@/lib/i18n/request';
import type { MessageKey } from '@/lib/i18n/strings';
import type { Translator } from '@/lib/i18n/t';
import { formatDate } from '@/lib/format';

type T = Translator<MessageKey>;

/**
 * ONE IMPROVEMENT, AS MEMORY (M24).
 *
 * The most valuable thing Headway does is remember: what the problem was,
 * what the owner changed, and what the feedback did afterwards. Told as a
 * report — problem, suggestion, decision, change, comparison, reading,
 * learning, next — it read as a form. Told as three moments with the numbers
 * large, it reads as a memory:
 *
 *   THE PROBLEM        32%     14 of 44, by 23 Jul
 *   YOU CHANGED        "Added a second server on Friday and Saturday evenings"  1 Aug
 *   HEADWAY CHECKED    47%     20 of 43, on 1 Sep
 *
 *   WHAT HAPPENED      Customers mentioned it more often after the change.
 *   WHAT THIS MEANS    …and the one sentence about what that cannot prove
 *   WHAT TO DO NOW     one line
 *
 * The numbers, the evidence and how it started sit behind three reveals.
 * Every date is the one the owner recorded; nothing here is recomputed.
 */

const EYEBROW = 'text-[11px] font-semibold tracking-widest text-ink-500 uppercase';

const READING_TONE: Record<string, string> = {
  IMPROVED: 'text-good-700',
  WORSENED: 'text-bad-700',
  NO_CLEAR_CHANGE: 'text-ink-600',
  INSUFFICIENT_DATA: 'text-ink-600',
};

/**
 * The four readings, in the portal's fixed words.
 *
 * Each one names what was mentioned and when — never what the change did.
 * "after the change" is the whole guard: it states the order of events and
 * claims nothing about the cause, so the tail is not optional and the wording
 * matches every other surface that shows the same four readings.
 */
function readingOf(t: T, result: string | undefined): string {
  switch (result) {
    case 'IMPROVED':
      return t('improvements.reading.improved');
    case 'WORSENED':
      return t('improvements.reading.worsened');
    case 'NO_CLEAR_CHANGE':
      return t('improvements.reading.noClearChange');
    default:
      return t('improvements.reading.notEnough');
  }
}

/** "14 of the 44 pieces of feedback read by 23 Jul 2026 (32%) mentioned it." → the parts. */
function problemParts(problem: string): { count: string; total: string; share: string; by: string } | null {
  const m = /^(\d+) of the (\d+) pieces of feedback read by (.+?) \((\d+%)\)/.exec(problem);
  if (!m) return null;
  return { count: m[1]!, total: m[2]!, by: m[3]!, share: m[4]! };
}

function Moment({
  label,
  when,
  figure,
  figureTone,
  line,
  quote,
  pending,
}: {
  label: string;
  when: Date | null;
  figure?: string;
  figureTone?: string;
  line?: string;
  quote?: string;
  pending?: string;
}) {
  return (
    <div className="min-w-0">
      <p className={EYEBROW}>{label}</p>
      {figure ? (
        <p className={clsx('mt-1.5 font-mono text-[34px] leading-none font-semibold tabular-nums sm:text-[40px]', figureTone ?? 'text-ink-900')}>
          {figure}
        </p>
      ) : null}
      {quote ? (
        <p className="mt-1.5 text-[16px] leading-snug font-medium text-ink-900 italic">“{quote}”</p>
      ) : null}
      {pending ? <p className="mt-1.5 text-[14px] leading-snug text-ink-500">{pending}</p> : null}
      {line ? <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600 tabular-nums">{line}</p> : null}
      {when ? <p className="mt-1 text-[12px] text-ink-500">{formatDate(when)}</p> : null}
    </div>
  );
}

/**
 * WHAT TO DO NOW: the instruction first, the reasoning under it.
 *
 * The loop's own next step is a paragraph that opens with the finding; the
 * finding already sits two rows up, so the line leads with the one thing to
 * do and keeps the rest small. Nothing here is a new judgement: every
 * sentence is the view's, reordered.
 */
function whatToDoNow(t: T, a: PortalAction): { lead: string; rest: string[] } {
  const sentences = a.nextStep.split(/(?<=\.)\s+/).filter((s) => s.length > 0);
  switch (a.outcome?.result) {
    case 'WORSENED':
      return {
        lead: t('improvements.next.worsened'),
        rest: sentences.filter((s) => /^The original suggestion/.test(s)),
      };
    case 'IMPROVED':
      return { lead: t('improvements.next.improved'), rest: sentences };
    case 'NO_CLEAR_CHANGE':
      return { lead: t('improvements.next.noClearChange'), rest: sentences };
    default:
      return { lead: sentences[0] ?? a.nextStep, rest: sentences.slice(1) };
  }
}

function Arrow() {
  return (
    <div aria-hidden className="hidden self-center text-[22px] text-ink-300 sm:block">
      →
    </div>
  );
}

export async function ImprovementStory({
  action: a,
  evidence,
  basePath,
}: {
  action: PortalAction;
  evidence: EvidenceIndex;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
}) {
  const t = await getTranslator();
  const declined = a.stage === 'NOT_DOING';
  const outcome = a.outcome;
  const population = outcome ? populationFrom(outcome, a) : null;
  const problem = problemParts(a.problem);
  const reviews = `${basePath}/reviews?theme=${encodeURIComponent(a.themeKey)}`;
  const afterQuotes = quotesFor(evidence, a.themeKey, { limit: 3, since: a.doneAt });
  const beforeQuotes = quotesFor(evidence, a.themeKey, { limit: 3, until: a.doneAt ?? undefined });
  const reading = outcome ? readingOf(t, outcome.result) : null;
  const tone = outcome ? READING_TONE[outcome.result] ?? 'text-ink-600' : 'text-ink-600';
  const { lead: nextLead, rest: nextRest } = whatToDoNow(t, a);

  return (
    <article className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[20px] leading-tight font-semibold tracking-tight text-ink-900 sm:text-[22px]">
          {a.about}
        </h3>
        <span className="text-[12px] font-medium tracking-wide text-ink-500 uppercase">{a.stageLabel}</span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:gap-5">
        <Moment
          label={t('improvements.moment.problem')}
          when={a.suggestedAt}
          figure={problem?.share ?? undefined}
          line={
            problem
              ? t.plural('improvements.entries', Number(problem.total), {
                  count: problem.count,
                  total: problem.total,
                })
              : a.problem
          }
        />
        <Arrow />
        <Moment
          label={declined ? t('improvements.notDoing') : t('improvements.moment.youChanged')}
          when={declined ? a.decidedAt : (a.doneAt ?? a.decidedAt)}
          quote={declined ? undefined : a.decision || (a.doneAt ? t('improvements.moment.changeNotDescribed') : undefined)}
          pending={
            declined
              ? a.decisionNote
                ? t('improvements.moment.declinedReason', { reason: a.decisionNote })
                : t('improvements.moment.declined')
              : !a.doneAt
                ? a.decidedAt
                  ? t('improvements.moment.agreedNotMade')
                  : t('improvements.moment.waitingDecision')
                : undefined
          }
        />
        <Arrow />
        <Moment
          label={t('improvements.moment.checkedAgain')}
          when={a.measuredAt}
          figure={population?.after.share ?? undefined}
          figureTone={tone}
          line={
            population
              ? t.plural('improvements.entries', population.after.total, {
                  count: population.after.count,
                  total: population.after.total,
                })
              : undefined
          }
          pending={
            !outcome
              ? declined
                ? t('improvements.moment.nothingToCompare')
                : a.awaiting
                  ? t.plural('improvements.moment.awaiting', a.awaiting.need, {
                      have: a.awaiting.have,
                      need: a.awaiting.need,
                    })
                  : t('improvements.moment.notMadeYet')
              : undefined
          }
        />
      </div>

      {outcome ? (
        <dl className="mt-7 divide-y divide-ink-200 border-y border-ink-200">
          <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[11rem_1fr]">
            <dt className={EYEBROW}>{t('improvements.row.whatHappened')}</dt>
            <dd className={clsx('text-[17px] leading-snug font-semibold tracking-tight', tone)}>{reading}</dd>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[11rem_1fr]">
            <dt className={EYEBROW}>{t('improvements.row.whatThisMeans')}</dt>
            <dd className="text-[15px] leading-relaxed text-ink-900">
              {outcome.headline}{' '}
              <span className="text-ink-700">{outcome.caveat || outcome.note}</span>
            </dd>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[11rem_1fr]">
            <dt className={EYEBROW}>{t('improvements.row.whatToDoNow')}</dt>
            <dd className="text-[15px] leading-relaxed font-medium text-ink-900">
              {nextLead}
              {nextRest.length > 0 ? (
                <span className="mt-0.5 block text-[13px] font-normal leading-relaxed text-ink-600">
                  {nextRest.join(' ')}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      ) : (
        <dl className="mt-7 divide-y divide-ink-200 border-y border-ink-200">
          <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[11rem_1fr]">
            <dt className={EYEBROW}>{t('improvements.row.whereThisStands')}</dt>
            <dd className="text-[15px] leading-relaxed text-ink-900">{a.stageMeaning}</dd>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[11rem_1fr]">
            <dt className={EYEBROW}>{t('improvements.row.whatToDoNow')}</dt>
            <dd className="text-[15px] leading-relaxed font-medium text-ink-900">{a.nextStep}</dd>
          </div>
        </dl>
      )}

      {/*
        A reading that has turned round again. The row above already says it
        was mentioned less often after the change, so this line only carries
        the new fact — and it asks the owner to look before acting, because
        the rise has no named cause either.
      */}
      {a.returning ? (
        <p className="mt-4 border-l-2 border-bad-600 pl-4 text-[14px] leading-relaxed font-medium text-ink-900">
          {t('improvements.returning')}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1">
        {population ? (
          <Reveal summary={t('improvements.reveal.numbers')}>
            <div className="rounded-xl border border-ink-200 bg-ink-50 p-4 sm:p-5">
              <Population population={population} />
            </div>
          </Reveal>
        ) : null}
        <Reveal summary={t('improvements.reveal.evidence')}>
          <div className="rounded-xl border border-ink-200 bg-ink-50 p-4 sm:p-5">
            {a.doneAt && outcome ? (
              <>
                <p className={EYEBROW}>{t('improvements.evidence.after')}</p>
                <div className="mt-2">
                  <Quotes quotes={afterQuotes} seeAll={{ label: t('improvements.evidence.seeMentions'), href: reviews }} />
                </div>
                {beforeQuotes.length > 0 ? (
                  <>
                    <p className={clsx(EYEBROW, 'mt-5')}>{t('improvements.evidence.before')}</p>
                    <div className="mt-2">
                      <Quotes quotes={beforeQuotes} />
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <Quotes quotes={beforeQuotes.length > 0 ? beforeQuotes : afterQuotes} seeAll={{ label: t('improvements.evidence.seeMentions'), href: reviews }} />
            )}
          </div>
        </Reveal>
        <Reveal summary={t('improvements.reveal.howStarted')}>
          <dl className="space-y-3 rounded-xl border border-ink-200 bg-ink-50 p-4 sm:p-5">
            <div>
              <dt className={EYEBROW}>{t('improvements.started.suggested')}</dt>
              <dd className="mt-1 text-[14px] leading-relaxed text-ink-900">{a.suggested}</dd>
            </div>
            {a.decision ? (
              <div>
                <dt className={EYEBROW}>{t('improvements.started.decided')}</dt>
                <dd className="mt-1 text-[14px] leading-relaxed text-ink-800 italic">
                  {a.decision}
                  {a.decidedAt ? <span className="not-italic text-ink-500"> · {formatDate(a.decidedAt)}</span> : null}
                </dd>
              </div>
            ) : null}
            {a.learning ? (
              <div>
                <dt className={EYEBROW}>{t('improvements.started.learning')}</dt>
                <dd className="mt-1 text-[14px] leading-relaxed text-ink-800 italic">{a.learning}</dd>
              </div>
            ) : null}
            <div>
              <dt className={EYEBROW}>{t('improvements.started.problemNumbers')}</dt>
              <dd className="mt-1 text-[13px] leading-relaxed text-ink-700">
                {a.problem}{' '}
                <Link
                  href={reviews}
                  className="inline-flex min-h-11 items-center font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
                >
                  {t('improvements.evidence.seeMentions')} →
                </Link>
              </dd>
            </div>
          </dl>
        </Reveal>
      </div>
    </article>
  );
}
