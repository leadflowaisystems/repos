import Link from 'next/link';
import clsx from 'clsx';
import { Badge } from '@/components/ui';
import { formatDate } from '@/lib/format';
import type { CommandCard as CommandCardData } from '@/lib/command/board';
import type { HealthStatus } from '@/lib/health/rules';

/**
 * One client, as a card you can act on without opening them.
 *
 * The layout follows the question the operator is actually asking, in order:
 * who is this, how bad is it, why, and what do I do. Anything that does not
 * help answer one of those is not on the card — no decorative metrics, no
 * counters with nothing attached to them.
 */

const STATUS_TONE: Record<HealthStatus, 'good' | 'warn' | 'bad' | 'neutral'> = {
  HEALTHY: 'good',
  WATCH: 'warn',
  ATTENTION: 'bad',
  INSUFFICIENT_DATA: 'neutral',
};

/** How many reasons to show before it stops being scannable. */
const MAX_REASONS = 3;

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-ink-200 px-2 py-0.5 text-[11px] text-ink-600">
      {children}
    </span>
  );
}

/**
 * WHY EVERY LINK IN THIS FILE SETS prefetch={false} (M20).
 *
 * This card renders once per client, and it carries nine links, every one of
 * them to a per-client dynamic route under /clients/[id] — the client page
 * itself, its feedback view, its minutes, its snapshots, its QR page, its kit.
 * Next.js prefetches a <Link> as soon as it is on screen, so the command centre
 * asks the server to start rendering nine expensive routes for EVERY business
 * the operator has, before they click anything at all. Ten clients is ninety.
 *
 * The same mistake was fixed on /clients, where the measurement was taken: 44
 * client-detail renders for 8 clicks, peaking at 6 concurrent, and a real click
 * queued behind the speculative ones until the browser ran out of connections.
 * That number belongs to that list and is not restated here; what makes this
 * one worse is arithmetic — nine links per card instead of one.
 *
 * Nothing about navigation changes. The routes still load on click, and
 * /clients/[id] has its own loading.tsx, so the operator sees the page frame
 * immediately either way. What goes away is the work nobody asked for.
 */
