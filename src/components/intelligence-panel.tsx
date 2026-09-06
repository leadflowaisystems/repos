import Link from 'next/link';
import { Badge, Card, CardBody, CardHeader } from '@/components/ui';
import { CreateActionButton } from '@/components/forms/improvement-actions';
import { formatDate } from '@/lib/format';
import type {
  ClientIntelligence,
  Insight,
  TrendState,
} from '@/lib/intelligence/engine';

/**
 * WHAT YOUR CUSTOMERS ARE TELLING YOU (M10).
 *
 * Deliberately not an analytics wall. The operator gets at most three things
 * customers are actually saying, each with the reviews behind it one click
 * away, and an honest statement of what there is not yet enough evidence to
 * say. Three understood signals beat thirty metrics nobody reads.
 *
 * Nothing on this panel is calculated here. Every sentence, count and verdict
 * comes from the intelligence engine, which is also what the owner update is
 * built from — the screen and the message cannot disagree.
 */

const TREND_TONE: Record<TrendState, 'good' | 'warn' | 'bad' | 'neutral'> = {
  IMPROVING: 'good',
  WORSENING: 'bad',
  STABLE: 'neutral',
  INSUFFICIENT_DATA: 'neutral',
};

const TREND_LABEL: Record<TrendState, string> = {
  IMPROVING: 'Improving',
  WORSENING: 'Getting worse',
  STABLE: 'Holding steady',
  INSUFFICIENT_DATA: 'Not enough to compare',
};

const KIND_LABEL: Record<Insight['kind'], string> = {
  ATTENTION: 'Needs attention',
  UNHAPPY: 'Complaint',
  LOVED: 'Praised',
  CHANGING: 'Changing',
};

const KIND_TONE: Record<
  Insight['kind'],
  'good' | 'warn' | 'bad' | 'neutral' | 'brand'
> = {
  ATTENTION: 'bad',
  UNHAPPY: 'warn',
  LOVED: 'good',
  CHANGING: 'brand',
};

const CONFIDENCE_LABEL: Record<Insight['confidence'], string> = {
  STRONG: 'Strong evidence',
  MODERATE: 'Clear pattern',
  EARLY: 'Early signal',
};

function evidenceHref(clientId: string, themeKey: string): string {
  return `/clients/${clientId}/feedback?theme=${encodeURIComponent(themeKey)}`;
}

/**
 * One insight, with its evidence and its reasons.
 *
 * "Why did RepOS say this?" is answered in place: the counts are in the text,
 * the reviews are one click away, and the ranking reasons are one disclosure
 * away. Nothing needs to be taken on trust.
 */
