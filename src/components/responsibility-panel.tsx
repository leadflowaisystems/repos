import Link from 'next/link';
import { Badge, Card, CardBody, CardHeader, LinkButton } from '@/components/ui';
import type { Responsibility, ResponsibilityItem, ResponsibilityState } from '@/lib/responsibility/engine';

/**
 * RESPONSIBILITY, AS THE OPERATOR SEES IT (M15).
 *
 * The same object the owner's Home is built from, on the operator's client
 * page, so the two can never disagree about what needs doing. Compact: the
 * answer, the things that need the owner, and a link to the owner's view.
 * The operator's own next actions live on the command centre already; this
 * panel is about the business, not the operator's queue.
 */

const TONE: Record<ResponsibilityState, 'good' | 'warn' | 'bad' | 'neutral' | 'brand'> = {
  DO_NOW: 'bad',
  FOLLOW_UP: 'warn',
  WATCH: 'neutral',
  KEEP_DOING: 'good',
  WAITING_FOR_EVIDENCE: 'neutral',
  CLEAR: 'good',
};

function evidenceHref(clientId: string, item: ResponsibilityItem): string {
  if (item.themeKey) return `/clients/${clientId}/feedback?theme=${encodeURIComponent(item.themeKey)}`;
  return `/clients/${clientId}/feedback?action=NEEDS_HUMAN`;
}

function Row({ item, clientId }: { item: ResponsibilityItem; clientId: string }) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TONE[item.state]}>{item.stateLabel}</Badge>
        <span className="text-[12px] text-ink-500">{item.instruction}</span>
        {item.evidence ? (
          <span className="text-[12px] text-ink-500 tabular-nums">
            · {item.evidence.count} of {item.evidence.outOf}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[14px] leading-snug font-semibold text-ink-900">{item.headline}</p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-ink-700">
        <span className="font-medium text-ink-800">Next: </span>
        {item.recommendedNextStep}
      </p>
      {item.contextNote ? (
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">{item.contextNote}</p>
      ) : null}
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        <Link href={evidenceHref(clientId, item)} className="font-medium text-brand-700 underline underline-offset-2">
          Evidence
        </Link>
        {item.relatedAction ? (
          <Link href={`/clients/${clientId}#actions`} className="font-medium text-brand-700 underline underline-offset-2">
            The improvement
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export function ResponsibilityPanel({
  r,
  clientId,
}: {
  r: Responsibility;
  clientId: string;
}) {
  const carried = r.watching.length;
  return (
    <Card id="responsibility">
      <CardHeader
        title="Does the owner need to do anything?"
        description={r.answerDetail}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TONE[r.state]}>{r.answer}</Badge>
            <LinkButton href={`/workspace/${clientId}`}>Open client view</LinkButton>
          </div>
        }
      />
      <CardBody className="space-y-4">
        {r.needsYou.length > 0 ? (
          <ul className="divide-y divide-ink-100">
            {r.needsYou.map((item) => (
              <Row key={item.id} item={item} clientId={clientId} />
            ))}
          </ul>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              {r.sinceLabel}
            </p>
            {r.did.length > 0 ? (
              <ul className="space-y-1">
                {r.did.map((line) => (
                  <li key={line} className="text-[13px] leading-relaxed text-ink-600">
                    · {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-500">Nothing to report yet.</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              Headway is carrying
            </p>
            {carried > 0 ? (
              <ul className="space-y-1">
                {r.watching.slice(0, 4).map((item) => (
                  <li key={item.id} className="text-[13px] leading-relaxed text-ink-600">
                    <span className="font-medium text-ink-800">{item.stateLabel}.</span> {item.headline}
                  </li>
                ))}
                {carried > 4 ? (
                  <li className="text-[12px] text-ink-500">and {carried - 4} more on the client view.</li>
                ) : null}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-500">Nothing yet.</p>
            )}
            <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
              <span className="font-medium text-ink-700">Next check: </span>
              {r.nextUsefulCheck}
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
