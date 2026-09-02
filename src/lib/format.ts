/** Formatting helpers shared by the UI and the print routes. */

const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

const DATETIME_FMT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : DATE_FMT.format(d);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : DATETIME_FMT.format(d);
}

/** yyyy-MM-dd in local time, for <input type="date"> values. */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatRupees(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `₹${new Intl.NumberFormat('en-IN').format(value)}`;
}

/** Never invents precision: prints exactly what was measured. */
export function formatDecimal(
  value: number | null | undefined,
  dp = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(dp);
}

export function formatShare(share: number | null | undefined): string {
  if (share === null || share === undefined || Number.isNaN(share)) return '—';
  return `${Math.round(share * 100)}%`;
}

export function formatDelta(
  value: number | null | undefined,
  dp = 0,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (value === 0) return 'no change';
  return `${value > 0 ? '+' : ''}${value.toFixed(dp)}`;
}

export function formatMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** Splits a newline/comma separated textarea value into clean items. */
export function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function joinList(items: string[] | null | undefined): string {
  return (items ?? []).join('\n');
}

/** Safe JSON parse for the string columns SQLite stores. */
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const PLAN_OPTIONS = ['STARTER', 'GROWTH', 'PRO'] as const;

export const STATUS_OPTIONS = [
  'PROSPECT',
  'ONBOARDING',
  'ACTIVE',
  'PAUSED',
  'CHURNED',
] as const;

export const TASK_TYPES = [
  'Snapshot / report',
  'Review replies',
  'Client call',
  'Kit / print work',
  'Onboarding',
  'Data entry',
  'Admin',
  'Other',
] as const;

export const FORMALITY_OPTIONS = [
  'FORMAL',
  'NEUTRAL',
  'FRIENDLY',
  'CASUAL',
] as const;

export const LANGUAGE_MIX_OPTIONS = [
  'ENGLISH',
  'HINDI',
  'HINGLISH',
  'MARATHI',
  'MIXED',
] as const;

export const EMOJI_POLICY_OPTIONS = ['NONE', 'MINIMAL', 'MODERATE'] as const;

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((w) => (w.length > 0 ? w[0]?.toUpperCase() + w.slice(1) : w))
    .join(' ');
}
