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
import { LanguageForm } from '@/components/forms/language-form';
import { getLocale, getTranslator } from '@/lib/i18n/request';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t('account.meta.title') };
}

/**
 * THE OWNER'S ACCOUNT PAGE (M21, rebuilt in M23, sectioned in M24, made
 * explicit in M28, put into three languages in M31).
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
 * EVERY WORD IS A DICTIONARY KEY and every number is not. The dates, the days
 * left and the counts are computed on the server and passed into a phrase as
 * `{placeholders}`, so what an owner reads in Marathi is the same figure they
 * would read in English — the sentence around it changes, the arithmetic never
 * does.
 *
 * Nothing here counts down in hours, colours itself red, or is worth more today
 * than on Friday.
 */

/** The page's own translator, typed from the dictionary. */
type T = Awaited<ReturnType<typeof getTranslator>>;

type Fact = { label: string; value: string; href?: string | null };

/**
 * Where the service stands, as labelled facts rather than as a phrase to parse.
 *
 * Every value comes from the business's own row — `trialStartsAt`,
 * `trialEndsAt`, and days counted between them and now on the server. The
 * installation-wide default in Settings is not read here and could not be: a
 * business keeps the dates it was given.
 */
function serviceFacts(account: AccountState, lifecycle: Lifecycle, t: T): Fact[] {
  const facts: Fact[] = [];

  if (lifecycle.state === 'DEMO_EXEMPT') {
    facts.push({ label: t('account.service.label'), value: t('account.service.demo') });
    facts.push({ label: t('account.service.status'), value: statusLabel(lifecycle) });
    return facts;
  }

  if (lifecycle.state === 'ACTIVE_SERVICE' || lifecycle.state === 'ADMIN_OVERRIDE') {
    facts.push({ label: t('account.service.label'), value: t('account.service.headway') });
    if (account.phase === 'PAUSED' && account.servicePausedAt) {
      facts.push({
        label: t('account.service.pausedSince'),
        value: formatDate(account.servicePausedAt),
      });
    } else if (account.serviceResumedAt) {
      facts.push({
        label: t('account.service.resumed'),
        value: formatDate(account.serviceResumedAt),
      });
    }
    facts.push({ label: t('account.service.status'), value: statusLabel(lifecycle) });
    return facts;
  }

  // On a trial, running or ended.
  facts.push({ label: t('account.service.label'), value: t('account.service.trial') });
  if (lifecycle.trialStartsAt) {
    facts.push({
      label: t('account.service.trialStarted'),
      value: formatLongDate(lifecycle.trialStartsAt),
    });
  }
  if (lifecycle.trialEndsAt) {
    facts.push({
      label: lifecycle.expired
        ? t('account.service.trialEnded')
        : t('account.service.trialEnds'),
      value: formatLongDate(lifecycle.trialEndsAt),
    });
  }
  if (!lifecycle.expired && lifecycle.daysRemaining !== null) {
    const days = lifecycle.daysRemaining;
    facts.push({
      label: t('account.service.daysLeftLabel'),
      value:
        days === 0
          ? t('account.service.endsToday')
          : t.plural('account.service.daysLeft', days),
    });
  }
  facts.push({ label: t('account.service.status'), value: statusLabel(lifecycle) });
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
 * The demo workspace still has a lapsed date on its row, so left alone this
 * page would put "Your trial has ended" above a table saying "Headway demo" —
 * the contradiction the pass exists to remove.
 */
function headlineFor(
  account: AccountState,
  lifecycle: Lifecycle,
  t: T,
): { title: string; description: string } {
  if (lifecycle.state === 'DEMO_EXEMPT') {
    return {
      title: t('account.headline.workspace'),
      description: t('account.headline.demo'),
    };
  }
  if (lifecycle.state === 'FOUNDER_EXEMPT') {
    return {
      title: t('account.headline.workspace'),
      description: t('account.headline.staff'),
    };
  }
  if (lifecycle.state === 'ADMIN_OVERRIDE') {
    return {
      title: t('account.headline.activeTitle'),
      description: t('account.headline.activeBody'),
    };
  }
  if (lifecycle.state === 'MANUALLY_LOCKED') {
    return {
      title: t('account.headline.pausedTitle'),
      description: t('account.locked.body'),
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
function HeadwayContact({ t }: { t: T }) {
  const contact = siteContact();
  return (
    <Section eyebrow={t('account.contact.eyebrow')}>
      <p className="text-[15px] leading-relaxed text-ink-700">{t('account.contact.body')}</p>
      <dl className="mt-3 divide-y divide-ink-200 border-y border-ink-200 text-[14px]">
        <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-2.5 sm:grid-cols-[12rem_1fr]">
          <dt className="text-ink-500">{t('account.contact.email')}</dt>
          <dd className="font-medium break-words text-ink-900">{contact.email}</dd>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-2.5 sm:grid-cols-[12rem_1fr]">
          <dt className="text-ink-500">{t('account.contact.phone')}</dt>
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
    getResponsibility(prisma, clientId, { t: await getTranslator() }),
    pendingRequestFor(prisma, clientId),
  ]);
  if (!account) notFound();

  const [locale, t] = await Promise.all([getLocale(), getTranslator()]);

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
          eyebrow={t('account.eyebrow')}
          title={
            lifecycle.state === 'MANUALLY_LOCKED'
              ? t('account.headline.pausedTitle')
              : t('account.headline.trialEndedTitle')
          }
          description={t('account.locked.body')}
        />
      ) : (
        <>
          <PageIntro eyebrow={t('account.eyebrow')} {...headlineFor(account, lifecycle, t)} />
          {account.note && !lifecycle.exempt ? (
            <p className="-mt-5 mb-8 text-[14px] leading-relaxed text-ink-600">{account.note}</p>
          ) : null}
        </>
      )}

      {/* The lock, said once, where it can be acted on. */}
      {locked && isOwner ? (
        <Section eyebrow={t('account.continue.eyebrow')}>
          {pending ? (
            <>
              <p className="text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
                {t('account.continue.received')}
              </p>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">
                {t('account.continue.lockedPending', { phone: pending.phone })}
              </p>
            </>
          ) : (
            <>
              <p className="max-w-2xl text-[15px] leading-relaxed text-ink-700">
                {t('account.continue.lockedAsk')}
              </p>
              <div className="mt-5">
                <ExtendAccessForm
                  clientId={clientId}
                  ownerPhone={account.owner.phone}
                  ownerEmail={account.owner.email}
                  label={t('account.continue.ask')}
                />
              </div>
            </>
          )}
        </Section>
      ) : null}

      {/* The warning, only for a running trial and only near the end.
          One whole sentence per case, never a stitched one: the day, the date
          and the ask sit in different orders in the three languages. */}
      {!locked && lifecycle.warning ? (
        <div className="mb-8">
          <Callout tone={lifecycle.warning === 'ENDING_IMMINENTLY' ? 'bad' : 'warn'}>
            {lifecycle.warning === 'ENDING_IMMINENTLY'
              ? lifecycle.daysRemaining === 0
                ? t('account.warning.endsToday', {
                    date: formatLongDate(lifecycle.trialEndsAt!),
                  })
                : lifecycle.daysRemaining === 1
                  ? t('account.warning.endsTomorrow', {
                      date: formatLongDate(lifecycle.trialEndsAt!),
                    })
                  : t.plural('account.warning.endsInDays', lifecycle.daysRemaining ?? 0, {
                      date: formatLongDate(lifecycle.trialEndsAt!),
                    })
              : t.plural('account.warning.endsOn', lifecycle.daysRemaining ?? 0, {
                  date: formatLongDate(lifecycle.trialEndsAt!),
                })}
          </Callout>
        </div>
      ) : null}

      <Section eyebrow={t('account.service.eyebrow')}>
        <Facts facts={serviceFacts(account, lifecycle, t)} />
      </Section>

      <Section eyebrow={t('account.activity.eyebrow')}>
        {activity.length > 0 ? (
          <Facts facts={activity} />
        ) : (
          <Quiet>{t('account.activity.empty')}</Quiet>
        )}
      </Section>

      {/* Continuing with Headway, for a trial that is still running. */}
      {!locked && onTrial && !stopped ? (
        <Section eyebrow={t('account.continue.eyebrow')}>
          {pending ? (
            <>
              <p className="text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
                {t('account.continue.received')}
              </p>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">
                {t('account.continue.trialPending', {
                  date: formatLongDate(pending.createdAt),
                  phone: pending.phone,
                })}
              </p>
            </>
          ) : (
            <>
              <p className="text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
                {t('account.continue.question')}
              </p>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-700">
                {t('account.continue.trialBody')}
              </p>
              <div className="mt-5">
                {isOwner ? (
                  <ExtendAccessForm
                    clientId={clientId}
                    ownerPhone={account.owner.phone}
                    ownerEmail={account.owner.email}
                  />
                ) : (
                  <Quiet>{t('account.continue.ownerOnly')}</Quiet>
                )}
              </div>
            </>
          )}
        </Section>
      ) : null}

      {/* An active or paused account keeps the details Headway reaches them on. */}
      {!locked && !onTrial && isOwner ? (
        <Section eyebrow={t('account.reach.eyebrow')}>
          <p className="text-[15px] leading-relaxed text-ink-700">
            {account.owner.email || account.owner.phone ? (
              <>
                {account.owner.name ? `${account.owner.name} · ` : ''}
                <Reach account={account} />
              </>
            ) : (
              t('account.reach.none')
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

      {/* Language sits with the other settings, and stays reachable even when
          the workspace is locked — being unable to read the page explaining
          why you are locked out would be a poor way to learn it. */}
      <Section eyebrow={t('account.language.title')}>
        <LanguageForm clientId={clientId} current={locale} />
      </Section>

      <HeadwayContact t={t} />
    </div>
  );
}
