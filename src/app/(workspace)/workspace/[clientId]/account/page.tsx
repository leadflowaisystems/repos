import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentActor } from '@/lib/auth/authorize';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { formatLongDate, getAccountState, type AccountState } from '@/lib/commercial/service';
import { workspaceAccess } from '@/lib/lifecycle/access';
import { statusLabel, type Lifecycle } from '@/lib/lifecycle/service';
import { pendingRequestFor } from '@/lib/continuation/service';
import { siteContact } from '@/lib/marketing/site';
import { activityFacts } from '@/lib/portal/focus';
import { getResponsibility } from '@/lib/responsibility/service';
import { Callout, PageIntro, Quiet, Section } from '@/components/portal/portal-ui';
import { ExtendAccessForm } from '@/components/forms/extend-access-form';
import { ContinueWithHeadwayForm } from '@/components/forms/continue-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Account' };

/**
 * THE OWNER'S ACCOUNT PAGE (M21, rebuilt in M23, sectioned in M24, made
 * explicit in M28).
 *
 * The one page that answers seven questions without the owner having to work
 * anything out: what am I on, when did it start, when does it end, how long is
 * left, what happens next, how do I continue, and how do I reach Headway.
 *
 * M28 replaced the one line that made a reader do arithmetic. "19-day trial"
 * was a true fact about the window and a useless one to a person wondering
 * whether they have time — it was the LENGTH, and what they wanted was the
 * REMAINDER. Now the dates and the days left are separate rows, each labelled,
 * each computed on the server from the business's own stored dates.
 *
 * IT STAYS OPEN WHEN THE WORKSPACE DOES NOT. Every other page redirects here
 * once a trial has ended, so this is where the lock is explained and where
 * continuing is asked for. A business that has lapsed is a customer, not an
 * intruder: it gets a sentence, a date and a button, not a paywall.
 *
 * THERE IS NO PRICE ON THIS PAGE, and that is not an oversight. RepOS has no
 * price list, no tier and no published number: what a business pays is
 * negotiated one business at a time, recorded by the operator, and collected by
 * hand. The negotiated amount lives in a table this connection cannot read at
 * all — a business owner's query returns no rows, not a blank field.
 *
 * Nothing here counts down in hours, colours itself red, or is worth more today
 * than on Friday.
 */

type Fact = { label: string; value: string; href?: string | null };

/**
 * Where the service stands, as labelled facts rather than as a phrase to parse.
 *
 * Every value comes from the business's own row — `trialStartsAt`,
 * `trialEndsAt`, and days counted between them and now on the server. The
 * installation-wide default in Settings is not read here and could not be: a
 * business keeps the dates it was given.
 */