function InsightBlock({
  insight,
  actionedInsightIds,
}: {
  insight: Insight;
  /** Insights this client already has an improvement action for. */
  actionedInsightIds: ReadonlySet<string>;
}) {
  return (
    <article className="rounded-xl border border-ink-200 bg-white px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={KIND_TONE[insight.kind]}>{KIND_LABEL[insight.kind]}</Badge>
        <span className="text-[11px] text-ink-500">
          {CONFIDENCE_LABEL[insight.confidence]}
        </span>
      </div>

      <p className="text-[15px] leading-snug font-semibold text-ink-900">
        {insight.headline}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{insight.detail}</p>

      {/* On a block that is not itself about the change, the movement is still
          worth a line: a complaint that is coming down reads very differently
          from one that is climbing. */}
      {insight.kind !== 'CHANGING' &&
      insight.movement.pointNote &&
      (insight.movement.state === 'IMPROVING' ||
        insight.movement.state === 'WORSENING') ? (
        <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
          <span className="font-medium text-ink-700">Since your last check-in: </span>
          {insight.movement.pointNote}
        </p>
      ) : null}

      {insight.recommendation ? (
        <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-[13px] leading-relaxed text-ink-700">
          <span className="font-medium text-ink-800">Suggested step: </span>
          {insight.recommendation}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
        <Link
          href={evidenceHref(insight.clientId, insight.themeKey)}
          className="font-medium text-brand-700 underline underline-offset-2"
        >
          Read the {insight.evidence.count} review
          {insight.evidence.count === 1 ? '' : 's'} behind this
        </Link>
        <span className="text-ink-500">{insight.confidenceReason}</span>
      </div>

      {/* The loop starts here: the operator has just read the evidence, so
          this is the one place where turning it into a change costs nothing. */}
      {insight.sentiment === 'ISSUE' ? (
        <div className="mt-3">
          <CreateActionButton
            clientId={insight.clientId}
            insightId={insight.id}
            existing={actionedInsightIds.has(insight.id)}
          />
        </div>
      ) : null}

      <details className="mt-2 group">
        <summary className="cursor-pointer list-none text-[12px] text-ink-500 underline underline-offset-2 hover:text-ink-700">
          Why did Headway pick this?
        </summary>
        <ul className="mt-2 space-y-1 border-l-2 border-ink-100 pl-3">
          {insight.signals.map((signal) => (
            <li key={signal.key} className="text-[12px] leading-relaxed text-ink-600">
              {signal.reason}
            </li>
          ))}
          {insight.movement.available && insight.movement.pointNote ? (
            <li className="text-[12px] leading-relaxed text-ink-600">
              Between your two check-ins: {insight.movement.pointNote}
            </li>
          ) : null}
        </ul>
      </details>
    </article>
  );
}

/** A compact line for the full lists under the headline. */
function ThemeLine({ insight }: { insight: Insight }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-ink-100 py-2 last:border-0">
      <Link
        href={evidenceHref(insight.clientId, insight.themeKey)}
        className="text-[13px] font-medium text-ink-800 underline underline-offset-2"
      >
        {insight.themeLabel}
      </Link>
      <span className="text-[12px] text-ink-500">
        {insight.evidence.count} of {insight.evidence.outOf}
        {/* Only a movement the engine was willing to call a direction. A pair
            of counts too small to read as a change is not shown as one. */}
        {insight.movement.state === 'IMPROVING' ||
        insight.movement.state === 'WORSENING'
          ? ` · ${insight.movement.countNote}`
          : ''}
      </span>
    </li>
  );
}

function Column({
  title,
  empty,
  insights,
}: {
  title: string;
  empty: string;
  insights: Insight[];
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
        {title}
      </p>
      {insights.length === 0 ? (
        <p className="py-2 text-[13px] leading-relaxed text-ink-500">{empty}</p>
      ) : (
        <ul>
          {insights.map((insight) => (
            <ThemeLine key={insight.id} insight={insight} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function IntelligencePanel({
  intel,
  actionedInsightIds = new Set<string>(),
}: {
  intel: ClientIntelligence;
  actionedInsightIds?: ReadonlySet<string>;
}) {
  const hasSignals = intel.headline.length > 0;

  // "What is changing" already prints the reason there is no comparison. The
  // limits list carries it too, because the object has to be complete on its
  // own — but printing it twice on one screen reads as an error.
  const limits = intel.limits.filter((limit) => limit !== intel.window.reason);

  return (
    <Card id="intelligence">
      <CardHeader
        title="What your customers are telling you"
        description={intel.evidence.note}
        action={
          <Badge tone={TREND_TONE[intel.overallTrend]}>
            {TREND_LABEL[intel.overallTrend]}
          </Badge>
        }
      />
      <CardBody className="space-y-5">
        {/* ---- The three things worth knowing ---- */}
        {hasSignals ? (
          <div>
            <p className="mb-3 text-[13px] leading-relaxed text-ink-600">
              {intel.headlineNote}
            </p>
            <div className="space-y-3">
              {intel.headline.map((insight) => (
                <InsightBlock
                  key={insight.id}
                  insight={insight}
                  actionedInsightIds={actionedInsightIds}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-ink-200 bg-ink-50 px-5 py-4">
            <p className="text-[14px] font-semibold text-ink-800">
              Nothing has been said often enough to call a pattern yet.
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
              Headway names something once at least three customers have raised it.
              Until then it would be guessing, and a guess is worse than nothing.
            </p>
          </div>
        )}

        {/* ---- The full picture, for when the operator wants it ---- */}
        {(intel.loved.length > 0 || intel.unhappy.length > 0) && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Column
              title="What customers love"
              empty="Nothing has been praised by three or more customers yet."
              insights={intel.loved}
            />
            <Column
              title="What they are unhappy about"
              empty="No complaint has come up three or more times."
              insights={intel.unhappy}
            />
          </div>
        )}

        {/* ---- What moved, and between which two check-ins ---- */}
        <div>
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
            What is changing
          </p>
          {intel.window.available ? (
            <>
              <p className="text-[12px] leading-relaxed text-ink-500">
                {intel.window.note}
              </p>
              {intel.changing.length === 0 ? (
                <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
                  Nothing moved enough between the two check-ins to be worth
                  flagging.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {intel.changing.map((insight) => (
                    <li
                      key={insight.id}
                      className="text-[13px] leading-relaxed text-ink-700"
                    >
                      <span
                        className={
                          insight.movement.state === 'IMPROVING'
                            ? 'font-medium text-good-700'
                            : 'font-medium text-bad-700'
                        }
                      >
                        {insight.headline}
                      </span>{' '}
                      <span className="text-ink-600">
                        {insight.movement.pointNote}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-ink-600">
              {intel.window.reason}
            </p>
          )}
        </div>

        {/* ---- Operator memory, kept visibly apart from customer evidence ---- */}
        {intel.contextNotes.length > 0 ? (
          <div className="rounded-lg border border-dashed border-ink-300 bg-ink-50 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              Your own notes · not customer feedback
            </p>
            <ul className="mt-1.5 space-y-1">
              {intel.contextNotes.map((note) => (
                <li key={note.id} className="text-[13px] leading-relaxed text-ink-700">
                  {note.title}{' '}
                  <span className="text-ink-500">
                    · {formatDate(note.occurredAt)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-500">
              Context for you while you read the above. None of it is counted as
              something a customer said, and Headway does not claim any of it
              worked.
            </p>
          </div>
        ) : null}

        {/* ---- What RepOS cannot say yet ---- */}
        {limits.length > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
              What Headway cannot tell you yet
            </p>
            <ul className="space-y-1">
              {limits.map((limit) => (
                <li
                  key={limit}
                  className="flex gap-2 text-[12px] leading-relaxed text-ink-500"
                >
                  <span aria-hidden>·</span>
                  <span>{limit}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
