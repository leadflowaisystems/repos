import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireOpenWorkspace } from '@/lib/lifecycle/access';
import { getFeedbackEntry } from '@/lib/portal/service';
import { getTranslator } from '@/lib/i18n/request';
import { FeedbackEntry } from '@/components/workspace/feedback-entry';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Feedback' };

/** A topic key as the packs write them. Anything else is ignored, never echoed. */
const TOPIC = /^[a-z0-9_]{1,64}$/;

/**
 * One feedback entry, on its own page (freshness pass).
 *
 * The client id in the URL is a REQUEST and the entry id is a second one.
 * Membership answers the first; the entry is then looked up by id AND client,
 * under Row Level Security, so an entry belonging to another business is a
 * 404 exactly like a business that does not exist.
 *
 * `from` and `topic` only choose the words and the address of the way back —
 * where the owner opened this from. They are checked against a closed shape
 * and never reach a query.
 */
export default async function FeedbackEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string; entryId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { clientId, entryId } = await params;
  await requireOpenWorkspace(clientId);
  const t = await getTranslator();
  const search = await searchParams;
  const basePath = `/workspace/${clientId}`;

  const item = await getFeedbackEntry(prisma, clientId, entryId, { t });
  if (!item) notFound();

  const from = typeof search.from === 'string' ? search.from : '';
  const topic = typeof search.topic === 'string' && TOPIC.test(search.topic) ? search.topic : null;

  // Named the way the page that linked here names itself: Home, the topic's
  // story (by the label this entry was filed under), or Feedback.
  let back = { href: `${basePath}/reviews`, label: t('nav.section.feedback') };
  if (from === 'home') {
    back = { href: basePath, label: t('nav.section.home') };
  } else if (topic) {
    const label = item.topics.find((x) => x.key === topic)?.label;
    if (label) back = { href: `${basePath}/reviews?theme=${encodeURIComponent(topic)}`, label };
  }

  return <FeedbackEntry item={item} basePath={basePath} back={back} now={new Date()} />;
}
