import clsx from 'clsx';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { DeleteMinuteButton } from '@/components/forms/minute-forms';
import type { MinuteRow } from '@/lib/minutes/service';
import { formatDate } from '@/lib/format';

/**
 * The memory view.
 *
 * Grouped by month so an operator scanning back through a client sees shape
 * rather than an undifferentiated CRM timeline. Entries that recorded a
 * decision or something still to do are marked, which is the only
 * action-awareness in M4 — the real action loop is M11.
 */

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
});

export function MinuteList({
  minutes,
  clientId,
  showActions = true,
}: {
  minutes: MinuteRow[];
  clientId: string;
  showActions?: boolean;
}) {
  const groups: Array<{ key: string; label: string; items: MinuteRow[] }> = [];
  for (const minute of minutes) {
    const key = monthKey(minute.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(minute);
    } else {
      groups.push({
        key,
        label: MONTH_LABEL.format(minute.occurredAt),
        items: [minute],
      });
    }
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key}>
          <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
            {group.label}
          </p>
          <div className="space-y-2">
            {group.items.map((minute) => (
              <MinuteCard
                key={minute.id}
                minute={minute}
                clientId={clientId}
                showActions={showActions}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MinuteCard({
  minute,
  clientId,
  showActions = true,
  context,
}: {
  minute: MinuteRow;
  clientId: string;
  showActions?: boolean;
  /** Business name, shown on the cross-client feed. */
  context?: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        'rounded-lg border px-4 py-3',
        minute.forwardLooking
          ? 'border-brand-200 bg-brand-50/50'
          : 'border-ink-200 bg-white',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={minute.forwardLooking ? 'brand' : 'neutral'}>
              {minute.categoryLabel}
            </Badge>
            <span className="text-[12px] text-ink-500">
              {formatDate(minute.occurredAt)}
            </span>
            {context ? (
              <span className="text-[12px] text-ink-500">· {context}</span>
            ) : null}
          </div>
          <p className="mt-1.5 text-[14px] font-medium text-ink-900">
            {minute.title}
          </p>
          {minute.body ? (
            <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-700">
              {minute.body}
            </p>
          ) : null}
        </div>

        {showActions ? (
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href={`/clients/${clientId}/minutes/${minute.id}`}
              className="rounded-lg px-2 py-1 text-[12px] font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            >
              Edit
            </Link>
            <DeleteMinuteButton
              clientId={clientId}
              minuteId={minute.id}
              title={minute.title}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
