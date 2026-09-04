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
  ThemeRows,
} from '@/components/portal/portal-ui';
import { Answer, NeedsYouItem, SinceThen, WatchingList } from '@/components/portal/responsibility';

/**
 * HOME — what should I know, and do I need to do anything? (M12 + M15)
 *
 * The order an owner thinks in:
 *
 *   the picture · do I need to do anything? · what needs me · what RepOS is
 *   watching for me · what RepOS did since my last check-in · what it knows
 *   about my business · what changed · what it needs from me · what not to
 *   worry about
 *
 * Every theme appears once, under the state that explains why it is here.
 * The full reading is on Customers; the loop is on Improvements; the words
 * are on Reviews; the movement is on Check-in.
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
  const nothingYet = r.needsYou.length === 0 && r.watching.length === 0;

  return (
    <>
      <Picture mood={view.mood} summary={view.summary} basis={view.basis} />
      <FactsLine facts={view.facts} />

      <Answer r={r} />

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

      {r.watching.length > 0 ? (
        <Section eyebrow="RepOS is watching for you">
          <WatchingList items={r.watching} basePath={basePath} />
        </Section>
      ) : null}

      {r.did.length > 0 || view.basedOn > 0 ? (
        <Section eyebrow={r.sinceLabel} note="What RepOS did">
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

      {view.question ? (
        <Section eyebrow="What RepOS needs from you">
          <Question q={view.question} />
        </Section>
      ) : null}

      <Section eyebrow="Not worth your time right now">
        <Quiet>{view.noAction}</Quiet>
      </Section>

      {nothingYet && view.basedOn > 0 ? (
        <Section eyebrow="What customers are telling you">
          <Quiet>
            Nothing has been said often enough yet for us to call it a pattern. We name something
            once at least three customers have raised it — until then we would be guessing.
          </Quiet>
        </Section>
      ) : null}

      <Limits limits={r.limitations} />

      <p className="mt-10 border-t border-ink-200 pt-5 text-[12px] leading-relaxed text-ink-400">
        Prepared for {view.businessName} from the feedback your customers have left. Every theme
        links to the comments it came from.
      </p>
    </>
  );
}
