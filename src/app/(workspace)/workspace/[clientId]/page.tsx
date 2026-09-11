import { prisma } from '@/lib/db';
import { requireOpenWorkspace } from '@/lib/lifecycle/access';
import { PortalHome } from '@/components/workspace/home';
import { sinceLastVisit } from '@/lib/retention/service';
import { formatLongDate } from '@/lib/commercial/service';
import { getTranslator } from '@/lib/i18n/request';
import { Link } from '@/components/portal/link';

export const dynamic = 'force-dynamic';

/**
 * The authenticated home page.
 *
 * The client id in the URL is a REQUEST. Membership is the answer, and a
 * business belonging to somebody else is a 404 rather than a refusal — "not
 * yours" and "not real" must look identical to anyone trying ids.
 */
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const gate = await requireOpenWorkspace(clientId);
  const t = await getTranslator();

  // Read BEFORE the visit is stamped, which the layout does after the response.
  // The other order would report an empty week to everybody, forever.
  const since = await sinceLastVisit(prisma, clientId, gate.actor.userId);
  const { lifecycle } = gate;

  // The warning is a WHOLE sentence per case, not a stem with "today" or "in
  // five days" dropped into the middle of it. English tolerates that; Hindi
  // and Marathi put the day phrase and the verb somewhere else, and only a
  // complete sentence can move them.
  const trialEndsAt = lifecycle.trialEndsAt;
  const trialLine =
    lifecycle.warning === 'ENDING_IMMINENTLY' && trialEndsAt
      ? lifecycle.daysRemaining === 0
        ? t('home.trial.endsToday', { date: formatLongDate(trialEndsAt) })
        : lifecycle.daysRemaining === 1
          ? t('home.trial.endsTomorrow', { date: formatLongDate(trialEndsAt) })
          : t.plural('home.trial.endsInDays', lifecycle.daysRemaining ?? 0, {
              date: formatLongDate(trialEndsAt),
            })
      : null;

  return (
    <>
      {/* Home says it only at two days. At five the Account page says it and
          that is enough — a warning on every page every day for a week is how
          a warning stops being read. */}
      {trialLine ? (
        <p className="mb-6 border-l-2 border-warn-600 bg-warn-50 px-4 py-3 text-[14px] leading-relaxed text-ink-800">
          {trialLine}{' '}
          <Link
            href={`/workspace/${clientId}/account`}
            className="inline-flex min-h-11 items-center font-medium text-ink-900 underline decoration-ink-300 underline-offset-4 hover:decoration-ink-900"
          >
            {t('home.trial.continue')}
          </Link>
        </p>
      ) : null}
      <PortalHome
        clientId={clientId}
        basePath={`/workspace/${clientId}`}
        since={since}
      />
    </>
  );
}
