import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getResponsibility } from '@/lib/responsibility/service';
import {
  FactsLine,
  Knows,
  Limits,
  Picture,
  Question,
  Quiet,
  Section,
  SoFar,
  ThemeRows,
} from '@/components/portal/portal-ui';
import {
  Answer,
  NeedsYouItem,
  SinceThen,
  StrengthsList,
  WatchingList,
} from '@/components/portal/responsibility';

/**
 * HOME — what should I know, and do I need to do anything? (M12 + M15)
 *
 * Four questions, answered in the first screen and routed deeper:
 *
 *   1. What is happening with customers right now?   the picture
 *   2. Do I need to do anything?                      the answer, and the one thing
 *   3. What is RepOS watching?                        the side column
 *   4. What is still too early to know?               the limits
 *
 * Every theme appears once, under the state that explains why it is here.
 * The full reading is on Customers; the loop is on Improvements; the words
 * are on Reviews; the movement is on Check-in. Home summarises and points.
 *
 * Laid out once and adapted, not written twice: on a phone the main column
 * comes first and the side column follows; on a laptop they sit together.
 */
/**
 * The home page, as one implementation behind two doors (M20).
 *
 * Reached either through the owner's secret link (/portal/[token]) or through
 * an authenticated workspace (/workspace/[clientId]). Both resolve to a client
 * id first and neither is trusted here: whoever renders this has already
 * decided the caller may see this business.
 */
export async function PortalHome({
  clientId,
  basePath,
}: {
  clientId: string;
  /** Where this door lives, so links stay inside it. */
  basePath: string;
}) {
  const client = { id: clientId };
  const bundle = await getResponsibility(prisma, client.id);
  if (!bundle) notFound();
  const { view, responsibility: r } = bundle;

  const signalByTheme = new Map([...view.loved, ...view.unhappy].map((s) => [s.themeKey, s]));
  // A theme already placed above is not read again under "what changed".
  const placed = new Set(
    [...r.needsYou, ...r.watching].map((i) => i.themeKey).filter((k): k is string => k !== null),
  );
  const changedElsewhere = view.changed.filter((s) => !placed.has(s.themeKey));

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

  return (
    <>
      <Picture mood={view.mood} summary={view.summary} basis={view.basis} />
      <FactsLine facts={view.facts} />

      <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <Answer r={r} basePath={basePath} />

          {r.needsYou.length > 0 ? (
            <Section eyebrow="Needs you">
              <div>
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

          {showSoFar ? (
            <Section
              eyebrow="What customers are mentioning so far"
              note="Current signals, not conclusions"
            >
              <SoFar soFar={view.soFar} basePath={basePath} />
            </Section>
          ) : null}

          {strengths.length > 0 ? (
            <Section eyebrow="Going well" note="Customer strengths worth protecting">
              <StrengthsList items={strengths} basePath={basePath} />
            </Section>
          ) : null}

          {view.question ? (
            <Section eyebrow="What RepOS needs from you">
              <Question q={view.question} />
            </Section>
          ) : null}

          {view.basedOn === 0 && !reading ? (
            <Section eyebrow="What customers are telling you">
              <Quiet>
                Your first customer signals will appear here. RepOS is ready — once feedback starts
                arriving through your QR code, this page will say what matters and whether anything
                needs you.
              </Quiet>
            </Section>
          ) : null}
        </div>

        <aside className="min-w-0 lg:border-l lg:border-ink-200 lg:pl-8">
          {watching.length > 0 ? (
            <Section eyebrow="RepOS is watching">
              <WatchingList items={watching} basePath={basePath} />
            </Section>
          ) : null}

          {r.did.length > 0 || view.basedOn > 0 ? (
            <Section eyebrow={r.sinceLabel} note="Your progress">
              <SinceThen r={r} />
            </Section>
          ) : null}

          {view.knows.length > 0 ? (
            <Section eyebrow="What RepOS knows about your business" note="In your words">
              <Knows items={view.knows} basePath={basePath} />
            </Section>
          ) : null}

          {changedElsewhere.length > 0 ? (
            <Section eyebrow="What changed" note={view.changedNote}>
              <ThemeRows signals={changedElsewhere} basePath={basePath} />
            </Section>
          ) : null}

          {view.basedOn > 0 ? (
            <Section eyebrow="Not worth your time right now">
              <Quiet>{view.noAction}</Quiet>
            </Section>
          ) : null}

          <Limits limits={r.limitations} />
        </aside>
      </div>

      <p className="mt-10 max-w-3xl border-t border-ink-200 pt-5 text-[12px] leading-relaxed text-ink-400">
        Prepared for {view.businessName} from the feedback your customers have left. Every theme
        links to the comments it came from.
      </p>
    </>
  );
}
