import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AI IS AN ENHANCEMENT, NOT A DEPENDENCY (M30).
 *
 * Headway has to keep working when the key is missing, the quota is gone, the
 * model is decommissioned or the provider is simply down — one of its models
 * WAS decommissioned, on 2026-08-16, and the product carried on. These tests
 * are the promise that this stays true, and that the enhancement is bought as
 * cheaply as it can be.
 *
 * They count real provider calls. The seam is the provider itself, below
 * `runCompletion`, so everything above it — the routing, the budget, the
 * re-read rule, the sanitising of what comes back — runs exactly as it does in
 * production. A test that mocked the routing would prove nothing about it.
 */

// Hoisted so the mock factory below can reach it.
const provider = vi.hoisted(() => ({
  calls: [] as Array<{ system: string; user: string }>,
  reply: '' as string,
  fail: false,
}));

vi.mock('@/lib/ai/groq', () => ({
  groqProvider: {
    id: 'groq' as const,
    label: 'Groq',
    model: 'test-model',
    isConfigured: () => true,
    complete: async (options: { system: string; user: string }) => {
      provider.calls.push({ system: options.system, user: options.user });
      if (provider.fail) throw new Error('provider exploded');
      return { text: provider.reply, usage: { inputTokens: 400, outputTokens: 60 } };
    },
  },
}));

import { createClient } from '@/lib/clients/service';
import { ensureGateway, submitCustomerFeedback } from '@/lib/gateway/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { hasUnprocessedFeedback, processClientFeedback } from '@/lib/pipeline/feedback';
import { AI_DAILY_TOKEN_BUDGET, aiUsageDay } from '@/lib/ai/budget';
import { routeForAi } from '@/lib/ai/route';
import { getPackOrFallback } from '@/lib/packs';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

let db: PrismaClient;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const PACK = getPackOrFallback('restaurant');

/** Words the pack's own hints recognise. */
const RECOGNISED = 'The food was bland and tasteless, and the order was wrong.';
/** Real words, long enough to matter, that match no hint in any taxonomy. */
const AMBIGUOUS = 'The thing by the window yesterday was not quite what we pictured somehow.';

beforeAll(() => {
  db = createTestDb('m30-ai');
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
  provider.calls = [];
  provider.fail = false;
  // One valid entry, so a call that IS made succeeds and can be told apart
  // from one that was skipped.
  provider.reply = JSON.stringify({
    results: [{ i: 0, issues: ['service_speed'], praises: [], sentiment: 'NEGATIVE' }],
  });
});

async function client() {
  const created = await createClient(db, validClientInput({ vertical: 'restaurant' }));
  if (!created.ok) throw new Error('could not create the client');
  const gateway = await ensureGateway(db, created.data.id);
  if (!gateway) throw new Error('no gateway');
  return { clientId: created.data.id, token: gateway.publicToken };
}

async function submit(
  token: string,
  input: { stars?: number | null; text?: string; signals?: string[] | null },
) {
  const result = await submitCustomerFeedback(
    db,
    token,
    {
      stars: input.stars ?? null,
      text: input.text ?? '',
      website: null,
      dimensions: null,
      signals: input.signals ?? null,
      nonce: null,
    },
    { now: NOW, address: null },
  );
  if (!result.ok) throw new Error(`submit refused: ${result.message}`);
  return result.data;
}

/** Spends the whole day's allowance, so the next optional call is refused. */
async function exhaustBudget() {
  await db.aiUsageDay.create({
    data: {
      day: aiUsageDay(NOW),
      provider: 'groq',
      model: 'test-model',
      requests: 1,
      inputTokens: AI_DAILY_TOKEN_BUDGET,
      outputTokens: 0,
      totalTokens: AI_DAILY_TOKEN_BUDGET,
    },
  });
}

// ---------------------------------------------------------------------------
// Level 1 and 2: most feedback costs nothing
// ---------------------------------------------------------------------------

