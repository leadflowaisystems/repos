import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getResponsibility } from '@/lib/responsibility/service';
import { getEvidenceIndex } from '@/lib/portal/service';
import type { Responsibility } from '@/lib/responsibility/engine';
import { buildFocus } from '@/lib/portal/focus';
import {
  Knows,
  Limits,
  Question,
  Quiet,
  Section,
  SoFar,
  Tallies,
} from '@/components/portal/portal-ui';
import { NeedsYouItem, StrengthsList, WatchingList } from '@/components/portal/responsibility';
import { Reveal } from '@/components/portal/disclose';
import { FocusBlock } from '@/components/workspace/focus';
import { SinceVisit } from '@/components/workspace/since-visit';
import type { SinceLastVisit } from '@/lib/retention/service';
import { talliesFor } from '@/lib/portal/tallies';

/**
 * HOME — the command centre (M24).
 *
 * An owner gives this page ten seconds standing behind a counter. In that
 * time it answers, in this order and no other:
 *
 *   RIGHT NOW                 what is the one thing that matters?
 *   DO I NEED TO ACT?         the same block: a decision, or an honest no
 *   WHAT EXACTLY?             your next step, one line
 *   HEADWAY IS WATCHING       what is being carried, so the no is believable
 *   GOING WELL                what to protect
 *   SINCE YOU WERE LAST HERE  only when something happened
 *   WHAT'S NEXT               what Headway will check, and when
 *
 * ONE BLOCK IS DOMINANT. The first block is the largest thing on the page
 * and the owner can stop after it: the headline, three figures that open
 * into their evidence, one gold button, the reading, the next step.
 * Everything below is smaller, and everything that explains method sits
 * behind a tap. No figure is stated twice: the public rating lives in the
 * tiles and nowhere else.
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
  const [bundle, evidence] = await Promise.all([
    getResponsibility(prisma, client.id),
    getEvidenceIndex(prisma, client.id),
  ]);
  if (!bundle) notFound();
  const { view, responsibility: r } = bundle;

  const focus = buildFocus({ responsibility: r, view, evidence, basePath });

  // The engine files a strength under "watching" — it is carrying it. On the
  // page, a thing going well and a thing being watched for trouble are not
  // the same news, and an owner should not have to read the chip to tell them
  // apart. Same items, same order; only the heading differs.
  const strengths = r.watching.filter((i) => i.state === 'KEEP_DOING');
  const watching = r.watching.filter((i) => i.state !== 'KEEP_DOING');
  // The first thing that needs the owner is the focus block. Anything else
  // that needs them — rare — follows as a compact item.
  const alsoNeedsYou = r.needsYou.slice(1);
  const signalByTheme = new Map([...view.loved, ...view.unhappy].map((s) => [s.themeKey, s]));

  // Before anything is a pattern, the current signals ARE the news: what the
  // first customers said, counted, and marked as not-yet-a-pattern. Once
  // patterns exist they take the stage and the full count lives on Customers.
  const named = view.loved.length + view.unhappy.length > 0;
  const reading = view.basedOn === 0 && view.soFar.waiting > 0;
  const showSoFar = !named && (view.basedOn > 0 || reading);

  const direction = view.facts.find((f) => f.label === 'Overall direction') ?? null;
  const tallies = talliesFor(view, basePath);

  return (
    <>
      <FocusBlock focus={focus} direction={direction} />

      {alsoNeedsYou.length > 0 ? (
        <Section eyebrow="Also needs you">
          <div className="max-w-3xl">
            {alsoNeedsYou.map((item) => (
              <NeedsYouItem
                key={item.id}
                item={item}
                signal={item.themeKey ? (signalByTheme.get(item.themeKey) ?? null) : null}
                basePath={basePath}
                lead={false}
              />
            ))}
          </div>
        </Section>
      ) : null}

      <div className="mt-8 grid grid-cols-1 items-start gap-x-10 gap-y-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          {watching.length > 0 ? (
            <Section eyebrow="Headway is watching" note="Nothing here needs you today">
              <WatchingList items={watching} basePath={basePath} />
            </Section>
          ) : null}

          {strengths.length > 0 ? (
            <Section eyebrow="Going well" note="Worth protecting">
              <StrengthsList items={strengths} basePath={basePath} />
            </Section>
          ) : null}

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
        </div>

        <aside className="min-w-0 lg:border-l lg:border-ink-200 lg:pl-8">
          {since ? <SinceVisit since={since} basePath={basePath} /> : null}

          {r.did.length > 0 || view.basedOn > 0 ? (
            <Section eyebrow="What's next" note="Your progress">
              <WhatsNext r={r} basePath={basePath} />
            </Section>
          ) : null}
        </aside>
      </div>

      <Tallies tallies={tallies} />

      {view.knows.length > 0 ? (
        <Reveal
          summary={<span className="tracking-widest uppercase">What Headway knows about your business</span>}
          className="mt-10 border-t border-ink-200 pt-4"
        >
          <Knows items={view.knows} basePath={basePath} />
        </Reveal>
      ) : null}

      <Limits limits={r.limitations} collapsed />
    </>
  );
}
