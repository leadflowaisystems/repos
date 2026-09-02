import { z } from 'zod';

/** Result shape every server action returns, consumed by `useActionState`. */
export type ActionState = {
  ok: boolean;
  message: string;
  /** Field name -> first error, rendered next to the input. */
  errors: Record<string, string>;
};

export const IDLE: ActionState = { ok: false, message: '', errors: {} };

export function failure(
  message: string,
  errors: Record<string, string> = {},
): ActionState {
  return { ok: false, message, errors };
}

export function success(message: string): ActionState {
  return { ok: true, message, errors: {} };
}

export function fromZod(error: z.ZodError): ActionState {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return {
    ok: false,
    message: 'Some fields need attention.',
    errors,
  };
}

// ---------------------------------------------------------------------------
// FormData readers
// ---------------------------------------------------------------------------

export function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

/** Multi-line values keep their line breaks; only outer whitespace is trimmed. */
export function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '';
}

export function optStr(form: FormData, key: string): string | null {
  const value = str(form, key);
  return value.length > 0 ? value : null;
}

/** Returns null when blank, NaN when present but not a number. */
export function optNum(form: FormData, key: string): number | null {
  const value = str(form, key);
  if (value.length === 0) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function optInt(form: FormData, key: string): number | null {
  const n = optNum(form, key);
  if (n === null) return null;
  if (Number.isNaN(n)) return Number.NaN;
  return Number.isInteger(n) ? n : Number.NaN;
}

export function optDate(form: FormData, key: string): Date | null {
  const value = str(form, key);
  if (value.length === 0) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date(Number.NaN) : d;
}

export function bool(form: FormData, key: string): boolean {
  const value = form.get(key);
  return value === 'on' || value === 'true' || value === '1';
}

export function strList(form: FormData, key: string): string[] {
  return form
    .getAll(key)
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

// ---------------------------------------------------------------------------
// Reusable zod pieces
// ---------------------------------------------------------------------------

export const nullableDate = z
  .date({ message: 'Enter a valid date.' })
  .nullable();

export function nullableNumber(label: string, min: number, max: number) {
  return z
    .number({ message: `${label} must be a number.` })
    .min(min, `${label} cannot be below ${min}.`)
    .max(max, `${label} cannot be above ${max}.`)
    .nullable();
}

export function nullableInt(label: string, min: number, max: number) {
  return z
    .number({ message: `${label} must be a whole number.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} cannot be below ${min}.`)
    .max(max, `${label} cannot be above ${max}.`)
    .nullable();
}

/**
 * URLs are STORED REFERENCES ONLY. RepOS never fetches them, so validation
 * exists to catch typos, not to reach the network.
 */
export const nullableUrl = z
  .string()
  .nullable()
  .refine(
    (value) => {
      if (value === null) return true;
      try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Enter a full link starting with https://' },
  );

export const hexColour = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour such as #1F3A5F');