describe('structured input never reaches a provider', () => {
  it('sends nothing at all for a rating with no words', async () => {
    const { clientId, token } = await client();
    await submit(token, { stars: 5 });

    const run = await analyseClientFeedback(db, clientId, { now: NOW });

    expect(run.ok && run.data.analysed).toBe(1);
    expect(provider.calls, 'a tap was sent to a model').toHaveLength(0);
  });

  it('sends nothing for a rating plus tapped specifics', async () => {
    // The taps were chosen FROM the taxonomy. Re-reading them through a model
    // could only lose information.
    const { clientId, token } = await client();
    const signal = PACK.gateway?.dimensions?.[0]?.signals?.[0]?.key;
    expect(signal).toBeTruthy();
    await submit(token, { stars: 2, signals: [signal as string] });

    await analyseClientFeedback(db, clientId, { now: NOW });
    expect(provider.calls).toHaveLength(0);
  });

  it('sends nothing when the keyword pass already recognised the words', async () => {
    const { clientId, token } = await client();
    await submit(token, { stars: 2, text: RECOGNISED });

    const run = await analyseClientFeedback(db, clientId, { now: NOW });

    expect(run.ok && run.data.analysed).toBe(1);
    expect(provider.calls, 'a confident reading was sent anyway').toHaveLength(0);
    // And the item is fully read, with themes, by the deterministic pass.
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.analysisStatus).toBe('ANALYSED');
    expect(row.themesJson ?? '').not.toBe('');
  });

  it('decides per item, and says why', () => {
    // The routing is a pure function, so the reason is checkable without a
    // database, a provider or a network.
    expect(routeForAi({ text: '', stars: 5 }, PACK)).toMatchObject({
      needsAi: false,
      reason: 'NO_TEXT',
    });
    expect(routeForAi({ text: 'good', stars: 5 }, PACK)).toMatchObject({
      needsAi: false,
      reason: 'TEXT_TOO_SHORT',
    });
    expect(routeForAi({ text: RECOGNISED, stars: 2 }, PACK)).toMatchObject({
      needsAi: false,
      reason: 'KEYWORDS_CONFIDENT',
    });
    expect(routeForAi({ text: AMBIGUOUS, stars: 3 }, PACK)).toMatchObject({
      needsAi: true,
      reason: 'NO_KEYWORD_MATCH',
    });
  });
});

// ---------------------------------------------------------------------------
// Level 3: the minority that earns a call
// ---------------------------------------------------------------------------

describe('genuinely ambiguous free text may use a provider', () => {
  it('sends the one comment the keywords could not read', async () => {
    const { clientId, token } = await client();
    await submit(token, { stars: 3, text: AMBIGUOUS });

    await analyseClientFeedback(db, clientId, { now: NOW });

    expect(provider.calls).toHaveLength(1);
    // Only the free text goes — never the client's history or its dashboard.
    const sent = provider.calls[0]!.user;
    expect(sent).toContain('yesterday was not quite what we pictured');
    expect(sent.length).toBeLessThan(4_000);
  });

  it('sends nothing but the one ambiguous item, even in a mixed batch', async () => {
    const { clientId, token } = await client();
    await submit(token, { stars: 5 });
    await submit(token, { stars: 2, text: RECOGNISED });
    await submit(token, { stars: 3, text: AMBIGUOUS });

    const run = await analyseClientFeedback(db, clientId, { now: NOW });

    expect(run.ok && run.data.analysed).toBe(3);
    // Three items in, one batch out, carrying one comment.
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]!.user).not.toContain('bland and tasteless');
  });
});

// ---------------------------------------------------------------------------
// Nothing is ever sent twice
// ---------------------------------------------------------------------------

