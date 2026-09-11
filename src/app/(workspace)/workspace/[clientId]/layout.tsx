import { Link } from '@/components/portal/link';
import { notFound, redirect } from 'next/navigation';
import { WorkspaceFooter, WorkspaceHeader } from '@/components/portal/workspace';
import { SignOutButton } from '@/components/sign-out';
import { currentActor } from '@/lib/auth/authorize';
import { tenantGateFor } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { getTranslator } from '@/lib/i18n/request';
import { verticalLabel } from '@/lib/packs';
import { triggerFeedbackProcessing } from '@/lib/pipeline/trigger';
import { recordVisit } from '@/lib/retention/service';
import { getLifecycle } from '@/lib/lifecycle/access';

export const dynamic = 'force-dynamic';
// Long enough for the post-response reading of a batch and one provider round trip.
export const maxDuration = 60;

/**
 * The authenticated workspace shell.
 *
 * The gate runs here as well as on every page beneath it, not instead of them.
 * A layout is not a security boundary in the App Router — a page can be
 * requested in ways that do not re-run every ancestor — so each page still
 * checks for itself and this only decides what chrome to draw.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const t = await getTranslator();
  const gate = await tenantGateFor(clientId, 'MEMBER');
  if (!gate.ok) {
    if (!(await currentActor(prisma))) redirect('/login');
    notFound();
  }

  const [client, lifecycle] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { businessName: true, vertical: true, subscriptionStatus: true },
    }),
    getLifecycle(prisma, clientId, { viewerIsPlatformAdmin: gate.actor.isPlatformAdmin }),
  ]);
  if (!client) notFound();

  // Chrome only. The lock itself is enforced page by page in
  // requireOpenWorkspace, because a layout is not a security boundary here —
  // see the note above. This just stops the nav offering seven doors that all
  // lead back to Account.
  const locked = lifecycle?.workspaceLocked ?? false;

  // Paused is worth one line at the top of every page, because the difference
  // between "nothing is arriving" and "arriving, saved, not being read yet" is
  // exactly the thing an owner would otherwise get wrong.
  const paused =
    client.subscriptionStatus === 'PAUSED' || client.subscriptionStatus === 'CANCELLED';

  // Anything waiting to be read is read now, after this page has been served.
  // The gate above admitted this visitor to this client; that is the trust the
  // scoped run inherits.
  if (!locked) triggerFeedbackProcessing(clientId, 'VISIT');

  // And this visit is remembered, so the next one can open with what happened
  // in between. After the response, and after every page beneath here has read
  // the PREVIOUS value — stamping first would report an empty week to
  // everybody, forever.
  recordVisit(prisma, clientId);

  return (
    <>
      <WorkspaceHeader
        basePath={`/workspace/${clientId}`}
        businessName={client.businessName}
        verticalLabel={verticalLabel(client.vertical)}
        showExtras
        locked={locked}
        signOut={<SignOutButton variant="inline" />}
      />
      {paused ? (
        <p className="mb-6 border-l-2 border-warn-600 bg-warn-50 px-4 py-3 text-[14px] leading-relaxed text-ink-800">
          {t('errors.paused.banner')}{' '}
          <Link
            href={`/workspace/${clientId}/account`}
            className="inline-flex min-h-11 items-center font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
          >
            {t('errors.paused.account')} <span aria-hidden>→</span>
          </Link>
        </p>
      ) : null}
      {/* One <main> for every page under here, rather than four pages
          remembering to bring their own and five forgetting. The header and the
          footer sit outside it, which is what makes "skip to content" mean
          something. */}
      <main>{children}</main>
      <WorkspaceFooter businessName={client.businessName} />
    </>
  );
}
