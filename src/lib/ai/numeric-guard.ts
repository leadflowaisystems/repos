/**
 * Numeric guard for AI-drafted prose.
 *
 * The product rule is that a language model may phrase a finding but may never
 * produce a figure. This module enforces that mechanically rather than trusting
 * the prompt: every number that appears in AI output must already exist in the
 * deterministic analysis object, otherwise the sentence is rejected and the
 * deterministic template is used instead.
 */

/** Collects every numeric token that legitimately appears in the analysis. */
export function collectAllowedNumbers(source: unknown): Set<string> {
  const allowed = new Set<string>();

  const addNumber = (n: number) => {
    if (!Number.isFinite(n)) return;
    allowed.add(String(n));
    allowed.add(String(Math.abs(n)));
    allowed.add(String(Math.round(n)));
    allowed.add(String(Math.abs(Math.round(n))));
    allowed.add(n.toFixed(1));
    allowed.add(Math.abs(n).toFixed(1));
    allowed.add(n.toFixed(2));
    allowed.add(Math.abs(n).toFixed(2));
    // Shares are rendered as whole percentages elsewhere in the report.
    if (n >= 0 && n <= 1) allowed.add(String(Math.round(n * 100)));
  };

  const addFromString = (s: string) => {
    for (const m of s.matchAll(/\d+(?:\.\d+)?/g)) allowed.add(m[0]);
  };

  const walk = (value: unknown) => {
    if (typeof value === 'number') {
      addNumber(value);
    } else if (typeof value === 'string') {
      addFromString(value);
    } else if (Array.isArray(value)) {
      for (const v of value) walk(v);
    } else if (value && typeof value === 'object') {
      for (const v of Object.values(value)) walk(v);
    }
  };

  walk(source);

  // Evidence thresholds RepOS itself states in report copy.
  for (const t of ['0', '1', '2', '3', '10', '25', '30', '90', '100']) {
    allowed.add(t);
  }

  return allowed;
}

export type GuardResult = {
  ok: boolean;
  /** Numeric tokens found in the text that are not backed by the analysis. */
  offending: string[];
};

/**
 * Rejects text containing any number the analysis does not contain.
 * Ordinals and dates written as words are unaffected — only digits are checked.
 */
export function guardNumbers(text: string, allowed: Set<string>): GuardResult {
  const offending: string[] = [];
  for (const match of text.matchAll(/\d+(?:\.\d+)?/g)) {
    const token = match[0];
    if (!allowed.has(token)) offending.push(token);
  }
  return { ok: offending.length === 0, offending: [...new Set(offending)] };
}

/** Applies the guard field by field, substituting the deterministic fallback. */
export function guardFields<T extends Record<string, string>>(
  candidate: Partial<Record<keyof T, unknown>>,
  fallback: T,
  allowed: Set<string>,
): { value: T; rejected: string[] } {
  const out = { ...fallback };
  const rejected: string[] = [];

  for (const key of Object.keys(fallback) as Array<keyof T>) {
    const raw = candidate[key];
    if (typeof raw !== 'string') continue;
    const text = raw.trim();
    if (text.length === 0) continue;

    const guard = guardNumbers(text, allowed);
    if (guard.ok) {
      out[key] = text as T[keyof T];
    } else {
      rejected.push(
        `${String(key)} (unsupported figure${guard.offending.length === 1 ? '' : 's'}: ${guard.offending.join(', ')})`,
      );
    }
  }

  return { value: out, rejected };
}
