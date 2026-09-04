import type { PrismaClient } from '@prisma/client';
import { cleanReviewText } from '@/lib/redact';
import { fingerprintFeedback } from './fingerprint';
import { type IngestSource, INGEST_SOURCES } from './service';

/**
 * SOURCE-NEUTRAL INTAKE (M14).
 *
 * One way in for every source that is not the operator's paste box. The
 * customer feedback page uses it today; a future public-review or messaging
 * source would call the same function with a different `source` value and
 * land in the same row, the same analysis queue and the same intelligence.
 *
 * It keeps the M5 boundary: nothing here classifies. It only redacts, decides
 * whether this is a duplicate, and writes one row.
 *
 * Duplicate rules are the caller's to choose, because they differ by source:
 *
 *   EXACT_FOREVER — the operator's paste rule. Identical wording for this
 *     client, ever, is the same review pasted twice.
 *   WINDOW — the public-page rule. Identical wording within a short window is
 *     the same person tapping twice; identical wording weeks apart is two
 *     customers who both wrote "good". Nobody is asked who they are, so time
 *     is the only signal, and it is used narrowly.
 */

import {
  EMPTY_STRUCTURED,
  encodeDimensions,
  encodeSignals,
  ratedCount,
  type Structured,
} from '@/lib/feedback/structured';

export type IngestInput = {
  text: string;
  stars: number | null;
  /** When the customer said it. The row's reviewDate. */
  occurredAt: Date | null;
  source: IngestSource;
  /**
   * What the customer tapped rather than typed (M19). Already checked against
   * the client's vertical pack by the caller; nothing here invents a key.
   * Absent for a pasted review, which has no structure to carry.
   */
  structured?: Structured;
};

export type Dedupe =
  | { mode: 'EXACT_FOREVER' }
  | {
      mode: 'WINDOW';
      /** Same wording within this many ms is one submission. */
      textWindowMs: number;
      /** Same rating with no wording within this many ms is one submission. */
      ratingOnlyWindowMs: number;
    };

export type IngestOptions = {
  now?: Date;
  dedupe: Dedupe;
  /** Allow a rating with no words at all. Off for pasted reviews. */
  allowEmptyText?: boolean;
};

export type IngestOutcome = {
  /** The stored row, or the earlier row this duplicated. */
  id: string;
  duplicate: boolean;
  redacted: boolean;
  redactions: string[];
};

export type IngestResult =
  | { ok: true; data: IngestOutcome }
  | { ok: false; message: string; errors: Record<string, string> };

const MAX_TEXT = 20_000;

function collapse(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function ingestFeedback(
  db: PrismaClient,
  clientId: string,
  input: IngestInput,
  options: IngestOptions,
): Promise<IngestResult> {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return { ok: false, message: 'That client no longer exists.', errors: {} };

  if (!INGEST_SOURCES.includes(input.source)) {
    return { ok: false, message: 'Unknown feedback source.', errors: { source: 'Unknown source.' } };
  }
  if (
    input.stars !== null &&
    (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5)
  ) {
    return {
      ok: false,
      message: 'Rating must be between 1 and 5.',
      errors: { stars: 'Rating must be between 1 and 5.' },
    };
  }

  const raw = (input.text ?? '').slice(0, MAX_TEXT);
  const cleaned = cleanReviewText(raw);
  const text = collapse(cleaned.text);
  const fingerprint = fingerprintFeedback(text);

  const structured = input.structured ?? EMPTY_STRUCTURED;
  // A customer who rated five parts of their visit and typed nothing has said
  // a great deal. Words are one way to have content, not the only one.
  const hasContent = input.stars !== null || ratedCount(structured) > 0;

  if (fingerprint.length === 0 && !(options.allowEmptyText && hasContent)) {
    return {
      ok: false,
      message: 'There was no usable text left.',
      errors: { text: 'Add some feedback text.' },
    };
  }

  const now = options.now ?? new Date();

  // --- Duplicate check --------------------------------------------------
  let earlier: { id: string } | null = null;
  if (options.dedupe.mode === 'EXACT_FOREVER') {
    earlier = fingerprint
      ? await db.reviewItem.findFirst({ where: { clientId, fingerprint }, select: { id: true } })
      : null;
  } else if (fingerprint) {
    earlier = await db.reviewItem.findFirst({
      where: {
        clientId,
        fingerprint,
        source: input.source,
        createdAt: { gte: new Date(now.getTime() - options.dedupe.textWindowMs) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
  } else {
    // Wordless, so the only thing that distinguishes one customer from the
    // next is what they tapped. Matching on the ratings as well as the star
    // means two people who both rated the food 2 are still two people unless
    // every one of their answers is identical within the window.
    earlier = await db.reviewItem.findFirst({
      where: {
        clientId,
        fingerprint: '',
        stars: input.stars,
        dimensionsJson: encodeDimensions(structured.dimensions),
        source: input.source,
        createdAt: { gte: new Date(now.getTime() - options.dedupe.ratingOnlyWindowMs) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
  }

  if (earlier) {
    return {
      ok: true,
      data: { id: earlier.id, duplicate: true, redacted: cleaned.redacted, redactions: cleaned.removed },
    };
  }

  const highest = await db.reviewItem.aggregate({ where: { clientId }, _max: { sortIndex: true } });

  const created = await db.reviewItem.create({
    data: {
      clientId,
      text,
      stars: input.stars,
      reviewDate: input.occurredAt,
      source: input.source,
      fingerprint,
      dimensionsJson: encodeDimensions(structured.dimensions),
      signalsJson: encodeSignals(structured.signals),
      redacted: cleaned.redacted,
      redactionsJson: JSON.stringify(cleaned.removed),
      sortIndex: (highest._max.sortIndex ?? -1) + 1,
      createdAt: now,
    },
    select: { id: true },
  });

  return {
    ok: true,
    data: { id: created.id, duplicate: false, redacted: cleaned.redacted, redactions: cleaned.removed },
  };
}
