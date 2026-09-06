import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getResponsibility } from '@/lib/responsibility/service';
import type { Responsibility } from '@/lib/responsibility/engine';
import {
  FactsLine,
  Knows,
  Limits,
  Picture,
  Question,
  Quiet,
  Section,
  SoFar,
  Tallies,
} from '@/components/portal/portal-ui';
import {
  Answer,
  NeedsYouItem,
  StrengthsList,
  WatchingList,
  WatchingPanel,
} from '@/components/portal/responsibility';
import { SinceVisit } from '@/components/workspace/since-visit';
import type { SinceLastVisit } from '@/lib/retention/service';
import { talliesFor } from '@/lib/portal/tallies';

/**
 * HOME — the briefing.
 *
 * An owner gives this page five seconds standing behind a counter. In that time
 * it has to answer, in this order and no other:
 *
 *   RIGHT NOW                    what are my customers saying?
 *   DO I NEED TO DO ANYTHING?    one decision, or an honest no
 *   HEADWAY IS WATCHING          what is being carried, so the no is believable
 *   NEEDS YOU                    the thing itself, if there is one
 *   GOING WELL                   what to protect
 *   SINCE YOU WERE LAST HERE     only when something happened
 *   WHAT'S NEXT                  the reason to come back
 *
 * IT IS A BRIEFING, NOT AN ARTICLE. Every block is scannable: an eyebrow, a
 * conclusion, and at most two supporting lines. The long reading lives on
 * Customers, the words on Reviews, the loop on Improvements, the movement on
 * Check-in. Home summarises and points. Anything that explains how Headway
 * works is said once, on the page whose job it is, and not here — and no
 * figure is stated twice on this page: the public rating lives in the tiles.
 *
 * Laid out once and adapted: on a phone the decision comes first and what
 * Headway is carrying follows it; on a laptop they sit side by side, which is
 * the pairing that makes "no, nothing today" trustworthy rather than thin.
 */

/**
 * The reason to come back, stated as a condition rather than a nudge: what
 * Headway did since the last check-in, and what would make the next one worth
 * opening. The full list of work lives on Check-in.
 */
function WhatsNext({ r, basePath }: { r: Responsibility; basePath: string }) {
  const since = r.did[0] ?? null;
  return (
    <div>
      {since ? <p className="text-[13px] leading-relaxed text-ink-600">{since}</p> : null}
      <p className="mt-2 border-l-2 border-ink-300 pl-3 text-[13px] leading-relaxed text-ink-700">
        <span className="font-medium text-ink-900">Next check.</span> {r.nextUsefulCheck}
      </p>
      <Link
        href={`${basePath}/checkin`}
        className="mt-1 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-ink-700 hover:text-ink-900"
      >
        Open your check-in <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

export async function PortalHome({
  clientId,
  basePath,
  since = null,
}: {
  clientId: string;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
  /**
   * What happened while this person was away, when there is a person and
   * something happened. The shared link has no visitor to remember, so it
   * passes nothing and the panel does not exist there.
   */
  since?: SinceLastVisit | null;
}) {
  const client = { id: clientId };
  const bundle = await getResponsibility(prisma, client.id);
  if (!bundle) notFound();
  const { view, responsibility: r } = bundle;

  const signalByTheme = new Map([...view.loved, ...view.unhappy].map((s) => [s.themeKey, s]));

  // The engine files a strength under "watching" — it is carrying it. On the
  // page, a thing going well and a thing being watched for trouble are not
  // the same news, and an owner should not have to read the chip to tell them
  // apart. Same items, same order; only the heading differs.
  const strengths = r.watching.filter((i) => i.state === 'KEEP_DOING');
  const watching = r.watching.filter((i) => i.state !== 'KEEP_DOING');

  // Before anything is a pattern, the current signals ARE the news: what the
  // first customers said, counted, and marked as not-yet-a-pattern. Once
  // patterns exist they take the stage and the full count lives on Customers.
  const named = view.loved.length + view.unhappy.length > 0;
  const reading = view.basedOn === 0 && view.soFar.waiting > 0;
  const showSoFar = !named && (view.basedOn > 0 || reading);

  // The direction, on one rule under the picture. The public rating is one of
  // the tiles further down and is not said twice.
  const direction = view.facts.filter((f) => f.label === 'Overall direction');
  const tallies = talliesFor(view, basePath);

  return (
    <>
      <Picture mood={view.mood} summary={view.summary} basis={view.basis} />
      <FactsLine facts={direction} />

      {/* The pairing. One decision, and the reason to trust it. */}
      {/* items-start, so each card is as tall as what it holds. Stretched to
          match, the shorter one ends in a panel of empty white that reads as a
          missing paragraph. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-5">
        <Answer r={r} basePath={basePath} />
        {watching.length > 0 ? <WatchingPanel items={watching} basePath={basePath} /> : null}
      </div>

      {r.needsYou.length > 0 ? (
        <Section eyebrow="Needs you">
          {/* A measure, not the container width. At 1366 the container is a
              thousand pixels across and a sentence set to it runs past a
              hundred and twenty characters, which is a paragraph nobody
              finishes. The empty space to the right is the point. */}
          <div className="max-w-3xl">
            {r.needsYou.map((item, index) => (
              <NeedsYouItem
                key={item.id}
                item={item}
                signal={item.themeKey ? (signalByTheme.get(item.themeKey) ?? null) : null}
                basePath={basePath}
                lead={index === 0}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {strengths.length > 0 ? (
        <Section eyebrow="Going well" note="Worth protecting">
          <div className="max-w-3xl">
            <StrengthsList items={strengths} basePath={basePath} />
          </div>
        </Section>
      ) : null}

      {since ? <SinceVisit since={since} basePath={basePath} /> : null}

      <Tallies tallies={tallies} />

      <div className="mt-10 grid grid-cols-1 items-start gap-x-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          {showSoFar ? (
            <Section
              eyebrow="What customers are mentioning so far"
              note="Current signals, not conclusions"
            >
              <SoFar soFar={view.soFar} basePath={basePath} />
            </Section>
          ) : null}

          {view.question ? (
            <Section eyebrow="What Headway needs from you">
              <Question q={view.question} />
            </Section>
          ) : null}

          {view.basedOn === 0 && !reading ? (
            <Section eyebrow="What customers are telling you">
              <Quiet>
                Your first customer signals will appear here. Headway is ready — once feedback
                starts arriving through your QR code, this page will say what matters and whether
                anything needs you.
              </Quiet>
            </Section>
          ) : null}

          {view.knows.length > 0 ? (
            <Section eyebrow="What Headway knows about your business" note="In your words">
              <Knows items={view.knows} basePath={basePath} />
            </Section>
          ) : null}
        </div>

        <aside className="min-w-0 lg:border-l lg:border-ink-200 lg:pl-8">
          {watching.length > 1 ? (
            <Section eyebrow="Also being watched">
              <WatchingList items={watching.slice(1)} basePath={basePath} />
            </Section>
          ) : null}

          {r.did.length > 0 || view.basedOn > 0 ? (
            <Section eyebrow="What's next" note="Your progress">
              <WhatsNext r={r} basePath={basePath} />
            </Section>
          ) : null}

          <Limits limits={r.limitations} collapsed />
        </aside>
      </div>
    </>
  );
}
