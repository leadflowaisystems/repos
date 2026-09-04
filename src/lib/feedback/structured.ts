import type { PackDimension } from '@/lib/packs';

/**
 * THE STRUCTURED SIGNAL (M19).
 *
 * Most people will not write. They will tap. This module is the whole of what
 * a tap is worth: a handful of 1-5 ratings against the parts of a business the
 * vertical pack names, and the specifics a customer picked instead of typing
 * them out.
 *
 * Two rules hold everything else up:
 *
 *   Keys are stored, never labels. A pack may reword "The person who served
 *   you" tomorrow and every rating taken today still counts.
 *
 *   A key that no pack defines does not get stored. A customer cannot produce
 *   one, so anything else is a tampered form, and the honest part of that
 *   submission survives while the invented part does not.
 */

export const MIN_RATING = 1;
export const MAX_RATING = 5;
/** A ceiling on a hand-posted form. No vertical asks anything like this many. */
const MAX_DIMENSIONS = 24;
const MAX_SIGNALS = 40;

/** Stable dimension key to a 1-5 rating. */
export type DimensionRatings = Record<string, number>;

export type Structured = {
  dimensions: DimensionRatings;
  signals: string[];
};

export const EMPTY_STRUCTURED: Structured = { dimensions: {}, signals: [] };

function isRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_RATING && value <= MAX_RATING;
}

/**
 * What a customer actually said, keeping only what this vertical asked.
 *
 * Order follows the pack rather than the form, so two submissions to the same
 * business are always stored in the same order and can be read side by side.
 * A signal survives only when its own dimension was rated — a specific about
 * something the customer never scored is not evidence of anything.
 */
export function parseStructured(dimensions: PackDimension[], raw: {
  dimensions?: unknown;
  signals?: unknown;
}): Structured {
  const rawDimensions =
    raw.dimensions && typeof raw.dimensions === 'object' && !Array.isArray(raw.dimensions)
      ? (raw.dimensions as Record<string, unknown>)
      : {};
  const rawSignals = new Set(
    Array.isArray(raw.signals) ? raw.signals.filter((s): s is string => typeof s === 'string') : [],
  );

  const ratings: DimensionRatings = {};
  const signals: string[] = [];

  for (const dimension of dimensions.slice(0, MAX_DIMENSIONS)) {
    const value = rawDimensions[dimension.key];
    if (!isRating(value)) continue;
    ratings[dimension.key] = value;

    for (const signal of dimension.signals) {
      if (rawSignals.has(signal.key) && signals.length < MAX_SIGNALS) signals.push(signal.key);
    }
  }

  return { dimensions: ratings, signals };
}

/** How many of the vertical's questions this customer answered. */
export function ratedCount(structured: Structured): number {
  return Object.keys(structured.dimensions).length;
}

// --- Storage ---------------------------------------------------------------

export function encodeDimensions(ratings: DimensionRatings): string {
  return JSON.stringify(ratings);
}

export function encodeSignals(signals: string[]): string {
  return JSON.stringify(signals);
}

/**
 * Reads a stored row back.
 *
 * Every row written before M19 holds the defaults, and a row hand-edited into
 * nonsense reads as empty rather than throwing: a malformed field must never
 * be able to take down a page that lists hundreds of rows.
 */
export function readStructured(row: {
  dimensionsJson?: string | null;
  signalsJson?: string | null;
}): Structured {
  return { dimensions: readDimensions(row.dimensionsJson), signals: readSignals(row.signalsJson) };
}

export function readDimensions(json: string | null | undefined): DimensionRatings {
  if (!json) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: DimensionRatings = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isRating(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function readSignals(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string');
  } catch {
    return [];
  }
}
