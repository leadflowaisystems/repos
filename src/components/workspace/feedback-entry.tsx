import clsx from 'clsx';
import { UpLink } from '@/components/portal/history';
import type { ReviewItem } from '@/lib/portal/pages';
import { getTranslator } from '@/lib/i18n/request';
import { formatDate, formatDateTime } from '@/lib/format';
import { whenSaid } from '@/lib/portal/fresh';

/**
 * ONE CUSTOMER'S FEEDBACK, ON ITS OWN PAGE (freshness pass).
 *
 * The end of the path every number on the workspace promises: NEW FEEDBACK →
 * the TOPIC Headway filed it under → this, the thing the customer actually
 * sent. Their words lead, set large, because on this page nothing Headway
 * concluded is more important than what they said. Under them, what they
 * tapped; then Headway's reading of it, labelled as a reading; then the
 * topics it counts towards, each a link back up to that topic's story.
 *
 * Nothing here is new data. It is the same row, mapped by the same function,
 * that the Feedback list shows (`reviewItemOf`), so an entry cannot say one
 * thing in the list and another on its own page.
 *
 * THE WAY BACK is `UpLink`: when the page it names is the one right behind
 * this in history, it IS the browser's Back, so the owner's next Back still
 * goes where they expect. See `lib/portal/nav-intent.ts`.
 */

const EYEBROW = 'text-[11px] font-semibold tracking-[0.14em] uppercase';

