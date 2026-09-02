/** Local-time month/period helpers shared by the minutes log and dashboards. */

/** [start, end) for the calendar month containing `date`, in local time. */
export function monthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1, 0, 0, 0, 0);
}

/** "2026-03" — the value used by <input type="month">. */
export function toMonthInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Parses "2026-03" back to a local Date at the first of that month. */
export function fromMonthInputValue(value: string | undefined): Date {
  if (!value) return new Date();
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match || !match[1] || !match[2]) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return new Date();
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
});

export function monthLabel(date: Date): string {
  return MONTH_LABEL.format(date);
}

/** Local midnight for a date, so day comparisons are stable. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