function serviceFacts(account: AccountState, lifecycle: Lifecycle): Fact[] {
  const facts: Fact[] = [];

  if (lifecycle.state === 'DEMO_EXEMPT') {
    facts.push({ label: 'Service', value: 'Demonstration workspace' });
    facts.push({ label: 'Status', value: statusLabel(lifecycle) });
    return facts;
  }

  if (lifecycle.state === 'ACTIVE_SERVICE' || lifecycle.state === 'ADMIN_OVERRIDE') {
    facts.push({ label: 'Service', value: 'Headway, active' });
    if (account.phase === 'PAUSED' && account.servicePausedAt) {
      facts.push({ label: 'Paused since', value: formatDate(account.servicePausedAt) });
    } else if (account.serviceResumedAt) {
      facts.push({ label: 'Resumed', value: formatDate(account.serviceResumedAt) });
    }
    facts.push({ label: 'Status', value: statusLabel(lifecycle) });
    return facts;
  }

  // On a trial, running or ended.
  facts.push({ label: 'Service', value: 'Headway trial' });
  if (lifecycle.trialStartsAt) {
    facts.push({ label: 'Trial started', value: formatLongDate(lifecycle.trialStartsAt) });
  }
  if (lifecycle.trialEndsAt) {
    facts.push({
      label: lifecycle.expired ? 'Trial ended' : 'Trial ends',
      value: formatLongDate(lifecycle.trialEndsAt),
    });
  }
  if (!lifecycle.expired && lifecycle.daysRemaining !== null) {
    const days = lifecycle.daysRemaining;
    facts.push({
      label: 'Days remaining',
      value: days === 0 ? 'Ends today' : days === 1 ? '1 day' : `${days} days`,
    });
  }
  facts.push({ label: 'Status', value: statusLabel(lifecycle) });
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

/**
 * The headline, when the lifecycle knows better than the subscription does.
 *
 * `describeAccount` reads `subscriptionStatus` and the trial dates, which is
 * right for the four states it was built for and wrong for the three M28 added.
 * A demonstration workspace still has a lapsed date on its row, so left alone
 * this page would put "Your trial has ended" above a table saying
 * "Demonstration workspace" — the contradiction the pass exists to remove.
 */
function headlineFor(
  account: AccountState,
  lifecycle: Lifecycle,
): { title: string; description: string } {
  if (lifecycle.state === 'DEMO_EXEMPT') {
    return {
      title: 'Your Headway workspace',
      description: 'This is the demonstration workspace. It does not expire.',
    };
  }
  if (lifecycle.state === 'FOUNDER_EXEMPT') {
    return {
      title: 'Your Headway workspace',
      description: 'You are signed in as Headway staff, so this workspace is always open to you.',
    };
  }
  if (lifecycle.state === 'ADMIN_OVERRIDE') {
    return {
      title: 'Headway is active',
      description: 'Your workspace is open. Your Headway contact has arranged your access.',
    };
  }
  if (lifecycle.state === 'MANUALLY_LOCKED') {
    return {
      title: 'Your Headway workspace is on hold',
      description:
        'Your customer intelligence and improvement workspace is ready when you continue your Headway service.',
    };
  }
  return { title: account.headline, description: account.line };
}

function Reach({ account }: { account: AccountState }) {
  const bits = [account.owner.email, account.owner.phone].filter((s) => s.length > 0);
  if (bits.length === 0) return null;
  return <span>{bits.join(' · ')}</span>;
}

/** Plain text, never a link: RepOS builds no mailto, tel or messaging deep link. */
function HeadwayContact() {
  const contact = siteContact();
  return (
    <Section eyebrow="Reaching Headway">
      <p className="text-[15px] leading-relaxed text-ink-700">
        Your Headway contact will reply to a request from this page. You can also reach us
        directly.
      </p>
      <dl className="mt-3 divide-y divide-ink-200 border-y border-ink-200 text-[14px]">
        <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-2.5 sm:grid-cols-[12rem_1fr]">
          <dt className="text-ink-500">Email</dt>
          <dd className="font-medium break-words text-ink-900">{contact.email}</dd>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-2.5 sm:grid-cols-[12rem_1fr]">
          <dt className="text-ink-500">Phone</dt>
          <dd className="font-medium text-ink-900 tabular-nums">{contact.phone}</dd>
        </div>
      </dl>
    </Section>
  );
}

export default async function WorkspaceAccountPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  // Account is the ONE workspace page that does not require an open workspace,
  // because it is where a closed one is explained and reopened.
  const access = await workspaceAccess(clientId);
  if (!access.ok) {
    if (!(await currentActor(prisma))) redirect('/login');
    notFound();
  }
  const { lifecycle, role } = access;

  const [account, bundle, pending] = await Promise.all([
    getAccountState(prisma, clientId),
    getResponsibility(prisma, clientId),
    pendingRequestFor(prisma, clientId),
  ]);
  if (!account) notFound();

  const basePath = `/workspace/${clientId}`;
  const isOwner = role === 'BUSINESS_OWNER';
  const activity = bundle ? activityFacts(bundle.view, bundle.responsibility, basePath) : [];
  const locked = lifecycle.workspaceLocked;
  const onTrial = lifecycle.state === 'ACTIVE_TRIAL' || lifecycle.state === 'TRIAL_EXPIRED';
  const stopped = account.phase === 'PAUSED' || account.phase === 'CLOSED';

  return (
    <div className="max-w-3xl">
      {locked ? (
        <PageIntro
          eyebrow="Account"
          title={
            lifecycle.state === 'MANUALLY_LOCKED'
              ? 'Your Headway workspace is on hold'
              : 'Your Headway trial has ended.'
          }
          description="Your customer intelligence and improvement workspace is ready when you continue your Headway service."
        />
      ) : (
        <>
          <PageIntro eyebrow="Account" {...headlineFor(account, lifecycle)} />
          {account.note && !lifecycle.exempt ? (
            <p className="-mt-5 mb-8 text-[14px] leading-relaxed text-ink-600">{account.note}</p>
          ) : null}
        </>
      )}

      {/* The lock, said once, where it can be acted on. */}
      {locked && isOwner ? (
        <Section eyebrow="Continue your service">
          {pending ? (
            <>
              <p className="text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
                Continuation requested
              </p>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">
                We&rsquo;ll be in touch shortly on {pending.phone}. Nothing is charged
                automatically.
              </p>
            </>
          ) : (
            <>
              <p className="max-w-2xl text-[15px] leading-relaxed text-ink-700">
                Everything Headway has collected and read is still here, exactly as it was.
                Nothing is charged automatically.
              </p>
              <div className="mt-5">
                <ExtendAccessForm
                  clientId={clientId}
                  ownerPhone={account.owner.phone}
                  ownerEmail={account.owner.email}
                  label="Continue service"
                />
              </div>
            </>
          )}
        </Section>
      ) : null}

      {/* The warning, only for a running trial and only near the end. */}
      {!locked && lifecycle.warning ? (
        <div className="mb-8">
          <Callout tone={lifecycle.warning === 'ENDING_IMMINENTLY' ? 'bad' : 'warn'}>
            {lifecycle.warning === 'ENDING_IMMINENTLY'
              ? `Your trial ends ${
                  lifecycle.daysRemaining === 0
                    ? 'today'
                    : lifecycle.daysRemaining === 1
                      ? 'tomorrow'
                      : `in ${lifecycle.daysRemaining} days`
                }, on ${formatLongDate(lifecycle.trialEndsAt!)}. Ask to continue and we’ll be in touch.`
              : `Your trial ends on ${formatLongDate(lifecycle.trialEndsAt!)}, ${
                  lifecycle.daysRemaining
                } days from now.`}
          </Callout>
        </div>
      ) : null}

      <Section eyebrow="Your Headway service">
        <Facts facts={serviceFacts(account, lifecycle)} />
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

      {/* Carrying on, for a trial that is still running. */}
      {!locked && onTrial && !stopped ? (
        <Section eyebrow="Carrying on">
          {pending ? (
            <>
              <p className="text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
                Continuation requested
              </p>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">
                We&rsquo;ll be in touch shortly on {pending.phone}. You asked on{' '}
                {formatLongDate(pending.createdAt)}. Nothing is charged automatically, and your
                trial dates are unchanged.
              </p>
            </>
          ) : (
            <>
              <p className="text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
                Want to continue with Headway?
              </p>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">
                Your trial gives you full access to your customer intelligence and improvement
                workspace. When your trial ends, you can continue your Headway service —
                nothing is charged automatically.
              </p>
              <div className="mt-5">
                {isOwner ? (
                  <ExtendAccessForm
                    clientId={clientId}
                    ownerPhone={account.owner.phone}
                    ownerEmail={account.owner.email}
                  />
                ) : (
                  <Quiet>The owner of this business can continue from this page.</Quiet>
                )}
              </div>
            </>
          )}
        </Section>
      ) : null}

      {/* An active or paused account keeps the details Headway reaches them on. */}
      {!locked && !onTrial && isOwner ? (
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

      <HeadwayContact />
    </div>
  );
}