export async function FeedbackEntry({
  item,
  basePath,
  back,
  now,
}: {
  item: ReviewItem;
  /** The workspace's own base, so every link stays inside it. */
  basePath: string;
  /** Where "back" goes, and what it is called. The page decides from how it was opened. */
  back: { href: string; label: string };
  /** The moment of this render: the clock "2 min ago" is measured on. */
  now: Date;
}) {
  const t = await getTranslator();
  const { gave } = item;
  const tapped = gave.dimensions.length > 0 || gave.selected.length > 0 || gave.liked.length > 0;
  const reviews = `${basePath}/reviews`;
  // Stamped to the minute by the feedback card, dated by everything else. A
  // recent card submission also says how long ago, on the same clock as Home.
  const recent = item.at && item.exact ? whenSaid({ at: item.at, exact: true }, now, t, formatDate) : null;
  const when = item.at ? (item.exact ? formatDateTime(item.at) : formatDate(item.at)) : null;

  return (
    <article aria-labelledby="entry-words" className="max-w-2xl">
      <UpLink
        href={back.href}
        basePath={basePath}
        className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-[14px] font-medium text-ink-700 hover:text-ink-900"
      >
        <span aria-hidden>←</span> {back.label}
      </UpLink>

      <p className={clsx(EYEBROW, 'mt-2 text-ink-500')}>
        {t('feedback.entry.eyebrow')} · {item.sourceLabel}
      </p>

      {/* The customer's words are the title of the page. A rating with no
          words says so, rather than leaving an empty heading. */}
      <h1
        id="entry-words"
        className={clsx(
          'mt-2 font-display leading-[1.2] font-semibold text-balance',
          item.text.length > 0 ? 'text-[24px] text-ink-900 sm:text-[28px]' : 'text-[20px] text-ink-600',
        )}
      >
        {item.text.length > 0 ? `“${item.text}”` : tapped ? t('common.review.noWordsTapped') : t('common.review.ratingOnly')}
      </h1>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-600">
        {item.stars !== null ? (
          <span className="text-[15px] text-warn-600">
            <span className="sr-only">{t('common.stars.aria', { value: item.stars })}</span>
            <span aria-hidden>
              {'★'.repeat(item.stars)}
              <span className="text-ink-300">{'☆'.repeat(Math.max(0, 5 - item.stars))}</span>
            </span>
          </span>
        ) : (
          <span className="italic">{t('common.review.noRating')}</span>
        )}
        {when ? (
          <time dateTime={item.at?.toISOString()}>
            {recent && recent !== formatDate(item.at!) ? `${recent} · ${when}` : when}
          </time>
        ) : null}
      </p>

      {/* WHAT THEY TAPPED — exactly the ratings and specifics they chose. */}
      {tapped ? (
        <section className="mt-7" aria-labelledby="entry-gave">
          <h2 id="entry-gave" className={clsx(EYEBROW, 'text-ink-500')}>
            {t('common.review.gave')}
          </h2>
          {gave.dimensions.length > 0 ? (
            <dl className="mt-2 divide-y divide-ink-200 border-y border-ink-200">
              {gave.dimensions.map((d) => (
                <div key={d.label} className="flex min-h-11 items-center justify-between gap-3 text-[14px]">
                  <dt className="text-ink-700">{d.label}</dt>
                  <dd
                    className={clsx(
                      'font-semibold tabular-nums',
                      d.rating <= 2 ? 'text-bad-700' : d.rating === 3 ? 'text-ink-600' : 'text-good-700',
                    )}
                  >
                    {d.rating}
                    <span className="font-normal text-ink-400">/5</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {gave.selected.length > 0 ? (
            <div className="mt-3">
              <p className="text-[12px] font-semibold text-bad-700">{t('common.review.problems')}</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {gave.selected.map((label) => (
                  <li key={label} className="rounded-full border border-bad-200 bg-bad-50 px-3 py-1 text-[13px] text-bad-700">
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {gave.liked.length > 0 ? (
            <div className="mt-3">
              <p className="text-[12px] font-semibold text-good-700">{t('common.review.liked')}</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {gave.liked.map((label) => (
                  <li key={label} className="rounded-full border border-good-200 bg-good-50 px-3 py-1 text-[13px] text-good-700">
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* WHAT HEADWAY MADE OF IT — a reading, labelled as one. */}
      <section className="mt-7" aria-labelledby="entry-read">
        <h2 id="entry-read" className={clsx(EYEBROW, 'text-ink-500')}>
          {t('common.review.understood')}
        </h2>
        {item.state === 'ANALYSED' ? (
          <div className="mt-2 space-y-3">
            {item.topics.length > 0 ? (
              <div>
                <p className="text-[13px] text-ink-600">{t('feedback.entry.filed')}</p>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {item.topics.map((topic) => (
                    <li key={topic.key}>
                      <UpLink
                        href={`${reviews}?theme=${encodeURIComponent(topic.key)}`}
                        basePath={basePath}
                        className="inline-flex min-h-11 items-center gap-1 rounded-full border border-ink-300 bg-white px-4 text-[14px] font-medium text-ink-900 hover:border-ink-900"
                      >
                        {topic.label} <span aria-hidden className="text-ink-400">›</span>
                      </UpLink>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[14px] text-ink-600">{t('common.review.noTopic')}</p>
            )}
            <p className="text-[14px] text-ink-700">{item.sentimentLabel}</p>
            {item.classLabel ? (
              <p className="text-[14px] text-ink-700">
                <span className="text-ink-500">{t('common.review.sortedAs')}</span> {item.classLabel}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 flex items-center gap-2 text-[14px] text-ink-700">
            {item.state === 'PROCESSING' || item.state === 'COLLECTED' ? (
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 motion-safe:animate-pulse" />
            ) : null}
            {item.state === 'PROCESSING'
              ? t('common.review.reading')
              : item.state === 'FAILED'
                ? t('common.review.failed')
                : t('common.review.waiting')}
          </p>
        )}
      </section>

      {/* A suggested reply, when the reply engine wrote one. Never sent by
          Headway: the owner copies it, or doesn't. */}
      {item.replyState ? (
        <section className="mt-7" aria-labelledby="entry-reply">
          <h2 id="entry-reply" className={clsx(EYEBROW, 'text-ink-500')}>
            {t('common.review.suggestedReply')}
          </h2>
          <p className="mt-1.5 text-[13px] font-medium text-ink-700">
            {item.replyState === 'SUGGESTED'
              ? t('common.review.needsAnswerDraft')
              : item.replyState === 'YOURS'
                ? t('common.review.needsAnswerNoDraft')
                : item.replyState === 'DRAFT'
                  ? t('common.review.answerOptionalDraft')
                  : t('common.review.answered')}
          </p>
          {item.suggestedReply ? (
            <p className="mt-2 border-l-2 border-ink-200 pl-3 text-[15px] leading-relaxed whitespace-pre-line text-ink-800">
              {item.suggestedReply}
            </p>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
