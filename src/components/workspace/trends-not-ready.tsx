import clsx from 'clsx';
import { getTranslator } from '@/lib/i18n/request';
import type { TrendReadiness } from '@/lib/portal/trends';

/**
 * TRENDS AREN'T READY YET — the comparison, explained instead of left blank.
 *
 * Shown on Trends and on Check-in wherever the engine had no two check-ins it
 * could compare. One component, fed by one builder (`buildTrendReadiness`),
 * so both pages give the same reason with the same counts.
 *
 * It answers the four things an owner looking at an empty Trends page cannot
 * work out alone: how much Headway has read, whether a check-in exists, how
 * much has arrived since it, and what happens next. It explains the rule; it
 * does not decide it, and it never shows a direction — below two comparable
 * check-ins there is none to show.
 *
 * The progress marks appear only while a second check-in is being waited for,
 * and count responses, never a percentage.
 */
export async function TrendsNotReady({
  readiness,
  className,
}: {
  readiness: TrendReadiness;
  className?: string;
}) {
  if (readiness.state === 'READY') return null;
  const t = await getTranslator();
  const r = readiness;

  const checkins =
    r.checkins === 0 || !r.latest
      ? t('improvements.notReady.checkins.none')
      : r.checkins === 1
        ? t('improvements.notReady.checkins.single', { label: r.latest.label })
        : t('improvements.notReady.checkins.several', { count: r.checkins, label: r.latest.label });

  const waitingForSecond = r.state === 'ONE_CHECKIN' && !r.nextIsDue;
  const facts: Array<{ key: string; label: string; value: string }> = [
    { key: 'read', label: t('improvements.notReady.fact.read'), value: String(r.read) },
    { key: 'checkins', label: t('improvements.notReady.fact.checkins'), value: checkins },
    {
      key: 'since',
      label: r.checkins === 0 ? t('improvements.notReady.fact.waiting') : t('improvements.notReady.fact.since'),
      value: waitingForSecond
        ? t('improvements.notReady.progress', { count: r.since, need: r.worthAt })
        : String(r.since),
    },
  ];

  const next =
    r.state === 'NO_CHECKIN'
      ? t('improvements.notReady.next.none')
      : r.state === 'ONE_CHECKIN'
        ? r.nextIsDue
          ? t('improvements.notReady.next.oneDue')
          : t('improvements.notReady.next.oneWaiting', { need: r.worthAt })
        : t('improvements.notReady.next.thin', {
            previous: r.previous?.held ?? 0,
            current: r.latest?.held ?? 0,
            need: r.needPerSide,
          });

  return (
    <section
      aria-labelledby="trends-not-ready-title"
      className={clsx('rounded-2xl border border-ink-200 bg-white p-5 sm:p-6', className)}
    >
      <p className="text-[11px] font-semibold tracking-[0.14em] text-brand-700 uppercase">
        {t('improvements.notReady.eyebrow')}
      </p>
      <h2
        id="trends-not-ready-title"
        className="mt-1.5 font-display text-[22px] leading-[1.15] font-semibold text-ink-900 sm:text-[24px]"
      >
        {t('improvements.notReady.title')}
      </h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">{t('improvements.notReady.body')}</p>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-600">{t('improvements.notReady.explain')}</p>

      <dl className="mt-5 divide-y divide-ink-200 border-y border-ink-200">
        {facts.map((fact) => (
          <div key={fact.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
            <dt className="text-[14px] text-ink-700">{fact.label}</dt>
            <dd className="text-[15px] font-semibold text-ink-900 tabular-nums">{fact.value}</dd>
          </div>
        ))}
      </dl>

      {waitingForSecond ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={r.worthAt}
          aria-valuenow={Math.min(r.since, r.worthAt)}
          aria-valuetext={t('improvements.notReady.progress', { count: r.since, need: r.worthAt })}
          className="mt-3 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${r.worthAt}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: r.worthAt }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className={clsx('h-1.5 rounded-full', i < r.since ? 'bg-brand-500' : 'bg-ink-100')}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-5 border-l-2 border-ink-300 pl-3">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">
          {t('improvements.notReady.next.title')}
        </p>
        <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-800">{next}</p>
      </div>
    </section>
  );
}
