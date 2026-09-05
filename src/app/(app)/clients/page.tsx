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
import { countClients, listClients } from '@/lib/clients/service';
import { verticalLabel } from '@/lib/packs';
import { formatDate, formatNumber, titleCase } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'good' | 'brand' | 'warn' | 'neutral' | 'bad'> = {
  ACTIVE: 'good',
  ONBOARDING: 'brand',
  PROSPECT: 'neutral',
  PAUSED: 'warn',
  CHURNED: 'bad',
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    deleted?: string;
    archived?: string;
    restored?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const archivedView = params.view === 'archived';

  const [clients, counts] = await Promise.all([
    listClients(prisma, { onlyArchived: archivedView }),
    countClients(prisma),
  ]);

  const hasAnyClient = counts.active + counts.archived > 0;

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
              description="Add the first business you are working with. Only the business name and vertical are required — RepOS never invents a figure you have not entered."
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
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="border-b border-ink-200 text-[12px] text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Business</th>
                  <th className="px-5 py-3 font-medium">Vertical</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Baseline</th>
                  <th className="px-5 py-3 text-right font-medium">Snapshots</th>
                  <th className="px-5 py-3 font-medium">Last snapshot</th>
                  <th className="px-5 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
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
                      {client.archivedAt ? (
                        <Badge tone="neutral">Archived</Badge>
                      ) : (
                        <Badge tone={STATUS_TONE[client.status] ?? 'neutral'}>
                          {titleCase(client.status)}
                        </Badge>
                      )}
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
