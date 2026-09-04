'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { findPack, listPacks } from '@/lib/packs';
import {
  archiveClient,
  createClient,
  purgeClient,
  restoreClient,
  updateClient,
} from '@/lib/clients/service';
import { readClientForm } from '@/lib/clients/schema';
import {
  bool,
  failure,
  fromZod,
  nullableInt,
  nullableNumber,
  nullableUrl,
  optDate,
  optInt,
  optNum,
  optStr,
  str,
  success,
  text,
  type ActionState,
} from './shared';
import { adminGate, tenantGate } from '@/lib/auth/guard';

const MAX_COMPETITORS = 3;

function revalidateClient(id?: string) {
  revalidatePath('/');
  revalidatePath('/clients');
  if (id) {
    revalidatePath(`/clients/${id}`);
    revalidatePath(`/clients/${id}/edit`);
  }
}

// ---------------------------------------------------------------------------
// Client CRUD
// ---------------------------------------------------------------------------

export async function createClientAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;
  const result = await createClient(prisma, readClientForm(form));
  if (!result.ok) return failure(result.message, result.errors);

  revalidateClient(result.data.id);
  redirect(`/clients/${result.data.id}`);
}

export async function updateClientAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  // This form names the field `id` rather than `clientId`; the gate is told
  // which one to read rather than the id being trusted because it was found.
  const gate = await tenantGate(form, 'OWNER', 'id');
  if (!gate.ok) return gate.state;
  const id = gate.clientId;
  const result = await updateClient(prisma, id, readClientForm(form));
  if (!result.ok) return failure(result.message, result.errors);

  revalidateClient(id);
  revalidatePath(`/clients/${id}/profile`);
  return success(
    result.data.verticalChanged
      ? 'Client saved. The vertical changed, so new snapshots will use the new playbook. Snapshots already generated keep the taxonomy they were built with.'
      : 'Client saved.',
  );
}

export async function archiveClientAction(form: FormData): Promise<void> {
  const gate = await adminGate();
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const id = str(form, 'id');
  if (!id) return;

  await archiveClient(prisma, id);
  revalidateClient(id);
  redirect(`/clients?archived=${encodeURIComponent(id)}`);
}

export async function restoreClientAction(form: FormData): Promise<void> {
  const gate = await adminGate();
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  const id = str(form, 'id');
  if (!id) return;

  const result = await restoreClient(prisma, id);
  revalidateClient(id);
  redirect(
    result.ok
      ? `/clients?restored=${encodeURIComponent(id)}`
      : `/clients?view=archived&error=${encodeURIComponent(result.message)}`,
  );
}

/**
 * Permanent delete, kept separate from archiving. This is the delete-on-request
 * path described in COMPLIANCE.md and destroys the client's whole history.
 */
export async function purgeClientAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;
  const id = str(form, 'id');
  if (!id) return failure('Missing client id.');

  const result = await purgeClient(prisma, id, str(form, 'confirm'));
  if (!result.ok) return failure(result.message, result.errors);

  revalidateClient(id);
  redirect('/clients?deleted=1');
}

// ---------------------------------------------------------------------------
// Voice profile
// ---------------------------------------------------------------------------

const voiceSchema = z.object({
  formality: z.enum(['FORMAL', 'NEUTRAL', 'FRIENDLY', 'CASUAL']),
  languageMix: z.enum(['ENGLISH', 'HINDI', 'HINGLISH', 'MARATHI', 'MIXED']),
  greeting: z.string().max(400),
  signOff: z.string().max(400),
  preferredWords: z.string().max(4000),
  bannedWords: z.string().max(4000),
  emojiPolicy: z.enum(['NONE', 'MINIMAL', 'MODERATE']),
  exampleReplies: z.string().max(8000),
});

