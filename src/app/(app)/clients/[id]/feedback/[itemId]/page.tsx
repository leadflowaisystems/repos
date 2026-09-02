import Link from 'next/link';
import { notFound } from 'next/navigation';
import clsx from 'clsx';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  LinkButton,
  Notice,
  PageHeader,
} from '@/components/ui';
import { DeleteFeedbackButton } from '@/components/forms/feedback-forms';
import {
  GenerateReplyButton,
  ReplyPanel,
} from '@/components/forms/reply-panel';
import { prisma } from '@/lib/db';
import { getFeedbackItem } from '@/lib/feedback/service';
import { languageLabel, sentimentLabel } from '@/lib/analysis/normalize';
import {
  priorityBandLabel,
  responseActionLabel,
  responseClassLabel,
  wantsDraft,
} from '@/lib/reply/triage';
import type { NormalizedTheme } from '@/lib/analysis/normalize';
import { formatDate, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

const SENTIMENT_TONE: Record<string, 'good' | 'bad' | 'warn' | 'neutral'> = {
  POSITIVE: 'good',
  NEGATIVE: 'bad',
  MIXED: 'warn',
  NEUTRAL: 'neutral',
};

/** Plain words for how much weight to put on the reading. No scores, no jargon. */
const CONFIDENCE_LABELS: Record<string, string> = {
  HIGH: 'Clear',
  MEDIUM: 'Fairly clear',
  LOW: 'Hard to tell',
};

const ACTION_TONE: Record<string, 'good' | 'bad' | 'warn' | 'brand' | 'neutral'> = {
  REPLY_RECOMMENDED: 'brand',
  REPLY_OPTIONAL: 'neutral',
  NO_RESPONSE_NEEDED: 'neutral',
  NEEDS_HUMAN: 'bad',
};

const BAND_TONE: Record<string, 'good' | 'bad' | 'warn' | 'neutral'> = {
  HIGH: 'bad',
  MEDIUM: 'warn',
  LOW: 'neutral',
  NONE: 'neutral',
};

export default async function FeedbackItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id, itemId } = await params;
  const query = await searchParams;

  // Scoped by client, so another client's item 404s rather than leaking.
  const item = await getFeedbackItem(prisma, id, itemId);
  if (!item) notFound();

  const praises = item.themes.filter((theme) => theme.sentiment === 'POSITIVE');
  const issues = item.themes.filter((theme) => theme.sentiment === 'NEGATIVE');
  const base = `/clients/${id}/feedback`;
  const handled = item.draftStatus === 'HANDLED';
  const showsReply = wantsDraft(item.responseAction) || item.draftText !== null;
  // A draft RepOS wrote under older rules is offered as a suggestion to redo,
  // not presented as current work.
  const draftIsStale = item.draftText !== null && !item.draftCurrent;

  return (
    <div className="space-y-5">
      {query.redrafted ? (
        <Notice tone="good">A fresh suggestion has been written.</Notice>
      ) : null}
      {query.handled === '1' ? <Notice tone="good">Marked handled.</Notice> : null}
      {query.handled === '0' ? <Notice tone="neutral">Reopened.</Notice> : null}
      {query.draftError ? <Notice tone="bad">{query.draftError}</Notice> : null}

      <PageHeader
        eyebrow="Feedback"
        title={item.stars !== null ? `${item.stars} star feedback` : 'Feedback'}
        description={`${item.sourceLabel} · ${
          item.reviewDate ? formatDate(item.reviewDate) : 'no date given'
        }`}
        actions={
          <>
            <LinkButton href={base}>Back to feedback</LinkButton>
            <DeleteFeedbackButton clientId={id} itemId={item.id} />
          </>
        }
      />

      <Card>
        <CardHeader
          title="What the customer said"
          description="Stored exactly as it came in, after personal details were removed."
        />
        <CardBody className="space-y-4">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink-900">
            {item.text}
          </p>

          <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4">
            <Badge tone="neutral">{item.sourceLabel}</Badge>
            {item.stars !== null ? <Badge>{item.stars} stars</Badge> : null}
            {item.analysed ? (
              <Badge tone={SENTIMENT_TONE[item.sentiment] ?? 'neutral'}>
                {sentimentLabel(item.sentiment)}
              </Badge>
            ) : (
              <Badge tone="brand">Not yet read</Badge>
            )}
            {item.language ? (
              <Badge tone="neutral">{languageLabel(item.language)}</Badge>
            ) : null}
          </div>

          {item.redacted ? (
            <Notice tone="neutral" title="Personal details were removed">
              Before saving, RepOS stripped:{' '}
              {item.redactions.length > 0
                ? item.redactions.join(', ')
                : 'personal details'}
              . Customer feedback is stored anonymously.
            </Notice>
          ) : null}

          <p className="text-[12px] text-ink-500">
            Brought in {formatDateTime(item.createdAt)}.
          </p>
        </CardBody>
      </Card>

      {/* ---- What RepOS made of it ---- */}
      <Card>
        <CardHeader
          title="What RepOS made of this"
          description="The reading behind the summary on the feedback page."
        />
        <CardBody className="space-y-5">
          {!item.analysed ? (
            <Notice tone="warn" title="Not read yet">
              RepOS has not read this one. Use{' '}
              <Link href={base} className="underline underline-offset-2">
                Read new
              </Link>{' '}
              on the feedback page and it will be picked up.
              {item.analysisError ? ` Last attempt: ${item.analysisError}` : ''}
            </Notice>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Overall">
                  <Badge tone={SENTIMENT_TONE[item.sentiment] ?? 'neutral'}>
                    {sentimentLabel(item.sentiment)}
                  </Badge>
                </Field>
                <Field label="How clear it is">
                  <span className="text-[14px] text-ink-800">
                    {CONFIDENCE_LABELS[item.confidence] ?? 'Hard to tell'}
                  </span>
                </Field>
                <Field label="Written in">
                  <span className="text-[14px] text-ink-800">
                    {languageLabel(item.language)}
                  </span>
                </Field>
              </div>

              {item.reasons.length > 0 ? (
                <div>
                  <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
                    Why
                  </p>
                  <ul className="space-y-1.5">
                    {item.reasons.map((reason) => (
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
                </div>
              ) : null}

              <div className="grid gap-5 border-t border-ink-100 pt-5 sm:grid-cols-2">
                <ThemeList
                  title="Happy about"
                  themes={praises}
                  base={base}
                  emptyLabel="Nothing specific praised here."
                />
                <ThemeList
                  title="Unhappy about"
                  themes={issues}
                  base={base}
                  emptyLabel="No complaints found here."
                />
              </div>

              {item.themes.length > 0 ? (
                <p className="text-[12px] text-ink-500">
                  Each one links to every other review that mentions the same thing.
                </p>
              ) : null}
            </>
          )}
        </CardBody>
      </Card>

      {/* ---- What to do about it ---- */}
      {item.analysed ? (
        <Card>
          <CardHeader
            title="What to do about it"
            description="RepOS suggests. You decide, and you do the sending."
          />
          <CardBody className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Recommended">
                <Badge tone={ACTION_TONE[item.responseAction] ?? 'neutral'}>
                  {responseActionLabel(item.responseAction)}
                </Badge>
              </Field>
              <Field label="Kind of message">
                <span className="text-[14px] text-ink-800">
                  {responseClassLabel(item.responseClass)}
                </span>
              </Field>
              <Field label="How soon">
                <Badge tone={BAND_TONE[item.priorityBand] ?? 'neutral'}>
                  {priorityBandLabel(item.priorityBand)}
                </Badge>
              </Field>
            </div>

            {item.priorityReasons.length > 0 ? (
              <div>
                <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
                  Why this ranking
                </p>
                <ul className="space-y-1.5">
                  {item.priorityReasons.map((reason) => (
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
              </div>
            ) : null}

            {item.responseAction === 'NEEDS_HUMAN' ? (
              <Notice tone="bad" title="RepOS has not written anything for this one">
                This needs your own words and your own judgement. A suggested reply
                would be the wrong tool here.
              </Notice>
            ) : null}

            {showsReply ? (
              <div className="border-t border-ink-100 pt-5">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
                    Suggested reply
                  </p>
                  {item.draftText ? (
                    <span className="text-[12px] text-ink-500">
                      {item.draftLanguage
                        ? `${DRAFT_LANGUAGE_LABELS[item.draftLanguage] ?? item.draftLanguage} · `
                        : ''}
                      {handled
                        ? 'Handled'
                        : draftIsStale
                          ? 'Written under older rules'
                          : 'Ready to copy'}
                    </span>
                  ) : null}
                </div>

                {item.draftText ? (
                  <ReplyPanel
                    clientId={id}
                    itemId={item.id}
                    draftText={item.draftText}
                    handled={handled}
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-[13px] text-ink-600">
                      {item.draftError
                        ? `The last attempt did not work: ${item.draftError}`
                        : 'Nothing written yet.'}
                    </p>
                    <GenerateReplyButton clientId={id} itemId={item.id} />
                  </div>
                )}

                {item.draftNotes.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {item.draftNotes.map((note) => (
                      <li key={note} className="text-[12px] text-ink-500">
                        {note}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

const DRAFT_LANGUAGE_LABELS: Record<string, string> = {
  ENGLISH: 'English',
  HINGLISH: 'Hinglish',
  MARATHI: 'Marathi',
  MIXED: 'Mixed',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function ThemeList({
  title,
  themes,
  base,
  emptyLabel,
}: {
  title: string;
  themes: NormalizedTheme[];
  base: string;
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
        {title}
      </p>
      {themes.length === 0 ? (
        <p className="text-[13px] text-ink-500">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {themes.map((theme) => (
            <li key={theme.key}>
              <Link
                href={`${base}?theme=${encodeURIComponent(theme.key)}`}
                className={clsx(
                  'inline-block rounded border px-2 py-1 text-[13px] hover:bg-ink-50',
                  theme.sentiment === 'POSITIVE'
                    ? 'border-good-200 text-good-700'
                    : 'border-bad-200 text-bad-700',
                )}
              >
                {theme.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
