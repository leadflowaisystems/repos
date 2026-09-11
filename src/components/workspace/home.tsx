import { Link } from '@/components/portal/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getResponsibility } from '@/lib/responsibility/service';
import { getEvidenceIndex } from '@/lib/portal/service';
import type { Responsibility } from '@/lib/responsibility/engine';
import { buildFocus } from '@/lib/portal/focus';
import { Knows, Limits, Question, Quiet, Section, SoFar } from '@/components/portal/portal-ui';
import { NeedsYouItem, StrengthsList, WatchingList } from '@/components/portal/responsibility';
import { Reveal } from '@/components/portal/disclose';
import { FocusBlock } from '@/components/workspace/focus';
import { SinceVisit } from '@/components/workspace/since-visit';
import type { SinceLastVisit } from '@/lib/retention/service';
import { getTranslator } from '@/lib/i18n/request';

/**
 * HOME — the command centre (M24, tightened in the final experience pass).
 *
 * An owner gives this page ten seconds standing behind a counter. In that
 * time it answers, in this order and no other:
 *
 *   RIGHT NOW                 what is the one thing that matters, and why
 *   EVIDENCE                  three figures that open into what they count
 *   WHAT TO DO                one line, and the way to the whole reading
 *   HEADWAY WILL CHECK NEXT   the open loop on the decision
 *   HEADWAY IS WATCHING       what is being carried, with the condition that
 *                             brings each thing back
 *   GOING WELL                what to protect
 *   SINCE YOU WERE LAST HERE  only when something happened
 *   YOUR NEXT CHECK-IN        when it is worth opening, as a condition
 *
 * ONE BLOCK IS DOMINANT. The first block is the largest thing on the page
 * and the owner can stop after it. Everything below is smaller, and
 * everything that explains method sits behind a tap. No figure is stated
 * twice: the count read is in the block's basis line, the leading complaint
 * and strength are the block and the lists, and the public rating — the one
 * number from outside the feedback — is stated once, quietly, where the next
 * check is.
 */

/**
 * The reason to come back, stated as a condition rather than a nudge: what
 * Headway did since the last check-in, and what would make the next one worth
 * opening. The full list of work lives on Check-in.
 */
async function NextCheck({
  r,
  basePath,
  rating,
}: {
  r: Responsibility;
  basePath: string;
  /** The public listing's rating, when it has been observed. Stated here and nowhere else. */
  rating: { value: string; scope: string } | null;
}) {
  const t = await getTranslator();
  const since = r.did[0] ?? null;
  return (
    <div>
      {since ? <p className="text-[13px] leading-relaxed text-ink-600">{since}</p> : null}
      {/* No run-in label here. The eyebrow above already says "Your next
          check-in" and most of these sentences name the check-in again, so a
          bold "Next check-in." in front of them was the page saying one thing
          twice. The rule down the left carries the break instead. */}
      <p className="mt-2 border-l-2 border-ink-300 pl-3 text-[13px] leading-relaxed text-ink-700">
        {r.nextUsefulCheck}
      </p>
      <Link
        href={`${basePath}/checkin`}
        className="mt-1 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-ink-700 hover:text-ink-900"
      >
        {t('home.nextCheck.open')} <span aria-hidden>→</span>
      </Link>
      {rating ? (
        <p className="mt-4 border-t border-ink-200 pt-3 text-[13px] leading-relaxed text-ink-600">
          <span className="font-medium text-ink-900 tabular-nums">
            {t('home.nextCheck.publicRating', { value: rating.value })}
          </span>{' '}
          {rating.scope}.
        </p>
      ) : null}
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
  const t = await getTranslator();
  const client = { id: clientId };
  const [bundle, evidence] = await Promise.all([
    getResponsibility(prisma, client.id, { t }),
    getEvidenceIndex(prisma, client.id),
  ]);
  if (!bundle) notFound();
  const { view, responsibility: r } = bundle;

  const focus = buildFocus({ responsibility: r, view, evidence, basePath, t });

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

  // Before anything is a pattern, the early mentions ARE the news: what the
  // first customers said, counted, and marked as not-yet-a-pattern. Once
  // patterns exist they take the stage and the full count lives on Customers.
  const named = view.loved.length + view.unhappy.length > 0;
  const reading = view.basedOn === 0 && view.soFar.waiting > 0;
  const showSoFar = !named && (view.basedOn > 0 || reading);

  // By key, never by label: the labels are reworded and translated, and a
  // lookup that matches on display text disappears the row instead of failing.
  const direction = view.facts.find((f) => f.key === 'direction') ?? null;
  const rating = view.facts.find((f) => f.key === 'publicRating') ?? null;

  return (
    <>
      <FocusBlock focus={focus} direction={direction} />

      {alsoNeedsYou.length > 0 ? (
        <Section eyebrow={t('home.alsoNeeds.title')}>
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
            <Section eyebrow={t('home.watching.title')} note={t('home.watching.note')}>
              <WatchingList items={watching} basePath={basePath} />
            </Section>
          ) : null}

          {strengths.length > 0 ? (
            <Section eyebrow={t('home.goingWell.title')} note={t('home.goingWell.note')}>
              <StrengthsList items={strengths} basePath={basePath} />
            </Section>
          ) : null}

          {showSoFar ? (
            <Section eyebrow={t('home.soFar.title')} note={t('home.soFar.note')}>
              <SoFar soFar={view.soFar} basePath={basePath} />
            </Section>
          ) : null}

          {view.question ? (
            <Section eyebrow={t('home.question.title')}>
              <Question q={view.question} />
            </Section>
          ) : null}

          {view.basedOn === 0 && !reading ? (
            <Section eyebrow={t('home.empty.title')}>
              <Quiet>{t('home.empty.body')}</Quiet>
            </Section>
          ) : null}
        </div>

        <aside className="min-w-0 lg:border-l lg:border-ink-200 lg:pl-8">
          {since ? <SinceVisit since={since} basePath={basePath} /> : null}

          {r.did.length > 0 || view.basedOn > 0 ? (
            <Section eyebrow={t('home.nextCheck.title')}>
              <NextCheck r={r} basePath={basePath} rating={rating} />
            </Section>
          ) : null}
        </aside>
      </div>

      {view.knows.length > 0 ? (
        <Reveal
          summary={<span className="tracking-widest uppercase">{t('home.knows.title')}</span>}
          className="mt-10 border-t border-ink-200 pt-4"
        >
          <Knows items={view.knows} basePath={basePath} />
        </Reveal>
      ) : null}

      <Limits limits={r.limitations} collapsed />
    </>
  );
}
