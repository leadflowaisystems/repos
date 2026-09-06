import { notFound, redirect } from 'next/navigation';
import { WorkspaceFooter, WorkspaceHeader } from '@/components/portal/workspace';
import { SignOutButton } from '@/components/sign-out';
import { currentActor } from '@/lib/auth/authorize';
import { tenantGateFor } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { verticalLabel } from '@/lib/packs';
import { triggerFeedbackProcessing } from '@/lib/pipeline/trigger';
import { recordVisit } from '@/lib/retention/service';

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
  const gate = await tenantGateFor(clientId, 'MEMBER');
  if (!gate.ok) {
    if (!(await currentActor(prisma))) redirect('/login');
    notFound();
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { businessName: true, vertical: true, subscriptionStatus: true },
  });
  if (!client) notFound();

  // Paused is worth one line at the top of every page, because the difference
  // between "nothing is arriving" and "arriving, kept, not being read yet" is
  // exactly the thing an owner would otherwise get wrong.
  const paused =
    client.subscriptionStatus === 'PAUSED' || client.subscriptionStatus === 'CANCELLED';

  // Anything waiting to be read is read now, after this page has been served.
  // The gate above admitted this visitor to this client; that is the trust the
  // scoped run inherits.
  triggerFeedbackProcessing(clientId, 'VISIT');

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
        signOut={<SignOutButton variant="inline" />}
      />
      {paused ? (
        <p className="mb-6 border-l-2 border-warn-600 bg-warn-50 px-4 py-3 text-[14px] leading-relaxed text-ink-800">
          This account is paused. Your customers can still leave feedback and it is all being
          kept — Headway starts reading it again as soon as the account is resumed. Nothing
          already collected has changed.
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
