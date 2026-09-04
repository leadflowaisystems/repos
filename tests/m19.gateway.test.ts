import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import {
  getFeedbackItem,
  listClientFeedback,
  RATING_ONLY_PREVIEW,
} from '@/lib/feedback/service';
import { summariseDimensions, LOW_RATING_AT } from '@/lib/feedback/analysis';
import {
  EMPTY_STRUCTURED,
  parseStructured,
  readStructured,
  ratedCount,
} from '@/lib/feedback/structured';
import {
  MIN_MENTIONS_TO_NAME,
  SIGNAL_WEIGHTS,
  signalsFor,
  type ThemeMovement,
} from '@/lib/intelligence/engine';
import {
  _resetGatewayThrottles,
  ensureGateway,
  getGatewayView,
  resolvePublicGateway,
  savePublicBaseUrl,
  submitCustomerFeedback,
} from '@/lib/gateway/service';
import { getKitView } from '@/lib/kit/service';
import { generateQrSvg } from '@/lib/kit/qr';
import { buildGatewayCopy } from '@/lib/gateway/copy';
import { getPackOrFallback, listPacks } from '@/lib/packs';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/**
 * THE SMART FEEDBACK GATEWAY (M19).
 *
 * The gateway used to ask for a rating and a paragraph, and got the paragraph
 * from roughly nobody. These tests hold the replacement to its promise: that a
 * customer can finish without typing, that what they tapped is stored in a form
 * that survives a reworded pack, and that nothing about the flow treats an
 * unhappy customer differently from a happy one.
 */

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('m19-gateway');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
  _resetGatewayThrottles();
});

afterAll(async () => {
  await db.$disconnect();
});

async function restaurant() {
  const created = await createClient(
    db,
    validClientInput({ businessName: 'Anand Tiffin', vertical: 'restaurant' }),
  );
  if (!created.ok) throw new Error('fixture client failed');
  const gateway = await ensureGateway(db, created.data.id);
  if (!gateway) throw new Error('fixture gateway failed');
  return { clientId: created.data.id, token: gateway.publicToken };
}

const NO_MOVEMENT: ThemeMovement = {
  available: false,
  previousCount: null,
  currentCount: null,
  delta: null,
  state: 'INSUFFICIENT_DATA',
  note: '',
  pointNote: null,
  countNote: null,
};

// ---------------------------------------------------------------------------

