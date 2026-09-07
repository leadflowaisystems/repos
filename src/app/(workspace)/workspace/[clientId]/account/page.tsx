import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentActor } from '@/lib/auth/authorize';
import { tenantGateFor } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { formatLongDate, getAccountState, type AccountState } from '@/lib/commercial/service';
import { activityFacts } from '@/lib/portal/focus';
import { getResponsibility } from '@/lib/responsibility/service';
import { PageIntro, Quiet, Section } from '@/components/portal/portal-ui';
import { ContinueWithHeadwayForm } from '@/components/forms/continue-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Account' };

/**
 * THE OWNER'S ACCOUNT PAGE (M21, rebuilt in M23, sectioned in M24).
 *
 * Useful, and deliberately secondary. Three sections an owner can scan:
 * where the service stands, what Headway has done with their feedback, and
 * how to carry on — then, for an active account, where Headway reaches them.
 * A page with few settings is not made to look empty: each section is a
 * short list of facts the rest of the workspace already states.
 *
 * THERE IS NO PRICE ON THIS PAGE, and that is not an oversight. RepOS has no
 * price list, no tier and no published number: what a business pays is
 * negotiated one business at a time, recorded by the operator, and collected by
 * hand. The negotiated amount lives in a table this connection cannot read at
 * all — a business owner's query returns no rows, not a blank field — so there
 * is nothing here for a mis-scoped query or a careless join to leak.
 *
 * Nothing on this page counts down, expires at midnight, or is worth more today
 * than on Friday. A trial says the date it runs to, because that is a fact the
 * owner needs; it does not make an argument out of it. An ended trial says the
 * workspace and its history are still here, because they are.
 *
 * STAFF SEE IT TOO, read-only. The forms are owner-level and the actions check
 * again on the server, so a staff member sees the state of the business they
 * work in without being able to speak for it commercially.
 */

type Fact = { label: string; value: string; href?: string | null };

const DAY = 86_400_000;

/** Where the service stands, as facts: the kind of account, and the date that matters. */
function serviceFacts(account: AccountState): Fact[] {
  const facts: Fact[] = [];
  const onTrial = account.phase === 'TRIAL' || account.phase === 'TRIAL_ENDED';
  if (onTrial) {
    const length =
      account.trialStartsAt && account.trialEndsAt
        ? Math.round((account.trialEndsAt.getTime() - account.trialStartsAt.getTime()) / DAY)
        : null;
    facts.push({ label: 'Service', value: length ? `${length}-day trial` : 'Trial' });
    if (account.trialEndsAt) {
      facts.push({
        label: account.phase === 'TRIAL_ENDED' ? 'Ended' : 'Ends',
        value: formatDate(account.trialEndsAt),
      });
    }
  } else if (account.phase === 'ACTIVE') {
    facts.push({ label: 'Service', value: 'Headway, active' });
    if (account.serviceResumedAt) facts.push({ label: 'Resumed', value: formatDate(account.serviceResumedAt) });
  } else if (account.phase === 'PAUSED') {
    facts.push({ label: 'Service', value: 'Paused' });
    if (account.servicePausedAt) facts.push({ label: 'Paused since', value: formatDate(account.servicePausedAt) });
  } else {
    facts.push({ label: 'Service', value: 'Closed' });
  }
  return facts;
}

