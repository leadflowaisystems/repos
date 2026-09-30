import clsx from 'clsx';
import { Link } from '@/components/portal/link';
import { HeadwayMark } from '@/components/brand';
import { getTranslator } from '@/lib/i18n/request';
import { readinessCopy, type Readiness } from '@/lib/portal/readiness';

/**
 * BEFORE THE FIRST READING — the one card every page shows instead.
 *
 * Home, Customers, the check-in family and Improvements each render this in
 * place of their reading while a business has fewer than FIRST_READING_AT
 * responses (see `src/lib/portal/readiness.ts`). One component and one
 * builder, so the words cannot drift apart between pages and an owner never
 * reads "almost there" on one screen and a trend on the next.
 *
 * It is deliberately not an empty state. It says what has arrived, that
 * Headway is working, exactly how far there is to go, and the one thing the
 * owner can do about it — with the way to their card and link one tap away,
 * and, once anything has arrived, the way to read it.
 *
 * The progress is five marks, not a percentage bar: at these numbers a
 * percentage looks like a finding, and five marks is something an owner can
 * count at a glance.
 */
export async function InsightsBuilding({
  readiness,
  basePath,
  className,
}: {
  readiness: Readiness;
  /** Where this door lives, so both links stay inside it. */
  basePath: string;
  className?: string;
}) {
  const t = await getTranslator();
  const copy = readinessCopy(readiness, t);
  if (!copy) return null;

  const marks = Array.from({ length: readiness.target }, (_, i) => i < readiness.count);

  return (
    <section
      aria-labelledby="insights-building-title"
      className={clsx('rounded-2xl border border-brand-200 bg-brand-50 p-5 sm:p-7', className)}
    >
      <div className="flex items-start gap-4">
        <HeadwayMark className="mt-1 h-9 w-9 shrink-0" />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-brand-700 uppercase">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-500 motion-safe:animate-pulse" />
            {copy.eyebrow}
          </p>
          <h2
            id="insights-building-title"
            className="mt-1.5 font-display text-[24px] leading-[1.15] font-semibold text-balance text-ink-900 sm:text-[27px]"
          >
            {copy.title}
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">{copy.body}</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[15px] font-semibold text-ink-900 tabular-nums">{copy.progress}</p>
          <p className="text-[13px] text-ink-600 tabular-nums">{copy.remaining}</p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={readiness.target}
          aria-valuenow={readiness.count}
          aria-valuetext={`${copy.progress}. ${copy.remaining}`}
          className="mt-2.5 grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${readiness.target}, minmax(0, 1fr))` }}
        >
          {marks.map((filled, i) => (
            <span
              key={i}
              aria-hidden
              className={clsx(
                'h-2 rounded-full',
                filled ? 'bg-brand-500' : 'bg-white ring-1 ring-brand-200 ring-inset',
              )}
            />
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-600">{copy.promise}</p>
      </div>

      <div className="mt-6 border-t border-brand-200 pt-4">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">
          {t('readiness.next.title')}
        </p>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-800">{copy.next}</p>
        <div className="mt-2 flex flex-wrap gap-x-6">
          <Link
            href={`${basePath}/kit`}
            className="inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-ink-900 underline decoration-brand-400 underline-offset-4 hover:decoration-ink-900"
          >
            {t('readiness.cta.kit')} <span aria-hidden>→</span>
          </Link>
          {readiness.count > 0 ? (
            <Link
              href={`${basePath}/reviews`}
              className="inline-flex min-h-11 items-center gap-1 text-[14px] font-medium text-ink-700 underline decoration-ink-300 underline-offset-4 hover:text-ink-900 hover:decoration-ink-900"
            >
              {t.plural('readiness.cta.read', readiness.count)} <span aria-hidden>→</span>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