describe('feedback is understood once', () => {
  it('does not send the same item again on a later run', async () => {
    const { clientId, token } = await client();
    await submit(token, { stars: 3, text: AMBIGUOUS });

    await analyseClientFeedback(db, clientId, { now: NOW });
    expect(provider.calls).toHaveLength(1);

    await analyseClientFeedback(db, clientId, { now: NOW });
    await analyseClientFeedback(db, clientId, { now: NOW });
    expect(provider.calls, 'an already-read item was sent again').toHaveLength(1);
  });

  it('makes a portal refresh cost nothing once everything is read', async () => {
    const { clientId, token } = await client();
    await submit(token, { stars: 3, text: AMBIGUOUS });
    await processClientFeedback(db, clientId, { now: NOW });
    const afterFirst = provider.calls.length;

    // What a page view actually asks. Ten of them.
    for (let i = 0; i < 10; i += 1) {
      expect(await hasUnprocessedFeedback(db, clientId, NOW)).toBe(false);
    }
    expect(provider.calls).toHaveLength(afterFirst);
  });

  it('does not send history back when the engine version moves', async () => {
    // A deploy that bumps ANALYSIS_VERSION makes every stored item eligible
    // for re-reading so its themes stay current. That re-read is DETERMINISTIC.
    // Paying to have the same sentence read again buys nothing.
    const { clientId, token } = await client();
    await submit(token, { stars: 3, text: AMBIGUOUS });
    await analyseClientFeedback(db, clientId, { now: NOW });
    expect(provider.calls).toHaveLength(1);

    await db.reviewItem.updateMany({ where: { clientId }, data: { analysisVersion: 0 } });
    expect(await hasUnprocessedFeedback(db, clientId, NOW)).toBe(true);

    const rerun = await analyseClientFeedback(db, clientId, { now: NOW });

    expect(rerun.ok && rerun.data.analysed, 'the re-read did not happen').toBe(1);
    expect(provider.calls, 'a deploy re-sent history to the provider').toHaveLength(1);
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.analysisStatus).toBe('ANALYSED');
  });

  it('lets an operator ask for history to be read again, explicitly', async () => {
    const { clientId, token } = await client();
    await submit(token, { stars: 3, text: AMBIGUOUS });
    await analyseClientFeedback(db, clientId, { now: NOW });
    expect(provider.calls).toHaveLength(1);

    // The one path that may: a person clicked, on purpose.
    await analyseClientFeedback(db, clientId, { now: NOW, force: true });
    expect(provider.calls).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Every way it can go wrong
// ---------------------------------------------------------------------------

describe('the deterministic path always finishes the job', () => {
  it('keeps its own reading when the provider answers with nonsense', async () => {
    provider.reply = 'not json at all, sorry';
    const { clientId, token } = await client();
    await submit(token, { stars: 3, text: AMBIGUOUS });

    const run = await analyseClientFeedback(db, clientId, { now: NOW });

    expect(provider.calls).toHaveLength(1);
    expect(run.ok && run.data.analysed, 'a bad answer stopped the reading').toBe(1);
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.analysisStatus).toBe('ANALYSED');
  });

  it('discards a tag the model invented', async () => {
    // Anything outside this vertical's taxonomy never reaches a count.
    provider.reply = JSON.stringify({
      results: [{ i: 0, issues: ['made_up_theme_key'], praises: [], sentiment: 'NEGATIVE' }],
    });
    const { clientId, token } = await client();
    await submit(token, { stars: 3, text: AMBIGUOUS });

    await analyseClientFeedback(db, clientId, { now: NOW });

    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.themesJson ?? '').not.toContain('made_up_theme_key');
    expect(row.analysisStatus).toBe('ANALYSED');
  });

  it('finishes when the provider throws', async () => {
    provider.fail = true;
    const { clientId, token } = await client();
    await submit(token, { stars: 3, text: AMBIGUOUS });

    const run = await analyseClientFeedback(db, clientId, { now: NOW });

    expect(run.ok && run.data.analysed).toBe(1);
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.analysisStatus).toBe('ANALYSED');
  });

  it('reads everything with no provider at all', async () => {
    const { clientId, token } = await client();
    await submit(token, { stars: 5 });
    await submit(token, { stars: 2, text: RECOGNISED });
    await submit(token, { stars: 3, text: AMBIGUOUS });

    const run = await analyseClientFeedback(db, clientId, { now: NOW, useAi: false });

    expect(run.ok && run.data.analysed).toBe(3);
    expect(provider.calls).toHaveLength(0);
    const rows = await db.reviewItem.findMany({ where: { clientId } });
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.analysisStatus).toBe('ANALYSED');
  });
});

// ---------------------------------------------------------------------------
// The daily budget
// ---------------------------------------------------------------------------

describe('the daily safety budget', () => {
  it('stops optional calls once the allowance is gone, and reads on regardless', async () => {
    await exhaustBudget();
    const { clientId, token } = await client();
    await submit(token, { stars: 3, text: AMBIGUOUS });

    const run = await analyseClientFeedback(db, clientId, { now: NOW });

    expect(provider.calls, 'a call was made past the budget').toHaveLength(0);
    expect(run.ok && run.data.analysed, 'the budget stopped the reading too').toBe(1);
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.analysisStatus).toBe('ANALYSED');
  });

  it('records what a call cost, without recording anything about the customer', async () => {
    const { clientId, token } = await client();
    await submit(token, { stars: 3, text: AMBIGUOUS });
    await analyseClientFeedback(db, clientId, { now: NOW });

    const tally = await db.aiUsageDay.findFirstOrThrow({ where: { day: aiUsageDay(NOW) } });
    expect(tally.requests).toBe(1);
    expect(tally.totalTokens).toBe(460);
    expect(tally.provider).toBe('groq');

    // The counter must never become a second, quieter copy of what customers
    // wrote. There is no column here that could hold one.
    const columns = Object.keys(tally);
    expect(columns).not.toContain('clientId');
    expect(columns).not.toContain('text');
    expect(JSON.stringify(tally)).not.toContain('window');
  });
});
