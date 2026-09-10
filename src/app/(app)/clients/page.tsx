import Link from 'next/link';
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  Notice,
  PageHeader,
} from '@/components/ui';
import { DemoDataButton } from '@/components/demo-data-button';
import {
  ArchiveClientButton,
  RestoreClientButton,
} from '@/components/client-lifecycle';
import { prisma } from '@/lib/db';
import { countClients, listClients, type ClientListRow } from '@/lib/clients/service';
import { verticalLabel } from '@/lib/packs';
import { formatDate, formatNumber, titleCase } from '@/lib/format';
import { describeLifecycle, operatorLabel, type Lifecycle } from '@/lib/lifecycle/service';
import { listContinuationRequests } from '@/lib/continuation/service';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'good' | 'brand' | 'warn' | 'neutral' | 'bad'> = {
  ACTIVE: 'good',
  ONBOARDING: 'brand',
  PROSPECT: 'neutral',
  PAUSED: 'warn',
  CHURNED: 'bad',
};

/**
 * M28 - the service filters.
 *
 * Six views over the same list rather than six queries: the lifecycle is a pure
 * function of columns already fetched, so filtering happens here and the
 * operator's list cannot disagree with the owner's workspace about who has
 * lapsed.
 */
const SERVICE_FILTERS = {
  all: { label: 'All', match: () => true },
  active: {
    label: 'Active',
    match: (l: Lifecycle) => l.state === 'ACTIVE_SERVICE' || l.state === 'ACTIVE_TRIAL',
  },
  ending: {
    label: 'Trial ending soon',
    match: (l: Lifecycle) => l.state === 'ACTIVE_TRIAL' && l.warning !== null,
  },
  expired: { label: 'Expired', match: (l: Lifecycle) => l.state === 'TRIAL_EXPIRED' },
  locked: { label: 'Manually locked', match: (l: Lifecycle) => l.state === 'MANUALLY_LOCKED' },
} as const;

type ServiceFilter = keyof typeof SERVICE_FILTERS;

const SERVICE_TONE: Record<string, 'good' | 'brand' | 'warn' | 'neutral' | 'bad'> = {
  ACTIVE_TRIAL: 'brand',
  ACTIVE_SERVICE: 'good',
  TRIAL_EXPIRED: 'bad',
  MANUALLY_LOCKED: 'bad',
  ADMIN_OVERRIDE: 'warn',
  FOUNDER_EXEMPT: 'neutral',
  DEMO_EXEMPT: 'neutral',
};

