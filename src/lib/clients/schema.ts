import { z } from 'zod';
import { findPack } from '@/lib/packs';
import {
  nullableInt,
  nullableNumber,
  nullableUrl,
  optDate,
  optInt,
  optNum,
  optStr,
  str,
} from '@/lib/actions/shared';
import { PLAN_OPTIONS, STATUS_OPTIONS } from '@/lib/format';

/**
 * Client input contract.
 *
 * Kept separate from the server actions so it can be exercised directly by
 * tests without pulling in Next.js request context.
 *
 * PII BOUNDARY: the only contact fields here belong to the business owner or
 * operator RepOS contracts with. There is deliberately no field anywhere in
 * this schema for an end customer's name, phone number or email.
 */

// Single source of truth lives in lib/format.ts, which is safe to import from
// client components. Re-exported here so the validation contract reads whole.
export { PLAN_OPTIONS as PLAN_VALUES, STATUS_OPTIONS as STATUS_VALUES } from '@/lib/format';

export const clientInputSchema = z.object({
  businessName: z
    .string()
    .min(2, 'Business name is required.')
    .max(120, 'Business name is too long.'),
  vertical: z.string().refine((v) => findPack(v) !== undefined, {
    message: 'Choose the business type — it decides the whole playbook.',
  }),
  areaLabel: z
    .string()
    .max(160, 'Keep the area to a neighbourhood or city.')
    .nullable(),
  mapsUrl: nullableUrl,
  reviewLinkUrl: nullableUrl,
  ownerName: z.string().max(120, 'Owner name is too long.').nullable(),
  ownerPhone: z.string().max(40, 'Owner phone is too long.').nullable(),
  ownerEmail: z
    .string()
    .nullable()
    .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
      message: 'Enter a valid email address, or leave it blank.',
    }),
  avgCustomerValueInr: nullableInt('Average customer value', 0, 100_000_000),
  plan: z.enum(PLAN_OPTIONS, { message: 'Choose a plan.' }),
  status: z.enum(STATUS_OPTIONS, { message: 'Choose a status.' }),
  onboardingDate: z
    .date({ message: 'Enter a valid onboarding date.' })
    .nullable(),
  baselineRating: nullableNumber('Baseline rating', 0, 5),
  baselineReviewCount: nullableInt('Baseline review count', 0, 10_000_000),
  baselineReviewsPerWeek: nullableNumber('Baseline reviews/week', 0, 10_000),
  baselineObservedAt: z.date({ message: 'Enter a valid date.' }).nullable(),
  kitInstalledDate: z.date({ message: 'Enter a valid date.' }).nullable(),
  notes: z.string().max(4000, 'Notes are too long.').nullable(),
});

export type ClientInput = z.infer<typeof clientInputSchema>;

/** Reads the client form into the shape `clientInputSchema` validates. */
export function readClientForm(form: FormData): Record<string, unknown> {
  return {
    businessName: str(form, 'businessName'),
    vertical: str(form, 'vertical'),
    areaLabel: optStr(form, 'areaLabel'),
    mapsUrl: optStr(form, 'mapsUrl'),
    reviewLinkUrl: optStr(form, 'reviewLinkUrl'),
    ownerName: optStr(form, 'ownerName'),
    ownerPhone: optStr(form, 'ownerPhone'),
    ownerEmail: optStr(form, 'ownerEmail'),
    avgCustomerValueInr: optInt(form, 'avgCustomerValueInr'),
    plan: str(form, 'plan') || 'STARTER',
    status: str(form, 'status') || 'PROSPECT',
    onboardingDate: optDate(form, 'onboardingDate'),
    baselineRating: optNum(form, 'baselineRating'),
    baselineReviewCount: optInt(form, 'baselineReviewCount'),
    baselineReviewsPerWeek: optNum(form, 'baselineReviewsPerWeek'),
    baselineObservedAt: optDate(form, 'baselineObservedAt'),
    kitInstalledDate: optDate(form, 'kitInstalledDate'),
    notes: optStr(form, 'notes'),
  };
}

/**
 * Comparison key for duplicate detection.
 *
 * Deliberately NOT fuzzy: case, surrounding punctuation and repeated spaces are
 * normalised away, and nothing else. "Sunrise Clinic" and "sunrise  clinic."
 * collide; "Sunrise Clinic" and "Sunrise Dental" do not.
 */
export function normaliseBusinessName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[.,'’"`()\-_/\\&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
