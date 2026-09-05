import Link from 'next/link';
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LinkButton,
  Notice,
  PageHeader,
  Stat,
} from '@/components/ui';
import { DemoDataButton } from '@/components/demo-data-button';
import { CommandCard } from '@/components/command-card';
import { prisma } from '@/lib/db';
import { aiStatus } from '@/lib/ai';
import { getBoard } from '@/lib/command/board';
import { BAND_LABELS } from '@/lib/command/priority';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * The command centre.
 *
 * The first screen answers "what do I need to do?", not "how much data do I
 * have?". Clients are ordered by named signals, each card carries the reason it
 * is where it is, and every card ends in one action that goes to a screen that
 * already exists.
 *
 * Deliberately not a dashboard: there is no chart, and no number on this page
 * exists without something to do about it.
 */
export default async function CommandCentrePage() {
  const now = new Date();
  const board = await getBoard(prisma, now);
  const ai = aiStatus();

  const urgent = board.cards.filter((card) => card.band === 'NOW');
  const soon = board.cards.filter((card) => card.band === 'SOON');
  const rest = board.cards.filter((card) => card.band === 'WHEN_FREE');
  // Clients with nothing waiting used to be rendered as full cards under a
  // heading that said "lower priority", so fourteen calm businesses meant
  // fourteen cards each saying nothing is flagging. They are named, not
  // detailed (M17).
  const calm = board.cards.filter((card) => card.band === 'NOTHING');

  const headline =
    board.totals.clients === 0
      ? 'Add your first client to get started.'
      : urgent.length > 0
        ? `${urgent.length} client${urgent.length === 1 ? '' : 's'} need you now.`
        : soon.length > 0
          ? `Nothing urgent. ${soon.length} worth doing today.`
          : 'Nothing is waiting on you.';

  return (
    <>
      <PageHeader
        title="Today"
        description={headline}
        actions={
          <>
            <LinkButton href="/minutes">Add minute</LinkButton>
            <LinkButton href="/clients/new" variant="primary">
              Add client
            </LinkButton>
          </>
        }
      />

      {board.totals.clients === 0 ? (
        <Card>
          <EmptyState
            title="No clients yet"
            description="Add the business you are working with, paste in the feedback you have collected, and RepOS will tell you what matters and what to do about it."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/clients/new" variant="primary">
                  Add your first client
                </LinkButton>
                <DemoDataButton />
              </div>
            }
          />
        </Card>
      ) : (
        <>
          {/* Four numbers, each of which is a queue you can work through. */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Need you"
              value={formatNumber(urgent.length + soon.length)}
              hint={
                urgent.length > 0
                  ? `${urgent.length} need you now`
                  : 'Nothing urgent'
              }
              tone={urgent.length > 0 ? 'bad' : 'good'}
            />
            <Stat
              label="Feedback to read"
              value={formatNumber(board.totals.unreadFeedback)}
              hint={
                board.totals.unreadFeedback === 0
                  ? 'All read'
                  : 'Nothing is reliable until this is read'
              }
              tone={board.totals.unreadFeedback > 0 ? 'warn' : 'good'}
            />
            <Stat
              label="Replies to prepare"
              value={formatNumber(board.totals.awaitingDraft + board.totals.needsYou)}
              hint={
                board.totals.needsYou > 0
                  ? `${board.totals.needsYou} of them need your own words`
                  : board.totals.awaitingDraft === 0
                    ? 'All prepared'
                    : 'One click each'
              }
              tone={
                board.totals.awaitingDraft + board.totals.needsYou > 0 ? 'warn' : 'good'
              }
            />
            <Stat
              label="Too early to judge"
              value={formatNumber(board.totals.lowData)}
              hint={
                board.totals.lowData === 0
                  ? 'Every client has enough to work with'
                  : 'Still gathering feedback'
              }
            />
          </div>

          <div className="space-y-8">
            {urgent.length > 0 ? (
              <Section
                title={BAND_LABELS.NOW}
                description="Ordered by what is most pressing. The reason is under each name."
              >
                {urgent.map((card) => (
                  <CommandCard key={card.clientId} card={card} />
                ))}
              </Section>
            ) : null}

            {soon.length > 0 ? (
              <Section
                title={BAND_LABELS.SOON}
                description="Nothing here is on fire, but it is worth an hour."
              >
                {soon.map((card) => (
                  <CommandCard key={card.clientId} card={card} />
                ))}
              </Section>
            ) : null}

            {rest.length > 0 ? (
              <Section
                title={BAND_LABELS.WHEN_FREE}
                description="Lower priority. Each card still says what the next step is."
              >
                {rest.map((card) => (
                  <CommandCard key={card.clientId} card={card} />
                ))}
              </Section>
            ) : null}

            {calm.length > 0 ? (
              <Section
                title={BAND_LABELS.NOTHING}
                description="Nothing is waiting on you for these. They are listed so you can see they were looked at."
              >
                <Card>
                  <CardBody className="flex flex-wrap gap-x-5 gap-y-2">
                    {calm.map((card) => (
                      <Link
                        key={card.clientId}
                        href={`/clients/${card.clientId}`}
                        // Same reason as command-card.tsx: one per calm client,
                        // on the same screen as the cards, all pointing at the
                        // most expensive route in the app.
                        prefetch={false}
                        className="text-[13px] text-ink-700 underline-offset-2 hover:underline"
                      >
                        {card.businessName}
                      </Link>
                    ))}
                  </CardBody>
                </Card>
              </Section>
            ) : null}
          </div>

          <Card className="mt-8">
            <CardHeader title="How this works" />
            <CardBody className="space-y-3 text-[13px] leading-relaxed text-ink-600">
              <p>
                Order is decided by named signals, not a score. Whatever put a
                client at the top is written under their name in the same words
                you would use.
              </p>
              <p>
                Nothing is fetched and nothing is sent. You enter what you
                observed; RepOS reads it, tells you what changed, and prepares
                the message for you to copy.
              </p>
              <Notice tone={ai.enabled ? 'brand' : 'neutral'}>{ai.note}</Notice>
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
        <p className="text-[12px] text-ink-500">{description}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">{children}</div>
    </section>
  );
}
