import { notFound } from 'next/navigation';
import { Notice } from '@/components/ui';
import {
  ContextList,
  ContextPrompts,
  OwnerQuestionCard,
  type ActionOption,
  type ContextRowView,
  type ThemeOption,
} from '@/components/forms/context-forms';
import { prisma } from '@/lib/db';
import { CONSTRAINT_KEYS, CONSTRAINT_LABELS, listClientContext } from '@/lib/context/service';
import { listClientActions } from '@/lib/improve/service';
import { getPackOrFallback } from '@/lib/packs';
import { getPortalView } from '@/lib/portal/service';

export const dynamic = 'force-dynamic';

/**
 * BUSINESS CONTEXT (M13) — the operator's page for what the owner told RepOS.
 *
 * Four optional prompts, the open question RepOS is asking the owner, and
 * the record of everything said so far. The owner sees all of it on their own
 * pages as "You told us", never as customer evidence.
 */
export default async function ClientContextPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, businessName: true, vertical: true },
  });
  if (!client) notFound();

  const pack = getPackOrFallback(client.vertical);
  const [rows, actions, portal] = await Promise.all([
    listClientContext(prisma, client.id, { includeRetired: true }),
    listClientActions(prisma, client.id),
    getPortalView(prisma, client.id),
  ]);

  const themeLabel = new Map<string, string>(
    [...pack.issueTaxonomy, ...pack.praiseTaxonomy].map((t) => [t.key, t.label]),
  );
  const themes: ThemeOption[] = [
    ...pack.issueTaxonomy.map((t) => ({ value: t.key, label: `Complaint · ${t.label}` })),
    ...pack.praiseTaxonomy.map((t) => ({ value: t.key, label: `Praise · ${t.label}` })),
  ];
  const constraints = CONSTRAINT_KEYS.map((value) => ({ value, label: CONSTRAINT_LABELS[value] }));
  const actionOptions: ActionOption[] = actions.map((a) => ({
    value: a.id,
    label: `${a.provenance.themeLabel} — ${a.description || a.title}`,
  }));
  const views: ContextRowView[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    kindLabel: r.kindLabel,
    text: r.text,
    themeKey: r.themeKey,
    themeLabel: r.themeKey ? (themeLabel.get(r.themeKey) ?? null) : null,
    constraintKey: r.constraintKey,
    constraintLabel: r.constraintLabel,
    actionId: r.actionId,
    recordedAt: r.recordedAt,
    retiredAt: r.retiredAt,
    retiredNote: r.retiredNote,
  }));

  const flash =
    query.saved ? 'Saved.' :
    query.retired ? 'Marked as no longer true. The owner will not see it as current.' :
    query.restored ? 'Marked as true again.' :
    query.deleted ? 'Removed.' :
    query.answered ? 'Answer saved. RepOS has stopped asking and shows it as "You told us".' :
    null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-semibold tracking-tight text-ink-900">
          What should RepOS know about {client.businessName}?
        </h2>
        <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
          Record what the owner tells you, in their words. RepOS shows it back to them as
          &ldquo;You told us&rdquo;, keeps it apart from what customers said, and uses it to make
          suggestions practical. Everything is optional; one line is enough to start.
        </p>
      </div>

      {flash ? <Notice tone="good">{flash}</Notice> : null}

      <OwnerQuestionCard clientId={client.id} question={portal?.view.question ?? null} />

      <ContextPrompts clientId={client.id} themes={themes} constraints={constraints} />

      <ContextList
        clientId={client.id}
        rows={views}
        themes={themes}
        constraints={constraints}
        actions={actionOptions}
      />
    </div>
  );
}