export async function saveVoiceProfileAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const parsed = voiceSchema.safeParse({
    formality: str(form, 'formality'),
    languageMix: str(form, 'languageMix'),
    greeting: text(form, 'greeting'),
    signOff: text(form, 'signOff'),
    preferredWords: text(form, 'preferredWords'),
    bannedWords: text(form, 'bannedWords'),
    emojiPolicy: str(form, 'emojiPolicy'),
    exampleReplies: text(form, 'exampleReplies'),
  });
  if (!parsed.success) return fromZod(parsed.error);

  await prisma.voiceProfile.upsert({
    where: { clientId },
    create: { clientId, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath(`/clients/${clientId}/profile`);
  return success('Voice profile saved.');
}

// ---------------------------------------------------------------------------
// Business policies
// ---------------------------------------------------------------------------

const policySchema = z.object({
  refundPolicy: z.string().max(4000),
  appointmentPolicy: z.string().max(4000),
  cancellationPolicy: z.string().max(4000),
  neverPromise: z.string().max(4000),
  sensitiveTopics: z.string().max(4000),
});

export async function savePolicyAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const parsed = policySchema.safeParse({
    refundPolicy: text(form, 'refundPolicy'),
    appointmentPolicy: text(form, 'appointmentPolicy'),
    cancellationPolicy: text(form, 'cancellationPolicy'),
    neverPromise: text(form, 'neverPromise'),
    sensitiveTopics: text(form, 'sensitiveTopics'),
  });
  if (!parsed.success) return fromZod(parsed.error);

  await prisma.businessPolicy.upsert({
    where: { clientId },
    create: { clientId, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath(`/clients/${clientId}/profile`);
  return success('Policies saved.');
}

// ---------------------------------------------------------------------------
// Competitors (max 3, all values entered by hand)
// ---------------------------------------------------------------------------

const competitorSchema = z.object({
  name: z.string().min(1, 'Name is required when a competitor row is used.').max(120),
  mapsUrl: nullableUrl,
  rating: nullableNumber('Rating', 0, 5),
  reviewCount: nullableInt('Review count', 0, 10_000_000),
  observedAt: z.date({ message: 'Enter a valid observation date.' }).nullable(),
});

export async function saveCompetitorsAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const gate = await tenantGate(form, 'OWNER');
  if (!gate.ok) return gate.state;
  const { clientId } = gate;

  const rows: Array<z.infer<typeof competitorSchema> & { sortIndex: number }> = [];
  const errors: Record<string, string> = {};

  for (let i = 0; i < MAX_COMPETITORS; i += 1) {
    const name = str(form, `competitors.${i}.name`);
    const mapsUrl = optStr(form, `competitors.${i}.mapsUrl`);
    const rating = optNum(form, `competitors.${i}.rating`);
    const reviewCount = optInt(form, `competitors.${i}.reviewCount`);
    const observedAt = optDate(form, `competitors.${i}.observedAt`);

    // A completely blank row simply means "no competitor here".
    if (
      name.length === 0 &&
      mapsUrl === null &&
      rating === null &&
      reviewCount === null &&
      observedAt === null
    ) {
      continue;
    }

    const parsed = competitorSchema.safeParse({
      name,
      mapsUrl,
      rating,
      reviewCount,
      observedAt,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = `competitors.${i}.${issue.path.join('.')}`;
        if (!errors[key]) errors[key] = issue.message;
      }
      continue;
    }
    rows.push({ ...parsed.data, sortIndex: i });
  }

  if (Object.keys(errors).length > 0) {
    return failure('Some competitor rows need attention.', errors);
  }

  await prisma.$transaction([
    prisma.competitor.deleteMany({ where: { clientId } }),
    ...rows.map((row) =>
      prisma.competitor.create({
        data: {
          clientId,
          name: row.name,
          mapsUrl: row.mapsUrl,
          rating: row.rating,
          reviewCount: row.reviewCount,
          observedAt: row.observedAt,
          sortIndex: row.sortIndex,
        },
      }),
    ),
  ]);

  revalidatePath(`/clients/${clientId}/profile`);
  return success(
    rows.length === 0
      ? 'Competitors cleared.'
      : `${rows.length} competitor row(s) saved.`,
  );
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

export async function seedDemoDataAction(form: FormData): Promise<void> {
  const gate = await adminGate();
  // A denial here is a 404, not a message: "not yours" and "not real"
  // must look identical to anyone trying ids.
  if (!gate.ok) notFound();
  if (!bool(form, 'confirm')) return;

  const packIds = listPacks().map((p) => p.id);
  const vertical = packIds.includes('clinic') ? 'clinic' : (packIds[0] as string);
  const pack = findPack(vertical);

  // Demo records are suffixed so re-seeding never trips the duplicate guard.
  const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
  const businessName = `Demo — Sunrise Clinic ${stamp}`;

  const created = await prisma.client.create({
    data: {
      businessName,
      vertical,
      areaLabel: 'Kothrud, Pune',
      ownerName: 'Demo Owner',
      ownerPhone: '000-000-0000',
      avgCustomerValueInr: 900,
      plan: 'GROWTH',
      status: 'ACTIVE',
      onboardingDate: new Date(),
      baselineRating: 4.1,
      baselineReviewCount: 148,
      baselineReviewsPerWeek: 0.8,
      baselineObservedAt: new Date(),
      notes: 'Demo record. Safe to archive or delete.',
      // Left blank, like a real new client: blank means "follow the pack".
      voiceProfile: { create: {} },
      policy: {
        create: {
          refundPolicy: 'No refunds after a consultation has taken place.',
          appointmentPolicy: 'Walk-ins accepted; booked slots take priority.',
          cancellationPolicy: 'Two hours notice for a free cancellation.',
          neverPromise: 'Guaranteed cure\nNo side effects\nFixed recovery time',
          sensitiveTopics: 'Diagnosis details\nAnything about a specific patient',
        },
      },
      kitConfig: {
        create: {
          displayName: 'Sunrise Clinic',
          // No public review link. The demo client is deliberately a
          // business with no public listing: its QR is its own feedback page,
          // which is all RepOS needs to be useful (M17).
          qrTargetUrl: '',
          headline:
            pack?.contentTemplates.find((t) => t.key === 'counter_card_headline')
              ?.body ?? 'How was your visit?',
          subhead:
            pack?.contentTemplates.find((t) => t.key === 'counter_card_subhead')
              ?.body ?? 'Scan and tell us honestly.',
          staffScript: pack?.staffAskScript.line ?? '',
        },
      },
      competitors: {
        create: [
          {
            name: 'Demo — City Care Clinic',
            rating: 4.5,
            reviewCount: 310,
            sortIndex: 0,
            observedAt: new Date(),
          },
          {
            name: 'Demo — Wellness Point',
            rating: 3.9,
            reviewCount: 96,
            sortIndex: 1,
            observedAt: new Date(),
          },
        ],
      },
      timeEntries: {
        create: [
          {
            taskType: 'Onboarding',
            minutes: 45,
            entryDate: new Date(),
            note: 'Demo entry',
          },
          {
            taskType: 'Snapshot / report',
            minutes: 25,
            entryDate: new Date(),
            note: 'Demo entry',
          },
        ],
      },
    },
    select: { id: true },
  });

  revalidateClient(created.id);
  redirect(`/clients/${created.id}`);
}
