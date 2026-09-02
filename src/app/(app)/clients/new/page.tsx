import { LinkButton, PageHeader } from '@/components/ui';
import { ClientForm, EMPTY_CLIENT } from '@/components/forms/client-form';
import { createClientAction } from '@/lib/actions/clients';
import { packOptions } from '@/lib/packs';

export const dynamic = 'force-dynamic';

export default function NewClientPage() {
  return (
    <>
      <PageHeader
        eyebrow="Clients"
        title="New client"
        description="Only the business name and vertical are required. Everything else can be filled in as you learn it."
        actions={<LinkButton href="/clients">Cancel</LinkButton>}
      />
      <ClientForm
        action={createClientAction}
        values={EMPTY_CLIENT}
        verticals={packOptions()}
        submitLabel="Create client"
      />
    </>
  );
}
