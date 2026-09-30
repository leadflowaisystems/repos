import clsx from 'clsx';
import { HeadwayMark } from '@/components/brand';
import { formatDate } from '@/lib/format';
import { DEMO_BUSINESS, HOME_BRIEF } from '@/lib/marketing/demo';
import { Stars } from './primitives';

/**
 * HOME, FOR THE DEMO BUSINESS — AS THE WORKSPACE DRAWS IT TODAY.
 *
 * The owner's workspace is phone-first: a navy band with the business's own
 * name, then the one thing that needs attention, then the newest customers in
 * their own words, with four doors along the bottom. This is that screen,
 * drawn with the brief's own layout and the dictionary's own words
 * (`components/workspace/brief.tsx`), for Corner Cafe.
 *
 * It is a drawing, not a live workspace: the Home it copies lives behind a
 * sign-in and reads a database, and the public site does neither. So it shows
 * only what `HOME_BRIEF` can stand behind — the count, the movement, the
 * suggestion, the loop line a measured change prints, the three newest
 * entries — and leaves out what it cannot, rather than filling the space. On
 * a wide screen, two more of the brief's blocks sit beside the phone:
 * Customers love, and the owner's own change with its before and after.
 *
 * Nothing in it is a control. Every "button" is part of the picture, marked
 * aria-hidden, because a button on a marketing page that goes nowhere is worse
 * than one that is plainly an illustration.
 */

const EYEBROW = 'text-[10px] font-semibold tracking-[0.14em] uppercase';

