import type { PrismaClient } from '@prisma/client';
import { getPackOrFallback } from '@/lib/packs';
import { resolveVoice, type EffectiveVoice, type LanguageMix } from '@/lib/reply/voice';
import { loadIntelligence } from '@/lib/intelligence/service';
import { latestReportableAction } from '@/lib/improve/service';
import { getContextSet } from '@/lib/context/service';
import { youToldUs } from '@/lib/context/apply';
import type { InsightAction } from './insight';
import type { ClientIntelligence } from '@/lib/intelligence/engine';
import { buildInsight, type OwnerInsight } from './insight';
import {
  composeActionMessage,
  composeFollowUp,
  composeOwnerMessages,
  composeOwnerUpdate,
  ownerLanguage,
  type ComposedMessage,
  type CommsType,
} from './compose';

/**
 * OWNER COMMUNICATION SERVICE (M8).
 *
 * Loads what RepOS already knows about a client, builds the insight object, and
 * returns messages the operator can copy.
 *
 * Nothing here writes. There is no message record, no queue, no outbox and no
 * scheduler: a prepared message exists for as long as it is on screen, and the
 * operator copies it. Persisting drafts of owner messages would be storage
 * without a purpose until the recurring pulse (M12) needs it.
 *
 * Nothing here sends. RepOS has no outbound path for owner communication, by
 * design and by compliance test.
 */

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceErr = { ok: false; message: string; errors: Record<string, string> };
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

function err(message: string, errors: Record<string, string> = {}): ServiceErr {
  return { ok: false, message, errors };
}

function ok<T>(data: T): ServiceOk<T> {
  return { ok: true, data };
}

export type CommsBundle = {
  insight: OwnerInsight;
  /** The same calculation the intelligence panel renders. Never a second one. */
  intelligence: ClientIntelligence;
  voice: EffectiveVoice;
  language: LanguageMix;
  messages: ComposedMessage[];
  /**
   * What the owner told RepOS (M13), as "You told us …" lines for the operator
   * to keep in mind while sending. Never inserted into a message automatically,
   * and never mistaken for something a customer said.
   */
  ownerContext: string[];
};

/**
 * Everything the operator needs to communicate with one owner.
 *
 * One call: the insight, the resolved voice, and the prepared messages. The
 * operator opens the client and it is already done — no form to fill in, no
 * tone to pick, no model to choose. Defaults come from the client profile and
 * the vertical pack, exactly as the reply layer does it.
 */
export async function getOwnerComms(
  db: PrismaClient,
  clientId: string,
  options: { now?: Date; language?: string | null } = {},
): Promise<ServiceResult<CommsBundle>> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      businessName: true,
      vertical: true,
      voiceProfile: true,
      policy: true,
    },
  });
  if (!client) return err('That client no longer exists.');

  const now = options.now ?? new Date();
  const pack = getPackOrFallback(client.vertical);

  const baseVoice = resolveVoice(
    pack,
    { businessName: client.businessName, vertical: client.vertical },
    client.voiceProfile,
    client.policy,
  );

  // A one-click language switch on the panel, not a setting to configure. An
  // unknown value simply falls back to the client's own preference.
  const requested = (options.language ?? '').trim().toUpperCase();
  const voice: EffectiveVoice =
    requested.length > 0 &&
    ['ENGLISH', 'HINDI', 'HINGLISH', 'MARATHI'].includes(requested)
      ? { ...baseVoice, languageMix: requested as LanguageMix }
      : baseVoice;

  // One load and one calculation, shared with the intelligence panel. The
  // update is a presentation of that verdict, never a second opinion on it.
  const [context, action] = await Promise.all([
    loadIntelligence(
      db,
      { id: client.id, businessName: client.businessName, vertical: client.vertical },
      now,
    ),
    latestReportableAction(db, client.id),
  ]);

  // The improvement loop, projected into the flat shape the composer reads.
  // A result is attached only once the action has actually been measured, so
  // no message can imply an outcome the evidence has not been checked for.
  const actionUpdate: InsightAction | null = action
    ? {
        themeLabel: action.provenance.themeLabel,
        decision: action.description || action.provenance.recommendationText,
        status: action.status === 'MEASURED' ? 'MEASURED' : action.status === 'DONE' ? 'DONE' : 'ACCEPTED',
        result:
          action.status === 'MEASURED' && action.measurement
            ? {
                label: action.measurement.resultLabel,
                headline: action.measurement.headline,
                beforeLine: action.measurement.before.line,
                afterLine: action.measurement.after.line,
                beforeCount: action.measurement.before.count,
                beforeTotal: action.measurement.before.total,
                afterCount: action.measurement.after.count,
                afterTotal: action.measurement.after.total,
              }
            : null,
      }
    : null;

  const insight = buildInsight(
    {
      client: {
        id: client.id,
        businessName: client.businessName,
        vertical: client.vertical,
      },
      pack,
      themes: context.themes,
      totalFeedback: context.totalFeedback,
      pulse: context.pulse,
      recentlyDone: context.recentlyDone,
      action: actionUpdate,
    },
    context.intelligence,
  );

  // What the owner told RepOS, for the operator to keep in mind. Read here so
  // the panel and the owner's own pages show the same lines; never composed
  // into a message by machine.
  const ownerContext = (await getContextSet(db, client.id)).items
    .filter((i) => i.provenance === 'OWNER_TOLD_US')
    .slice(0, 6)
    .map((i) => youToldUs(i));

  return ok({
    insight,
    intelligence: context.intelligence,
    voice,
    language: ownerLanguage(voice),
    messages: composeOwnerMessages(insight, voice),
    ownerContext,
  });
}

/** One message on its own, for the Regenerate button. */
export async function getOwnerMessage(
  db: PrismaClient,
  clientId: string,
  type: CommsType,
  options: { now?: Date; language?: string | null } = {},
): Promise<ServiceResult<ComposedMessage>> {
  const bundle = await getOwnerComms(db, clientId, options);
  if (!bundle.ok) return bundle;

  const { insight, voice } = bundle.data;

  switch (type) {
    case 'OWNER_UPDATE':
      return ok(composeOwnerUpdate(insight, voice));
    case 'ACTION_MESSAGE':
      return ok(composeActionMessage(insight, voice));
    case 'FOLLOW_UP':
      return ok(composeFollowUp(insight, voice));
    default:
      // A review reply is written per review by the reply layer (M7), where the
      // customer's own words are in scope. There is no client-level version.
      return err('Replies to reviews are prepared on the Feedback page.');
  }
}