function Facts({ facts }: { facts: Fact[] }) {
  return (
    <dl className="divide-y divide-ink-200 border-y border-ink-200 text-[14px]">
      {facts.map((f) => (
        <div key={f.label} className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-2.5 sm:grid-cols-[12rem_1fr]">
          <dt className="text-ink-500">{f.label}</dt>
          <dd className="font-medium text-ink-900 tabular-nums">
            {f.href ? (
              <Link
                href={f.href}
                className="inline-flex min-h-11 min-w-11 items-center underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900 sm:min-h-0"
              >
                {f.value}
              </Link>
            ) : (
              f.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Reach({ account }: { account: AccountState }) {
  const bits = [account.owner.email, account.owner.phone].filter((s) => s.length > 0);
  if (bits.length === 0) return null;
  return <span>{bits.join(' · ')}</span>;
}

export default async function WorkspaceAccountPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const gate = await tenantGateFor(clientId, 'MEMBER');
  if (!gate.ok) {
    if (!(await currentActor(prisma))) redirect('/login');
    notFound();
  }

  const [account, bundle] = await Promise.all([
    getAccountState(prisma, clientId),
    getResponsibility(prisma, clientId),
  ]);
  if (!account) notFound();

  const basePath = `/workspace/${clientId}`;
  const isOwner = gate.role === 'BUSINESS_OWNER';
  const stopped = account.phase === 'PAUSED' || account.phase === 'CLOSED';
  const onTrial = account.phase === 'TRIAL' || account.phase === 'TRIAL_ENDED';
  const asked = account.continuationRequestedAt;
  const activity = bundle ? activityFacts(bundle.view, bundle.responsibility, basePath) : [];

  return (
    <div className="max-w-3xl">
      <PageIntro eyebrow="Account" title={account.headline} description={account.line} />
      {account.note ? (
        <p className="-mt-5 mb-8 text-[14px] leading-relaxed text-ink-600">{account.note}</p>
      ) : null}

      <Section eyebrow="Your Headway service">
        <Facts facts={serviceFacts(account)} />
      </Section>

      <Section eyebrow="Your Headway activity">
        {activity.length > 0 ? (
          <Facts facts={activity} />
        ) : (
          <Quiet>
            Nothing yet. Once customers start scanning your card, what Headway collects, reads
            and finds appears here.
          </Quiet>
        )}
      </Section>

      {stopped ? null : asked ? (
        <Section eyebrow="Carrying on">
          <p className="text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
            Thanks. We&rsquo;ve got your details.
          </p>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">
            You asked to continue with Headway on {formatLongDate(asked)}. We&rsquo;ll send the
            payment information and QR directly to you
            {account.owner.email || account.owner.phone ? (
              <>
                {' '}
                at <Reach account={account} />
              </>
            ) : null}
            .
          </p>
          {isOwner ? (
            <div className="mt-4">
              <ContinueWithHeadwayForm
                clientId={clientId}
                ownerName={account.owner.name}
                ownerEmail={account.owner.email}
                ownerPhone={account.owner.phone}
                mode="update"
              />
            </div>
          ) : null}
        </Section>
      ) : onTrial ? (
        <Section eyebrow="Carrying on">
          <p className="text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
            {account.phase === 'TRIAL_ENDED' ? 'Ready to keep going?' : 'Want to carry on after the trial?'}
          </p>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">
            One press. We send the payment information and QR to you; nothing is charged
            automatically, and everything Headway has collected stays yours either way.
          </p>
          <div className="mt-5">
            {isOwner ? (
              <ContinueWithHeadwayForm
                clientId={clientId}
                ownerName={account.owner.name}
                ownerEmail={account.owner.email}
                ownerPhone={account.owner.phone}
                mode="continue"
              />
            ) : (
              <Quiet>The owner of this business can continue from this page.</Quiet>
            )}
          </div>
        </Section>
      ) : null}

      {(account.phase === 'ACTIVE' || stopped) && isOwner ? (
        <Section eyebrow="Where Headway reaches you">
          <p className="text-[15px] leading-relaxed text-ink-700">
            {account.owner.email || account.owner.phone ? (
              <>
                {account.owner.name ? `${account.owner.name} · ` : ''}
                <Reach account={account} />
              </>
            ) : (
              'No contact details on record yet.'
            )}
          </p>
          <div className="mt-4">
            <ContinueWithHeadwayForm
              clientId={clientId}
              ownerName={account.owner.name}
              ownerEmail={account.owner.email}
              ownerPhone={account.owner.phone}
              mode="update"
            />
          </div>
        </Section>
      ) : null}
    </div>
  );
}
