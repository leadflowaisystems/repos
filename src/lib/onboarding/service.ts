import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ensureGateway } from '@/lib/gateway/service';
import { findPack, packOptions } from '@/lib/packs';
import { ROLE_OWNER } from '@/lib/tenancy/service';

/**
 * SELF-SERVICE ONBOARDING (M20).
 *
 * The shortest path from "I signed up" to "my QR code works". Four answers,
 * not a questionnaire: what the business is called, what kind of business it
 * is, where it is, and one line about what matters to the owner.
 *
 * Everything else RepOS knows about a business it learns from customers. That
 * is the whole product thesis, and asking an owner to type it in at signup
 * would contradict it.
 *
 * What this must leave behind, or it has not finished:
 *   a Client, an owner Membership, the right vertical pack, a FeedbackGateway
 *   with its canonical public token, and setupCompletedAt.
 */

export type ServiceOk<T> = { ok: true; data: T };
export type ServiceErr = { ok: false; message: string; errors: Record<string, string> };
export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

function err(message: string, errors: Record<string, string> = {}): ServiceErr {
  return { ok: false, message, errors };
}

export const MAX_CONTEXT = 500;

export const onboardingSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, 'Add the name customers know you by.')
    .max(120, 'That name is too long.'),
  vertical: z.string().trim().min(1, 'Choose the kind of business.'),
  areaLabel: z
    .string()
    .trim()
    .max(120, 'That is too long.')
    .optional()
    .transform((v) => v ?? ''),
  ownerName: z.string().trim().max(120).optional().transform((v) => v ?? ''),
  ownerPhone: z.string().trim().max(40).optional().transform((v) => v ?? ''),
  /** One line the owner wants RepOS to keep in mind. Never a survey. */
  context: z
    .string()
    .trim()
    .max(MAX_CONTEXT, `Keep it under ${MAX_CONTEXT} characters.`)
    .optional()
    .transform((v) => v ?? ''),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;

export type OnboardingResult = {
  clientId: string;
  vertical: string;
  /** The M19 gateway token. The customer-facing URL is built from this. */
  publicToken: string;
};

/** The verticals an owner may choose, straight from /packs. */
export function verticalChoices(): Array<{ value: string; label: string }> {
  return packOptions();
}

/**
 * Creates the business, the owner's membership and the feedback gateway.
 *
 * Runs as one transaction: a half-finished signup that left a business with no
 * owner would be unreachable by the person who just created it, and a business
 * with no gateway would be a customer with a QR code that resolves to nothing.
 *
 * The user id comes from the authenticated session, never from the form.
 */
export async function completeOnboarding(
  db: PrismaClient,
  userId: string,
  raw: OnboardingInput,
  options: { now?: Date } = {},
): Promise<ServiceResult<OnboardingResult>> {
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
    }
    return err('Some fields need attention.', errors);
  }
  const input = parsed.data;

  // The vertical decides the questions customers are asked, the wording on the
  // printed card and the themes the intelligence engine can name. An unknown
  // one would leave the business with none of that.
  if (!findPack(input.vertical)) {
    return err('Some fields need attention.', { vertical: 'Choose the kind of business.' });
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return err('That account no longer exists.');

  const now = options.now ?? new Date();

  const clientId = await db.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        businessName: input.businessName,
        vertical: input.vertical,
        areaLabel: input.areaLabel || null,
        ownerName: input.ownerName || null,
        ownerPhone: input.ownerPhone || null,
        status: 'ACTIVE',
        subscriptionStatus: 'TRIAL',
        onboardingDate: now,
        setupCompletedAt: now,
      },
      select: { id: true },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        clientId: client.id,
        role: ROLE_OWNER,
        status: 'ACTIVE',
      },
    });

    // One line, stored the same way every other piece of owner context is, so
    // the intelligence engine reads it through the path it already has rather
    // than a special onboarding field nothing else knows about.
    if (input.context.length > 0) {
      await tx.businessContext.create({
        data: {
          clientId: client.id,
          kind: 'PRIORITY',
          provenance: 'OWNER_TOLD_US',
          text: input.context,
          recordedAt: now,
        },
      });
    }

    return client.id;
  });

  // The M19 gateway, unchanged: same service, same token shape, same canonical
  // URL every printed and on-screen surface already resolves to.
  const gateway = await ensureGateway(db, clientId);
  if (!gateway) return err('The business was created but its feedback page was not.');

  return {
    ok: true,
    data: { clientId, vertical: input.vertical, publicToken: gateway.publicToken },
  };
}

/**
 * Where a signed-in person should land.
 *
 * Platform staff go to the operator workspace. An owner or staff member goes
 * to their business. Somebody with an account but no business yet has not
 * finished signing up, so they go and finish.
 */
export function landingPathFor(actor: {
  isPlatformAdmin: boolean;
  memberships: Array<{ clientId: string; status: string }>;
}): string {
  if (actor.isPlatformAdmin) return '/';
  const active = actor.memberships.find((m) => m.status === 'ACTIVE');
  if (!active) return '/onboarding';
  return `/workspace/${active.clientId}`;
}