function lifecycleOf(client: ClientListRow, now: Date): Lifecycle {
  return describeLifecycle({
    subscriptionStatus: client.subscriptionStatus,
    trialStartsAt: client.trialStartsAt,
    trialEndsAt: client.trialEndsAt,
    serviceLockedAt: client.serviceLockedAt,
    accessOverrideAt: client.accessOverrideAt,
    serviceExemption: client.serviceExemption,
    // The operator is looking at somebody else's business. The founder
    // exemption is about a workspace they can always open, not about how this
    // list should describe the business to them.
    viewerIsPlatformAdmin: false,
    now,
  });
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    service?: string;
    deleted?: string;
    archived?: string;
    restored?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const archivedView = params.view === 'archived';

  const [allClients, counts, requests] = await Promise.all([
    listClients(prisma, { onlyArchived: archivedView }),
    countClients(prisma),
    listContinuationRequests(prisma),
  ]);

  const hasAnyClient = counts.active + counts.archived > 0;

  // One instant for the whole render, so two rows cannot be judged against two
  // different clocks.
  const now = new Date();
  const asked = new Map(requests.map((r) => [r.clientId, r]));
  const withLifecycle = allClients.map((client) => ({
    client,
    lifecycle: lifecycleOf(client, now),
    request: asked.get(client.id) ?? null,
  }));

  const filterKey: ServiceFilter | 'requested' =
    params.service === 'requested'
      ? 'requested'
      : params.service && params.service in SERVICE_FILTERS
        ? (params.service as ServiceFilter)
        : 'all';

  const clients =
    filterKey === 'requested'
      ? withLifecycle.filter((row) => row.request !== null)
      : withLifecycle.filter((row) => SERVICE_FILTERS[filterKey].match(row.lifecycle));

  const countFor = (key: ServiceFilter | 'requested') =>
    key === 'requested'
      ? withLifecycle.filter((row) => row.request !== null).length
      : withLifecycle.filter((row) => SERVICE_FILTERS[key].match(row.lifecycle)).length;

  return (
    <>
      <PageHeader
        title="Clients"
        description="Every business you deliver customer intelligence for. All data stays on this laptop."
        actions={
          <>
            {!hasAnyClient ? <DemoDataButton /> : null}
            <LinkButton href="/clients/new" variant="primary">
              Add client
            </LinkButton>
          </>
        }
      />

      <div className="mb-5 space-y-3">
        {params.deleted ? (
          <Notice tone="good">
            Client deleted permanently. Every snapshot, pasted feedback item, kit
            setting and time entry for that client was removed with it.
          </Notice>
        ) : null}
        {params.archived ? (
          <Notice tone="good">
            Client archived. Its history is intact — restore it any time from the
            archived list.
          </Notice>
        ) : null}
        {params.restored ? (
          <Notice tone="good">
            Client restored to your active list with status &ldquo;Paused&rdquo;.
            Set the right status when you pick the work back up.
          </Notice>
        ) : null}
        {params.error ? <Notice tone="bad">{params.error}</Notice> : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ViewTab href="/clients" active={!archivedView}>
          Active ({counts.active})
        </ViewTab>
        <ViewTab href="/clients?view=archived" active={archivedView}>
          Archived ({counts.archived})
        </ViewTab>
      </div>

      {!archivedView ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(Object.keys(SERVICE_FILTERS) as ServiceFilter[]).map((key) => (
            <ViewTab
              key={key}
              href={key === 'all' ? '/clients' : `/clients?service=${key}`}
              active={filterKey === key}
            >
              {SERVICE_FILTERS[key].label} ({countFor(key)})
            </ViewTab>
          ))}
          <ViewTab href="/clients?service=requested" active={filterKey === 'requested'}>
            Continuation requested ({countFor('requested')})
          </ViewTab>
        </div>
      ) : null}

      <Card>
        {clients.length === 0 ? (
          archivedView ? (
            <EmptyState
              title="Nothing archived"
              description="Clients you stop working with end up here. Archiving keeps their whole history so you can compare later if they come back."
              action={<LinkButton href="/clients">Back to active clients</LinkButton>}
            />
          ) : (
            <EmptyState
              title="No clients yet"
              description="Add the first business you are working with. Only the business name and vertical are required — Headway never invents a figure you have not entered."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <LinkButton href="/clients/new" variant="primary">
                    Add your first client
                  </LinkButton>
                  {!hasAnyClient ? <DemoDataButton /> : null}
                </div>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-[13px]">
              <thead className="border-b border-ink-200 text-[12px] text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Business</th>
                  <th className="px-5 py-3 font-medium">Vertical</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 text-right font-medium">Baseline</th>
                  <th className="px-5 py-3 text-right font-medium">Snapshots</th>
                  <th className="px-5 py-3 font-medium">Last snapshot</th>
                  <th className="px-5 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map(({ client, lifecycle, request }) => (
                  <tr
                    key={client.id}
                    className="border-b border-ink-100 last:border-0 hover:bg-ink-50"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/clients/${client.id}`}
                        // Every link here points at one of the most expensive pages in
                        // RepOS, and Next.js prefetches them as soon as the row is on
                        // screen. Five businesses meant five full renders - seven loaders
                        // each - fired in the background every time this list was opened,
                        // and a real click then queued behind them until the browser ran
                        // out of connections to the origin. Measured during M20: 44
                        // client-detail renders for 8 clicks, peaking at 6 concurrent.
                        prefetch={false}
                        className="font-medium text-ink-900 underline-offset-2 hover:underline"
                      >
                        {client.businessName}
                      </Link>
                      <span className="mt-0.5 block text-[12px] text-ink-500">
                        {client.areaLabel || 'Area not recorded'} ·{' '}
                        {titleCase(client.plan)}
                        {client.kitInstalledDate ? ' · kit installed' : ''}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      {verticalLabel(client.vertical)}
                    </td>
                    <td className="px-5 py-3">
                      {/* Badges wrap inside the cell rather than widening it,
                          so the second one cannot push the table sideways. */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {client.archivedAt ? (
                          <Badge tone="neutral">Archived</Badge>
                        ) : (
                          <Badge tone={STATUS_TONE[client.status] ?? 'neutral'}>
                            {titleCase(client.status)}
                          </Badge>
                        )}
                        {/* M34 — this business has asked for the printed kit.
                            Gold, which is Headway's own emphasis and not one
                            of the two alarms: it is a thing to notice, not a
                            thing that has gone wrong. Counted from the
                            business's own KitOrder rows. */}
                        {client.kitOrderCount > 0 ? (
                          <Badge tone="brand">Kit ordered</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={SERVICE_TONE[lifecycle.state] ?? 'neutral'}>
                        {operatorLabel(lifecycle)}
                      </Badge>
                      <span className="mt-0.5 block text-[12px] text-ink-500">
                        {lifecycle.trialEndsAt
                          ? `${lifecycle.expired ? 'Ended' : 'Ends'} ${formatDate(lifecycle.trialEndsAt)}${
                              lifecycle.expired || lifecycle.daysRemaining === null
                                ? ''
                                : ` · ${lifecycle.daysRemaining} day${lifecycle.daysRemaining === 1 ? '' : 's'} left`
                            }`
                          : 'No end date'}
                      </span>
                      {request ? (
                        <span className="mt-0.5 block text-[12px] text-brand-700">
                          Asked to continue · {request.phone}
                          {request.email ? ` · ${request.email}` : ''}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-600">
                      {client.baselineRating === null
                        ? '—'
                        : client.baselineRating.toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-600">
                      {formatNumber(client.snapshotCount)}
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      {client.lastSnapshotAt
                        ? formatDate(client.lastSnapshotAt)
                        : 'None yet'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        {client.archivedAt ? (
                          <RestoreClientButton clientId={client.id} />
                        ) : (
                          <ArchiveClientButton
                            clientId={client.id}
                            businessName={client.businessName}
                            size="compact"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function ViewTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-lg bg-ink-900 px-3 py-1.5 text-[13px] font-medium text-white'
          : 'rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-600 hover:bg-ink-100'
      }
    >
      {children}
    </Link>
  );
}
