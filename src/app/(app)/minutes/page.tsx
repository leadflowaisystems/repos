import Link from 'next/link';
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
} from '@/components/ui';
import { MinuteCard } from '@/components/minute-list';
import { QuickMinuteForm } from '@/components/forms/minute-forms';
import { Select } from '@/components/ui';
import { prisma } from '@/lib/db';
import { categoryOptions, listRecentMinutes } from '@/lib/minutes/service';
import { listClients } from '@/lib/clients/service';
import { toDateInputValue } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Everything recorded across every active client.
 *
 * Deliberately not a dashboard: one feed and one quick-add form. The client's
 * own Minutes tab is where the full memory for a business lives.
 */
export default async function MinutesPage() {
  const [minutes, clients] = await Promise.all([
    listRecentMinutes(prisma, { limit: 40 }),
    listClients(prisma),
  ]);

  const today = toDateInputValue(new Date());

  if (clients.length === 0) {
    return (
      <>
        <PageHeader
          title="Minutes"
          description="What happened with each client — conversations, decisions and things to chase."
        />
        <Card>
          <EmptyState
            title="No clients yet"
            description="Minutes are recorded against a client, so add your first client to start building RepOS's memory of the business."
            action={
              <LinkButton href="/clients/new" variant="primary">
                Add your first client
              </LinkButton>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Minutes"
        description="What happened with each client — conversations, decisions and things to chase. RepOS keeps this so next month you can see what you did, not just what changed."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {minutes.length === 0 ? (
            <Card>
              <EmptyState
                title="No minutes yet"
                description="Record important conversations, decisions and context here. RepOS will use this memory later."
                action={
                  <span className="text-[13px] text-ink-500">
                    Use the form to record the first one.
                  </span>
                }
              />
            </Card>
          ) : (
            <>
              <p className="text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
                Recent across all clients
              </p>
              <div className="space-y-2">
                {minutes.map((minute) => (
                  <MinuteCard
                    key={minute.id}
                    minute={minute}
                    clientId={minute.clientId}
                    context={
                      <Link
                        href={`/clients/${minute.clientId}/minutes`}
                        className="underline underline-offset-2 hover:text-ink-800"
                      >
                        {minute.businessName}
                      </Link>
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <Card>
            <CardHeader
              title="Record something"
              description="Takes a few seconds."
            />
            <CardBody>
              <QuickMinuteForm
                clientId=""
                defaultDate={today}
                categories={categoryOptions()}
                clientPicker={
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-ink-700">
                      Client
                    </span>
                    <Select name="clientId" defaultValue={clients[0]?.id}>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.businessName}
                        </option>
                      ))}
                    </Select>
                  </label>
                }
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
