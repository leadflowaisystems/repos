import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { currentActor } from '@/lib/auth/authorize';
import { tenantGateFor } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { getAccountState } from '@/lib/commercial/service';
import { PageIntro, Quiet, Section } from '@/components/portal/portal-ui';
import { RequestPaymentDetailsForm } from '@/components/forms/payment-request-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Account' };

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * THE OWNER'S ACCOUNT PAGE (M21).
 *
 * What state this account is in, who we would contact, and one button to ask
 * what it costs.
 *
 * THERE IS NO PRICE ON THIS PAGE, and that is not an oversight. RepOS has no
 * price list, no tier and no published number: what a business pays is
 * negotiated one business at a time, recorded by the operator, and collected by
 * hand. The negotiated amount lives in a table this connection cannot read at
 * all — a business owner's query returns no rows, not a blank field — so there
 * is nothing here for a mis-scoped query or a careless join to leak.
 *
 * Nothing on this page counts down, expires at midnight, or is worth more today
 * than on Friday. A trial with days left says how many, because that is a fact
 * the owner needs; it does not make an argument out of it.
 *
 * STAFF SEE IT TOO, read-only. The form is owner-level and the action checks
 * again on the server, so a staff member sees the state of the business they
 * work in without being able to speak for it commercially.
 */
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

  const account = await getAccountState(prisma, clientId);
  if (!account) notFound();

  const isOwner = gate.role === 'BUSINESS_OWNER';
  const paused = account.state === 'PAUSED' || account.state === 'CANCELLED';

  return (
    <main>
      <PageIntro
        eyebrow="Account"
        title="Where this account stands"
        description="What RepOS is doing for you right now, and how to reach us about carrying on."
      />

      <Section eyebrow="Right now">
        <p className="max-w-2xl text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
          {account.line}
        </p>

        <dl className="mt-4 divide-y divide-ink-200 border-y border-ink-200 text-[14px]">
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-ink-500">State</dt>
            <dd className="text-right font-medium text-ink-900">
              {account.state === 'TRIAL'
                ? 'Trial'
                : account.state === 'ACTIVE'
                  ? 'Active'
                  : account.state === 'PAUSED'
                    ? 'Paused'
                    : 'Closed'}
            </dd>
          </div>
          {account.trialStartsAt ? (
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-ink-500">Trial started</dt>
              <dd className="text-right font-medium text-ink-900">
                {DATE.format(account.trialStartsAt)}
              </dd>
            </div>
          ) : null}
          {account.trialEndsAt ? (
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-ink-500">Trial {account.trialExpired ? 'ended' : 'runs to'}</dt>
              <dd className="text-right font-medium text-ink-900">
                {DATE.format(account.trialEndsAt)}
              </dd>
            </div>
          ) : null}
          {account.paymentRequestedAt ? (
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-ink-500">You asked about payment</dt>
              <dd className="text-right font-medium text-ink-900">
                {DATE.format(account.paymentRequestedAt)}
              </dd>
            </div>
          ) : null}
        </dl>
      </Section>

      {paused ? (
        <Section eyebrow="What paused means">
          <Quiet>
            Your QR code still works and your customers can still leave feedback — it arrives and
            it is kept. Everything already collected stays exactly as it is: the comments, the
            reading, the improvements and every result RepOS measured. What stops is the reading
            of anything new, and it starts again, from where it left off, the moment the account
            is resumed.
          </Quiet>
        </Section>
      ) : null}

      <Section
        eyebrow="What this costs"
        note={account.paymentRequestedAt ? 'Asked' : 'Ask when you are ready'}
      >
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-900">
          RepOS does not publish a price. What a business pays depends on how much feedback it
          gets and what it wants read, so we agree it with you rather than putting a number on a
          page. Ask, and a person will come back to you with the figure and how to pay it — by
          UPI or bank transfer. There is no card on file and nothing is ever charged
          automatically.
        </p>

        {isOwner ? (
          <RequestPaymentDetailsForm
            clientId={clientId}
            ownerName={account.owner.name}
            ownerEmail={account.owner.email}
            ownerPhone={account.owner.phone}
            alreadyAsked={account.paymentRequestedAt !== null}
          />
        ) : (
          <p className="mt-4 text-[14px] leading-relaxed text-ink-500">
            The owner of this business can ask from this page.
          </p>
        )}
      </Section>
    </main>
  );
}