function Phone() {
  const { attention, latest } = HOME_BRIEF;
  return (
    <div className="relative mx-auto w-full max-w-[320px] rounded-[2.6rem] bg-ink-950 p-2.5 shadow-[0_2px_4px_rgb(11_31_51/0.12),0_40px_80px_-32px_rgb(11_31_51/0.55)]">
      <div className="overflow-hidden rounded-[2.1rem] bg-ink-50">
        {/* The app bar and the band: one navy surface, as on a phone. */}
        <div className="bg-ink-900 px-4 pt-3 pb-5 text-white">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5">
              <HeadwayMark tone="dark" className="h-4 w-4 shrink-0" />
              <span className="text-[12px] leading-none font-semibold tracking-[-0.02em] text-white">Headway</span>
            </span>
            <span className="truncate pl-3 text-[10px] text-ink-300">{DEMO_BUSINESS.verticalLabel}</span>
          </div>
          <p className="mt-4 text-[11px] text-ink-300">Good morning</p>
          <p className="mt-0.5 font-display text-[26px] leading-[1.1] font-semibold tracking-[-0.01em]">
            {DEMO_BUSINESS.name}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-300">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            Read from {DEMO_BUSINESS.total} feedback entries
          </p>
        </div>

        <div className="space-y-4 px-3 pt-3 pb-4">
          {/* THE STORY — the one thing that needs attention. */}
          <div className="rounded-2xl border border-ink-200 bg-white p-4">
            <p className={clsx(EYEBROW, 'flex items-center gap-1.5 text-bad-700')}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-bad-600" />
              Needs your attention
            </p>
            <p className="mt-1.5 font-display text-[22px] leading-[1.12] font-semibold text-ink-900">
              {attention.label}
            </p>
            <p className="mt-1 text-[14px] font-semibold text-ink-900 tabular-nums">
              {attention.mentioned} customers mentioned it
            </p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <span className="text-[13px] font-semibold text-bad-700">
                <span aria-hidden>{attention.trend.mark}</span> {attention.trend.label}
              </span>
              <span className="text-[11px] text-ink-500 tabular-nums">{attention.trend.counts}</span>
            </p>
            <div className="mt-3 rounded-xl bg-canvas px-3 py-2.5">
              <p className={clsx(EYEBROW, 'text-ink-500')}>What to do</p>
              <p className="mt-1 text-[13px] leading-snug font-semibold text-ink-900">{attention.suggestion}</p>
            </div>
            <p className="mt-3 border-l-2 border-ink-300 pl-2.5 text-[11px] leading-snug text-ink-600">
              {attention.loopLine}
            </p>
            <p className="mt-2.5 text-[12px] font-medium text-ink-900">
              See why <span aria-hidden>▸</span>
            </p>
          </div>

          {/* LATEST FROM CUSTOMERS — the three newest, read or not. */}
          <div>
            <p className={clsx(EYEBROW, 'px-1 text-ink-500')}>Latest from customers</p>
            <ul className="mt-1.5 divide-y divide-ink-200 overflow-hidden rounded-xl border border-ink-200 bg-white">
              {latest.map((entry) => (
                <li key={entry.at.toISOString()} className="flex items-center gap-2 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    {entry.text ? (
                      <span className="line-clamp-1 block text-[12.5px] leading-snug text-ink-900">
                        &ldquo;{entry.text}&rdquo;
                      </span>
                    ) : (
                      <span className="block text-[12px] leading-snug text-ink-500 italic">
                        Rated without writing anything
                      </span>
                    )}
                    <span className="mt-0.5 flex items-center gap-2 text-[10.5px] text-ink-500">
                      <Stars value={entry.stars} />
                      <span className="tabular-nums">{formatDate(entry.at)}</span>
                    </span>
                  </span>
                  <span aria-hidden className="text-[15px] text-ink-300">
                    ›
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* The four doors along the bottom of the phone. */}
        <ul className="grid grid-cols-4 border-t border-ink-200 bg-white px-1 pt-2 pb-3" aria-hidden>
          {['Home', 'Feedback', 'Trends', 'More'].map((door, i) => (
            <li key={door} className="flex flex-col items-center gap-1">
              <span className={clsx('h-1 w-5 rounded-full', i === 0 ? 'bg-ink-900' : 'bg-transparent')} />
              <span className={clsx('text-[10.5px]', i === 0 ? 'font-semibold text-ink-900' : 'text-ink-500')}>
                {door}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SideCards() {
  const { loved, change } = HOME_BRIEF;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_18_26/0.04),0_18px_36px_-24px_rgb(16_42_67/0.3)]">
        <p className={clsx(EYEBROW, 'flex items-center gap-1.5 text-good-700')}>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-good-600" />
          Customers love
        </p>
        <p className="mt-1 text-[11px] text-ink-600">Keep doing this.</p>
        <p className="mt-2 text-[15px] leading-snug font-semibold text-ink-900">{loved.label}</p>
        <p className="mt-0.5 text-[13px] text-ink-700 tabular-nums">{loved.praised} customers praised it</p>
        <p className="mt-0.5 text-[13px] font-semibold text-good-700">
          <span aria-hidden>↑</span> {loved.trend}
        </p>
      </div>
      <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_18_26/0.04),0_18px_36px_-24px_rgb(16_42_67/0.3)]">
        <p className={clsx(EYEBROW, 'text-ink-500')}>Your changes</p>
        <p className="mt-2 text-[14px] leading-snug font-semibold text-ink-900">{change.about}</p>
        <p className="mt-1 text-[12px] font-medium text-bad-700">{change.state}</p>
        <p className="mt-2 font-mono text-[18px] font-semibold text-ink-900 tabular-nums">
          <span className="text-ink-500">{change.before}</span> <span aria-hidden className="text-ink-400">→</span>
          <span className="sr-only">then</span> {change.after}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-500">Feedback entries mentioning it, before and after</p>
      </div>
      <div className="flex items-center gap-2 px-1 text-[12px] text-ink-500">
        <HeadwayMark className="h-4 w-4" />
        Installs on a phone like an app.
      </div>
    </div>
  );
}

export function HomePreview() {
  return (
    <figure className="hw-rise min-w-0">
      <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[minmax(0,20rem)_minmax(0,15rem)] sm:justify-center lg:grid-cols-1 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <Phone />
        <div className="hidden sm:block lg:hidden xl:block">
          <SideCards />
        </div>
      </div>
      <figcaption className="mx-auto mt-4 max-w-md text-center text-[12px] leading-relaxed text-ink-500 xl:mx-0 xl:max-w-none xl:text-left">
        Home for Corner Cafe, Headway&rsquo;s demonstration business, drawn in the workspace&rsquo;s own
        layout and words. Every figure comes from its {DEMO_BUSINESS.total} feedback entries.
      </figcaption>
    </figure>
  );
}