describe('what every vertical asks', () => {
  it('gives every pack a set of questions with real follow-ups', () => {
    for (const pack of listPacks()) {
      const dimensions = pack.gateway?.dimensions ?? [];
      expect(dimensions.length, `${pack.id} asks nothing`).toBeGreaterThanOrEqual(4);

      for (const dimension of dimensions) {
        expect(dimension.label.length, `${pack.id}/${dimension.key}`).toBeGreaterThan(0);
        expect(dimension.improvePrompt.length, `${pack.id}/${dimension.key}`).toBeGreaterThan(0);
        expect(dimension.goodPrompt.length, `${pack.id}/${dimension.key}`).toBeGreaterThan(0);
        expect(dimension.signals.length, `${pack.id}/${dimension.key}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('points every question at an issue the pack already knows how to name', () => {
    for (const pack of listPacks()) {
      const known = new Set(pack.issueTaxonomy.map((t) => t.key));
      for (const dimension of pack.gateway?.dimensions ?? []) {
        expect(known.has(dimension.themeKey), `${pack.id}/${dimension.key}`).toBe(true);
      }
    }
  });

  it('keeps keys unique within a pack, so no rating overwrites another', () => {
    for (const pack of listPacks()) {
      const dimensions = pack.gateway?.dimensions ?? [];
      const keys = dimensions.map((d) => d.key);
      expect(new Set(keys).size, pack.id).toBe(keys.length);
      for (const dimension of dimensions) {
        const signalKeys = dimension.signals.map((s) => s.key);
        expect(new Set(signalKeys).size, `${pack.id}/${dimension.key}`).toBe(signalKeys.length);
      }
    }
  });

  it('never asks for a rating in the language of a review site', () => {
    // "Rate us", "give us five stars" — the wording of a business fishing for
    // a score rather than one asking what happened.
    const banned = /rate us|five stars|5 stars|leave us a|give us a? ?\d|star rating/i;
    for (const pack of listPacks()) {
      const copy = buildGatewayCopy(pack, 'Test Business');
      const surfaces = [copy.headline, copy.prompt, copy.printHeadline, copy.printLine];
      for (const dimension of pack.gateway?.dimensions ?? []) {
        surfaces.push(dimension.label, dimension.improvePrompt, dimension.goodPrompt);
        for (const signal of dimension.signals) surfaces.push(signal.label);
      }
      for (const line of surfaces) {
        expect(banned.test(line), `${pack.id}: ${line}`).toBe(false);
      }
    }
  });

  it('never celebrates at a customer who may have had a bad time', () => {
    const banned = /yay|woohoo|awesome|congrat|🎉|🥳|amazing!|thanks so much!/i;
    for (const pack of listPacks()) {
      const copy = buildGatewayCopy(pack, 'Test Business');
      for (const line of [copy.thanksHeadline, copy.thanksLine, copy.headline, copy.prompt]) {
        expect(banned.test(line), `${pack.id}: ${line}`).toBe(false);
      }
    }
  });

  it('offers specifics without calling anyone a complainer', () => {
    const banned = /complain|complaint|negative|problem with you|blame/i;
    for (const pack of listPacks()) {
      for (const dimension of pack.gateway?.dimensions ?? []) {
        expect(banned.test(dimension.improvePrompt), `${pack.id}/${dimension.key}`).toBe(false);
        for (const signal of dimension.signals) {
          expect(banned.test(signal.label), `${pack.id}/${signal.key}`).toBe(false);
        }
      }
    }
  });
});

describe('reading what a customer tapped', () => {
  const pack = getPackOrFallback('restaurant');
  const dimensions = pack.gateway?.dimensions ?? [];

  it('keeps the ratings the vertical asked for', () => {
    const parsed = parseStructured(dimensions, {
      dimensions: { food: 5, service: 2 },
      signals: ['rushed'],
    });
    expect(parsed.dimensions).toEqual({ food: 5, service: 2 });
    expect(parsed.signals).toEqual(['rushed']);
    expect(ratedCount(parsed)).toBe(2);
  });

  it('drops a key no pack defines rather than storing it', () => {
    const parsed = parseStructured(dimensions, {
      dimensions: { food: 4, 'drop table': 1, __proto__: 5 },
      signals: ['rushed', 'invented_signal'],
    });
    expect(Object.keys(parsed.dimensions)).toEqual(['food']);
    expect(parsed.signals).toEqual([]);
  });

  it('drops a rating outside 1 to 5, and anything that is not a whole number', () => {
    const parsed = parseStructured(dimensions, {
      dimensions: { food: 0, service: 6, waiting: 2.5, cleanliness: '4', value: 3 },
    });
    expect(parsed.dimensions).toEqual({ value: 3 });
  });

  it('ignores a specific about something the customer never rated', () => {
    // "The food was cold" from someone who did not rate the food is not
    // evidence about the food.
    const parsed = parseStructured(dimensions, {
      dimensions: { service: 2 },
      signals: ['not_hot', 'rushed'],
    });
    expect(parsed.signals).toEqual(['rushed']);
  });

  it('survives a row holding nothing, or nonsense', () => {
    expect(readStructured({})).toEqual(EMPTY_STRUCTURED);
    expect(readStructured({ dimensionsJson: 'not json', signalsJson: '{' })).toEqual(
      EMPTY_STRUCTURED,
    );
    expect(readStructured({ dimensionsJson: '[1,2]', signalsJson: '{"a":1}' })).toEqual(
      EMPTY_STRUCTURED,
    );
    expect(readStructured({ dimensionsJson: '{"food":9}' }).dimensions).toEqual({});
  });

  it('stores keys, so rewording a question does not orphan a rating', () => {
    const reworded = dimensions.map((d) => ({ ...d, label: 'COMPLETELY DIFFERENT WORDS' }));
    const parsed = parseStructured(reworded, { dimensions: { food: 4 } });
    expect(parsed.dimensions).toEqual({ food: 4 });
  });
});

describe('submitting', () => {
  it('accepts a customer who tapped and never typed', async () => {
    const { clientId, token } = await restaurant();

    const result = await submitCustomerFeedback(db, token, {
      stars: 2,
      text: '',
      dimensions: { food: 4, service: 1, waiting: 2 },
      signals: ['rushed', 'for_food'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.stored).toBe(true);

    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.text).toBe('');
    expect(readStructured(row)).toEqual({
      dimensions: { food: 4, service: 1, waiting: 2 },
      signals: ['rushed', 'for_food'],
    });
  });

  it('accepts ratings alone, with no overall star at all', async () => {
    const { clientId, token } = await restaurant();

    const result = await submitCustomerFeedback(db, token, {
      stars: null,
      text: '',
      dimensions: { cleanliness: 2 },
    });

    expect(result.ok).toBe(true);
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.stars).toBeNull();
    expect(readStructured(row).dimensions).toEqual({ cleanliness: 2 });
  });

  it('still refuses a submission that says nothing at all', async () => {
    const { token } = await restaurant();
    const result = await submitCustomerFeedback(db, token, {
      stars: null,
      text: '   ',
      dimensions: {},
      signals: [],
    });
    expect(result.ok).toBe(false);
  });

  it('refuses a submission whose only content is an invented key', async () => {
    const { token } = await restaurant();
    const result = await submitCustomerFeedback(db, token, {
      stars: null,
      text: '',
      dimensions: { not_a_real_question: 5 },
    });
    expect(result.ok).toBe(false);
  });

  it('stores words and taps together', async () => {
    const { clientId, token } = await restaurant();
    await submitCustomerFeedback(db, token, {
      stars: 2,
      text: 'Waited forty minutes for the food.',
      dimensions: { waiting: 1 },
      signals: ['for_food'],
    });

    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.text).toContain('forty minutes');
    expect(readStructured(row).dimensions).toEqual({ waiting: 1 });
  });

  it('leaves a pasted review with no structure rather than inventing some', async () => {
    const { clientId, token } = await restaurant();
    await submitCustomerFeedback(db, token, { stars: 5, text: 'Lovely place.' });

    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(readStructured(row)).toEqual(EMPTY_STRUCTURED);
  });

  it('gives the page the questions its own vertical asks', async () => {
    const { token } = await restaurant();
    const view = await resolvePublicGateway(db, token);
    expect(view?.dimensions.map((d) => d.key)).toEqual([
      'food',
      'service',
      'waiting',
      'cleanliness',
      'value',
    ]);
  });

  it('sends a one-star and a five-star customer to exactly the same place', async () => {
    const { token } = await restaurant();
    const unhappy = await submitCustomerFeedback(db, token, {
      stars: 1,
      text: 'Terrible.',
      dimensions: { food: 1 },
    });
    _resetGatewayThrottles();
    const happy = await submitCustomerFeedback(db, token, {
      stars: 5,
      text: 'Wonderful.',
      dimensions: { food: 5 },
    });

    expect(unhappy.ok && happy.ok).toBe(true);
    if (!unhappy.ok || !happy.ok) return;
    // The outcome carries the token and nothing about the rating, so the
    // thank-you page cannot route one of them somewhere quieter.
    expect(Object.keys(unhappy.data).sort()).toEqual(Object.keys(happy.data).sort());
    expect(unhappy.data.token).toBe(happy.data.token);
  });
});

describe('what the taps add up to', () => {
  const pack = getPackOrFallback('restaurant');

  it('counts ratings and specifics per question, in pack order', () => {
    const rows = [
      { dimensionsJson: '{"food":2,"service":4}', signalsJson: '["not_hot"]' },
      { dimensionsJson: '{"food":1}', signalsJson: '["not_hot","taste"]' },
      { dimensionsJson: '{"food":5}', signalsJson: '[]' },
    ];
    const summary = summariseDimensions(rows, pack);

    expect(summary.map((d) => d.key)).toEqual([
      'food',
      'service',
      'waiting',
      'cleanliness',
      'value',
    ]);

    const food = summary.find((d) => d.key === 'food')!;
    expect(food.rated).toBe(3);
    expect(food.low).toBe(2);
    expect(food.average).toBe(2.7);
    expect(food.themeKey).toBe('food_quality');
    expect(food.signals).toEqual([
      { key: 'not_hot', label: 'Not served hot', count: 2 },
      { key: 'taste', label: 'Taste was off', count: 1 },
    ]);

    const waiting = summary.find((d) => d.key === 'waiting')!;
    expect(waiting.rated).toBe(0);
    expect(waiting.average).toBeNull();
  });

  it('says nothing for a vertical that asks nothing', () => {
    expect(summariseDimensions([{ dimensionsJson: '{"food":1}' }], {
      ...pack,
      gateway: undefined,
    })).toEqual([]);
  });
});

describe('ratings as evidence', () => {
  const theme = { label: 'Long waiting time', count: 4, severity: 'high' as const };

  it('counts towards a complaint once it clears the same floor as words', () => {
    const signals = signalsFor('ISSUE', theme, NO_MOVEMENT, 'Restaurant', {
      label: 'Waiting',
      rated: 20,
      low: MIN_MENTIONS_TO_NAME,
      average: 2.4,
    });
    const rated = signals.find((s) => s.key === 'rated_low');
    expect(rated).toBeDefined();
    expect(rated?.weight).toBe(SIGNAL_WEIGHTS.rated_low);
    expect(rated?.reason).toContain('20');
    expect(rated?.reason).toContain(String(LOW_RATING_AT));
  });

  it('stays quiet below the floor, exactly as a written theme would', () => {
    const signals = signalsFor('ISSUE', theme, NO_MOVEMENT, 'Restaurant', {
      label: 'Waiting',
      rated: 20,
      low: MIN_MENTIONS_TO_NAME - 1,
      average: 4.1,
    });
    expect(signals.find((s) => s.key === 'rated_low')).toBeUndefined();
  });

  it('never claims a customer said something they only tapped', () => {
    const signals = signalsFor('ISSUE', theme, NO_MOVEMENT, 'Restaurant', {
      label: 'Waiting',
      rated: 20,
      low: 8,
      average: 2.1,
    });
    const reason = signals.find((s) => s.key === 'rated_low')!.reason;
    expect(reason).toMatch(/rated/i);
    expect(reason).not.toMatch(/said|told us|complained|wrote|mentioned/i);
  });

  it('is worth less than the written complaint it supports', () => {
    // A tap says something is wrong. Words say what. The ranking has to keep
    // that order or the loudest signal becomes the least informative one.
    expect(SIGNAL_WEIGHTS.rated_low).toBeLessThan(SIGNAL_WEIGHTS.severity_high);
    expect(SIGNAL_WEIGHTS.rated_low).toBeLessThan(SIGNAL_WEIGHTS.worsening);
  });

  it('adds nothing to praise, which these questions never asked about', () => {
    const signals = signalsFor(
      'PRAISE',
      { label: 'Friendly staff', count: 9, severity: 'low' },
      NO_MOVEMENT,
      'Restaurant',
      { label: 'Service', rated: 20, low: 12, average: 2.0 },
    );
    expect(signals.find((s) => s.key === 'rated_low')).toBeUndefined();
  });
});

describe('what the operator sees of a wordless customer', () => {
  it('shows the answers as labels, resolved from the pack at read time', async () => {
    const { clientId, token } = await restaurant();
    await submitCustomerFeedback(db, token, {
      stars: 2,
      text: '',
      dimensions: { waiting: 1, food: 4 },
      signals: ['for_food'],
    });
    const stored = await db.reviewItem.findFirstOrThrow({ where: { clientId } });

    const item = await getFeedbackItem(db, clientId, stored.id);
    expect(item?.answers).toEqual([
      { key: 'food', label: 'Food and drink', rating: 4, signals: [] },
      { key: 'waiting', label: 'Waiting', rating: 1, signals: ['For the food'] },
    ]);
  });

  it('says how many questions a wordless customer answered', async () => {
    const { clientId, token } = await restaurant();
    await submitCustomerFeedback(db, token, {
      stars: 3,
      text: '',
      dimensions: { food: 3, service: 4, waiting: 2 },
    });
    const [item] = await listClientFeedback(db, clientId, {});
    expect(item?.preview).toBe('Rated 3 questions — no written comment.');
  });

  it('still says rating only when that is all there was', async () => {
    const { clientId, token } = await restaurant();
    await submitCustomerFeedback(db, token, { stars: 4, text: '' });
    const [item] = await listClientFeedback(db, clientId, {});
    expect(item?.preview).toBe(RATING_ONLY_PREVIEW);
  });
});

describe('one address, everywhere it is printed', () => {
  it('gives the QR page, the counter card and the print kit the same URL', async () => {
    // M17 shipped two builders for this and they disagreed, so the QR on the
    // printed card pointed somewhere the copied link did not. They are still
    // two builders; this is what stops them drifting again.
    const { clientId, token } = await restaurant();
    await savePublicBaseUrl(db, 'https://feedback.example.com');

    const gatewayView = await getGatewayView(db, clientId, { requestOrigin: null });
    const kitView = await getKitView(db, clientId, { requestOrigin: null });
    const expected = `https://feedback.example.com/feedback/${token}`;

    expect(gatewayView?.feedbackUrl).toBe(expected);
    expect(kitView?.content.feedbackUrl).toBe(expected);
    expect(kitView?.qr).not.toBeNull();
    expect(gatewayView?.qr).not.toBeNull();
  });

  it('encodes that same URL into both QR images, not a different one', async () => {
    const { clientId, token } = await restaurant();
    await savePublicBaseUrl(db, 'https://feedback.example.com');

    const gatewayView = await getGatewayView(db, clientId, { requestOrigin: null });
    const kitView = await getKitView(db, clientId, { requestOrigin: null });
    const expected = `https://feedback.example.com/feedback/${token}`;

    // Both SVGs are generated from a URL; regenerating from the canonical one
    // must reproduce them byte for byte.
    const canonical = await generateQrSvg(expected);
    expect(canonical.ok).toBe(true);
    if (!canonical.ok) return;
    expect(gatewayView?.qr?.svg).toBe(canonical.svg);
    const kitQr = kitView?.qr;
    expect(kitQr?.ok).toBe(true);
    if (!kitQr?.ok) return;
    expect(kitQr.svg).toBe(canonical.svg);
  });
});