export function CommandCard({ card }: { card: CommandCardData }) {
  const urgent = card.band === 'NOW';
  const base = `/clients/${card.clientId}`;

  // The low-data box explains some signals in more detail than the reason line
  // does. Showing both says the same thing twice on the emptiest cards, which
  // is exactly where clutter hurts most.
  const covered = new Set(card.lowData?.supersedes ?? []);
  const reasons = [...card.signals]
    .filter((signal) => !covered.has(signal.key))
    .sort((a, b) => b.weight - a.weight)
    .map((signal) => signal.reason);

  return (
    <article
      className={clsx(
        // Full height and a column layout so the action bar pins to the bottom
        // of the row: two cards side by side must line their buttons up.
        'flex h-full flex-col rounded-xl border bg-white transition-shadow hover:shadow-sm',
        urgent ? 'border-bad-200' : 'border-ink-200',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <div className="min-w-0">
          <Link
            prefetch={false}
            href={base}
            className="block truncate text-[15px] font-semibold text-ink-900 hover:underline underline-offset-2"
          >
            {card.businessName}
          </Link>
          <p className="mt-0.5 text-[12px] text-ink-500">{card.verticalLabel}</p>
        </div>
        {/* Scoped on purpose: this status is about snapshots. Without the
            word "Health" it reads as a verdict on the whole client, which
            looks wrong beside a named complaint with real counts. */}
        <Badge tone={STATUS_TONE[card.status]}>Health: {card.statusLabel}</Badge>
      </div>

      <div className="flex-1 space-y-4 px-5 py-4">
        {/* ---- Why this client is here ---- */}
        {reasons.length > 0 ? (
          <ul className="space-y-1.5">
            {reasons.slice(0, MAX_REASONS).map((reason) => (
              <li
                key={reason}
                className="flex gap-2 text-[13px] leading-relaxed text-ink-700"
              >
                <span aria-hidden className="text-ink-400">
                  ·
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        ) : card.lowData ? null : (
          <p className="text-[13px] leading-relaxed text-ink-500">
            Nothing is flagging here right now.
          </p>
        )}

        {/* ---- What is missing, when it is too early to say anything ---- */}
        {card.lowData ? (
          <div className="rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-3">
            <p className="text-[13px] font-medium text-ink-800">
              {card.lowData.missing}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-600">
              {card.lowData.why}
            </p>
          </div>
        ) : null}

        {/* ---- The one thing worth fixing ---- */}
        {card.topIssue ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              Biggest complaint
            </p>
            <p className="text-[13px] leading-relaxed text-ink-800">
              <Link
                prefetch={false}
                href={`${base}/feedback?theme=${encodeURIComponent(card.topIssue.key)}`}
                className="font-medium underline underline-offset-2"
              >
                {card.topIssue.label}
              </Link>{' '}
              <span className="text-ink-500">
                · {card.topIssue.count} mentions
              </span>
            </p>
            {card.recommendation ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                {card.recommendation}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ---- Movement since the previous check-in ---- */}
        {card.change ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              Since last check-in
            </p>
            <p className="text-[13px] leading-relaxed text-ink-700">{card.change}</p>
          </div>
        ) : null}

        {/* ---- The improvement loop, when there is one ---- */}
        {card.actions.lastResult ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              Last change measured
            </p>
            <p className="text-[13px] leading-relaxed text-ink-700">
              <span className="font-medium">{card.actions.lastResult.themeLabel}</span>{' '}
              <span className="text-ink-600">{card.actions.lastResult.label}</span>
            </p>
          </div>
        ) : card.actions.awaitingEvidence > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              Change made
            </p>
            <p className="text-[13px] leading-relaxed text-ink-700">
              Waiting for enough new feedback to see whether it made a difference.
            </p>
          </div>
        ) : null}

        {/* ---- What is already prepared and what memory exists ---- */}
        <div className="flex flex-wrap items-center gap-1.5">
          {card.ownerUpdateReady ? (
            <Chip>Owner update ready</Chip>
          ) : (
            <Chip>No owner update yet</Chip>
          )}
          {card.feedback.draftsReady > 0 ? (
            <Chip>{card.feedback.draftsReady} replies drafted</Chip>
          ) : null}
          {card.memory.lastFollowUpTitle ? (
            <Chip>Follow-up noted</Chip>
          ) : null}
          {card.lastActivityAt ? (
            <Chip>Last activity {formatDate(card.lastActivityAt)}</Chip>
          ) : (
            <Chip>No activity yet</Chip>
          )}
        </div>
      </div>

      {/* ---- The next thing to do ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-ink-50 px-5 py-3">
        <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-ink-600">
          {card.nextAction.detail}
        </p>
        <Link
          prefetch={false}
          href={card.nextAction.href}
          className={clsx(
            'shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors',
            urgent
              ? 'bg-ink-900 text-white hover:bg-ink-800'
              : 'border border-ink-300 text-ink-800 hover:bg-white',
          )}
        >
          {card.nextAction.label}
        </Link>
      </div>

      {/* ---- Everything else, one click away ---- */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-ink-100 px-5 py-2.5 text-[12px]">
        <Link href={`${base}/feedback`} prefetch={false} className="text-ink-600 hover:underline">
          Feedback{card.feedback.total > 0 ? ` (${card.feedback.total})` : ''}
        </Link>
        <Link href={`${base}#owner-update`} prefetch={false} className="text-ink-600 hover:underline">
          Owner update
        </Link>
        <Link href={`${base}/minutes`} prefetch={false} className="text-ink-600 hover:underline">
          Minutes
        </Link>
        <Link href={`${base}/snapshots`} prefetch={false} className="text-ink-600 hover:underline">
          Check-ins
        </Link>
        {/* The primary customer-voice channel had no route from the board at
            all, while the printed kit did (M17). */}
        <Link href={`${base}/qr`} prefetch={false} className="text-ink-600 hover:underline">
          Feedback QR
        </Link>
        <Link href={`${base}/kit`} prefetch={false} className="text-ink-600 hover:underline">
          Cards
        </Link>
      </div>
    </article>
  );
}
