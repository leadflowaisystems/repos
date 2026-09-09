import type { PrismaClient } from '@prisma/client';

/**
 * THE DAILY AI SAFETY BUDGET.
 *
 * Headway treats an LLM as an enhancement it can lose at any moment: a key can
 * expire, a free tier can change, a model can be decommissioned overnight (one
 * was, on 2026-08-16). None of that may reach a client's portal, so the
 * product is built to run without AI — and this is the valve that makes the
 * failure deliberate rather than accidental.
 *
 * WHAT IT PROTECTS AGAINST. Not a bill: the free tier does not bill. It
 * protects against a quiet, total loss of the AI enhancement partway through a
 * day, and against one runaway client or one operator's repeated clicking
 * consuming the whole allowance before anyone else's feedback is read. A
 * budget that stops optional work at a known number is a system that degrades
 * predictably; a provider returning 429s at an unknown one is not.
 *
 * FAIL CLOSED, ON PURPOSE. If the counter cannot be read — the table is not
 * there yet, the database is unreachable — this reports NO budget left, and
 * the callers fall back to deterministic processing. That is the safe
 * direction: the deterministic path is complete, so the cost of being wrong is
 * slightly coarser tagging, while the cost of failing open is an unbounded
 * spend against a limit nobody is watching.
 *
 * THE COUNTER IS NOT PER CLIENT. It is one allowance for the installation,
 * because the limit it stands in for — the provider's — is per key, not per
 * business.
 */

/**
 * Tokens per day, prompt and completion together.
 *
 * Sized against the provider's own daily ceiling with room to spare, and
 * against measured usage: at roughly 460 tokens for one ambiguous comment,
 * this is about 108 model-read comments a day across every client, when only
 * a minority of comments are ambiguous enough to be sent at all.
 */
export const AI_DAILY_TOKEN_BUDGET = 50_000;

export type AiUsageRecord = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** False when the provider errored, timed out or returned nothing usable. */
  ok: boolean;
  /** True when the caller used its deterministic result instead. */
  fellBack: boolean;
};

export type BudgetState = {
  budget: number;
  used: number;
  remaining: number;
  /** False once the day's allowance is gone, or when the counter is unreadable. */
  allowed: boolean;
  /** Plain words, safe for a log or an operator screen. Never a key. */
  note: string;
};

/** The UTC day a usage row belongs to, as `YYYY-MM-DD`. */
export function aiUsageDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * How much of today's allowance is left.
 *
 * One indexed aggregate over at most a handful of rows — one per provider and
 * model per day — so it is cheap enough to ask before each optional call.
 */
export async function aiBudget(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<BudgetState> {
  const day = aiUsageDay(now);
  try {
    const rows = await db.aiUsageDay.findMany({
      where: { day },
      select: { totalTokens: true },
    });
    const used = rows.reduce((sum, row) => sum + row.totalTokens, 0);
    const remaining = Math.max(0, AI_DAILY_TOKEN_BUDGET - used);
    return {
      budget: AI_DAILY_TOKEN_BUDGET,
      used,
      remaining,
      allowed: remaining > 0,
      note:
        remaining > 0
          ? `${used} of ${AI_DAILY_TOKEN_BUDGET} AI tokens used today.`
          : `Today's AI allowance is used up. Headway is reading everything itself until tomorrow.`,
    };
  } catch {
    // The table may not exist yet on an installation that has not run the M30
    // migration. Deterministic is the correct answer, not a crash.
    return {
      budget: AI_DAILY_TOKEN_BUDGET,
      used: 0,
      remaining: 0,
      allowed: false,
      note: 'The AI usage counter could not be read, so Headway is reading everything itself.',
    };
  }
}

/**
 * Adds one call to today's tally.
 *
 * Never throws: a counter that cannot be written must not fail the work it was
 * counting. A lost row understates usage for a day, which the next read of the
 * budget corrects for by simply having less recorded — the provider's own
 * limit is still the outer bound.
 *
 * NOTHING ABOUT THE CUSTOMER IS STORED. No text, no client id, no item id —
 * only which model was asked, how many tokens it cost, and whether it worked.
 */
export async function recordAiUsage(
  db: PrismaClient,
  record: AiUsageRecord,
  now: Date = new Date(),
): Promise<void> {
  const day = aiUsageDay(now);
  const total = Math.max(0, record.inputTokens) + Math.max(0, record.outputTokens);
  try {
    await db.aiUsageDay.upsert({
      where: { day_provider_model: { day, provider: record.provider, model: record.model } },
      create: {
        day,
        provider: record.provider,
        model: record.model,
        requests: 1,
        inputTokens: Math.max(0, record.inputTokens),
        outputTokens: Math.max(0, record.outputTokens),
        totalTokens: total,
        failures: record.ok ? 0 : 1,
        fallbacks: record.fellBack ? 1 : 0,
      },
      update: {
        requests: { increment: 1 },
        inputTokens: { increment: Math.max(0, record.inputTokens) },
        outputTokens: { increment: Math.max(0, record.outputTokens) },
        totalTokens: { increment: total },
        failures: { increment: record.ok ? 0 : 1 },
        fallbacks: { increment: record.fellBack ? 1 : 0 },
      },
    });
  } catch (error) {
    console.error(
      '[ai-budget] could not record usage:',
      error instanceof Error ? error.message : 'unknown error',
    );
  }
}

/**
 * A rough token count for a string, when the provider did not report one.
 *
 * Four characters per token is the usual English approximation. Devanagari
 * tokenises far worse, so this deliberately counts non-ASCII characters as a
 * whole token each: the budget should over-estimate rather than under-estimate
 * what a Marathi comment cost.
 */
export function estimateTokens(text: string): number {
  let ascii = 0;
  let wide = 0;
  for (const char of text) {
    if (char.charCodeAt(0) < 128) ascii += 1;
    else wide += 1;
  }
  return Math.ceil(ascii / 4) + wide;
}
