import { readFileSync } from 'node:fs';
import { join as joinPath, resolve as resolvePath } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import { ensureGateway, submitCustomerFeedback } from '@/lib/gateway/service';
import { getPackOrFallback, listPacks } from '@/lib/packs';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/**
 * EVERY RATING GETS TO SAY SOMETHING (M30).
 *
 * The gateway used to show its tappable specifics only at three stars or
 * below. A customer who tapped four or five was shown one sentence and given
 * nothing to tap, so the most valuable thing this product collects — "the food
 * was excellent, but we waited forty minutes" — had nowhere to go.
 *
 * That is now fixed, and these tests hold it fixed from both ends: the form
 * offers the options at every rating, and the server stores them at every
 * rating. Neither half is much use without the other.
 *
 * THE POSITIVE TAXONOMY (final experience pass) is the next step, not a
 * reversal: every dimension gained a `positiveSignals` counterpart to its
 * `signals`, and which one the form shows is the whole of what a rating now
 * changes — 5 and 4 offer the positive list, 1-3 the improvement one, and a 4
 * can also reach the improvement list through a compact, collapsed disclosure.
 * Both lists post through the same field, validate against the same pack, and
 * land in the same `signalsJson` column: two taxonomies, one pipe.
 *
 * WHAT MUST NOT COME BACK. Nothing here may become review gating. A high
 * rating is not routed anywhere different, is not offered a public review any
 * sooner, and a low one is not offered it any later — so alongside the new
 * behaviour these also pin the old promise that the way out is identical for
 * everyone.
 */

const ROOT = resolvePath(__dirname, '..');
const form = readFileSync(
  joinPath(ROOT, 'src', 'components', 'feedback-gateway', 'customer-form.tsx'),
  'utf8',
);
const copy = readFileSync(joinPath(ROOT, 'src', 'lib', 'gateway', 'copy.ts'), 'utf8');

let db: PrismaClient;

const NOW = new Date('2026-06-01T12:00:00.000Z');

beforeAll(() => {
  db = createTestDb('m30-gateway');
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
});

/** The real submission path, with the fields this file cares about. */
async function submit(
  token: string,
  input: {
    stars?: number | null;
    text?: string;
    website?: string | null;
    dimensions?: Record<string, unknown> | null;
    signals?: string[] | null;
  },
) {
  return submitCustomerFeedback(
    db,
    token,
    {
      stars: input.stars ?? null,
      text: input.text ?? '',
      website: input.website ?? null,
      dimensions: input.dimensions ?? null,
      signals: input.signals ?? null,
      nonce: null,
    },
    { now: NOW, address: null },
  );
}

beforeEach(async () => {
  await resetDb(db);
});

async function restaurant() {
  const created = await createClient(db, validClientInput({ vertical: 'restaurant' }));
  if (!created.ok) throw new Error('could not create the client');
  const clientId = created.data.id;
  const gateway = await ensureGateway(db, clientId);
  if (!gateway) throw new Error('no gateway');
  return { clientId, token: gateway.publicToken };
}

/** The signal keys a real restaurant customer could tap. */
function firstSignal(): { dimensionKey: string; signalKey: string } {
  const pack = getPackOrFallback('restaurant');
  const dimension = pack.gateway?.dimensions?.[0];
  if (!dimension?.signals?.[0]) throw new Error('the restaurant pack has no signals');
  return { dimensionKey: dimension.key, signalKey: dimension.signals[0].key };
}

// ---------------------------------------------------------------------------
// The form offers the options at every rating
// ---------------------------------------------------------------------------

describe('the specifics are offered at every rating, grouped by band', () => {
  it('gates the tag sections on HAVING rated, not on rating badly', () => {
    // The whole M30 change, still in force: no gate keyed off a low rating.
    expect(form).toContain('const rated = rating !== null;');
    expect(form).not.toMatch(/\{low\s*&&/);
  });

  it('splits the taxonomy into three bands, not a high/low binary', () => {
    // Five gets its own band: a 5 is not just "another high rating" once a 4
    // has somewhere else to go (the compact disclosure below).
    expect(form).toContain("if (rating === 5) return 'love';");
    expect(form).toContain("if (rating > NEEDS_DETAIL_AT) return 'like';");
    expect(form).toContain("return 'improve';");
  });

  it('shows the positive taxonomy for love and like, the improvement one for improve — never a mix', () => {
    expect(form).toContain('dimension.positiveSignals.map((signal) => (');
    expect(form).toContain('tone="green"');
    expect(form).toContain('tone="red"');
    const greenAt = form.indexOf('tone="green"');
    const redAt = form.indexOf('tone="red"');
    expect(greenAt).toBeGreaterThan(0);
    expect(redAt).toBeGreaterThan(greenAt);
  });

  it('offers the improvement taxonomy at 4 stars only, compactly, collapsed by default', () => {
    // A 4 can reach the same list a 1-3 sees directly, but only by choosing
    // to open it — never the first thing on screen.
    expect(form).toContain("band === 'like' && dimension.signals.length > 0");
    expect(form).toContain('function Make5Disclosure');
    expect(form).toContain('const [open, setOpen] = useState(false);');
    expect(form).toContain('tone="amber"');
  });

  it('keeps the options optional and non-leading at every rating', () => {
    // "Pick any that fit — or none." Tapping nothing is a complete answer, so
    // offering the list to a happy customer cannot read as fishing for faults.
    expect(copy).toContain("signalsNote: 'Pick any that fit — or none.'");
    expect(form).toContain('{copy.signalsNote}');
  });

  it('asks the open question in words that suit how it went', () => {
    // One box, three framings, chosen by what was tapped — not three
    // different forms, and not a complaints box for unhappy people.
    for (const key of ['askKeep', 'askBetter', 'askMixed']) {
      expect(copy, key).toContain(`${key}:`);
      expect(form, key).toContain(`copy.${key}`);
    }
  });

  it('never hides the open box behind a rating', () => {
    // The words step is reachable from every path through the form.
    expect(form).toContain("const last: Step = 'words'");
    expect(form).not.toMatch(/stars\s*[<>]=?\s*\d[^\n]*\?\s*null/);
  });
});

// ---------------------------------------------------------------------------
// The server stores them at every rating
// ---------------------------------------------------------------------------

describe('a customer at any rating can be heard', () => {
  for (const stars of [1, 2, 3, 4, 5]) {
    it(`stores the specifics a ${stars}-star customer taps`, async () => {
      const { clientId, token } = await restaurant();
      const { dimensionKey, signalKey } = firstSignal();

      const result = await submit(token, {
        stars,
        text: '',
        website: '',
        dimensions: { [dimensionKey]: stars },
        signals: [signalKey],
      });

      expect(result.ok, `${stars} stars was refused`).toBe(true);
      const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
      expect(row.stars).toBe(stars);
      // The tapped specific survives the trip, whatever the rating was.
      expect(row.signalsJson ?? '', `${stars} stars lost its signal`).toContain(signalKey);
    });
  }

  for (const stars of [4, 5]) {
    it(`keeps the constructive words a ${stars}-star customer writes`, async () => {
      // The sentence this whole change exists for.
      const { clientId, token } = await restaurant();
      const words = 'Great food, but the service was slow and we waited a long time.';

      const result = await submit(token, {
        stars,
        text: words,
        website: '',
      });

      expect(result.ok).toBe(true);
      const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
      expect(row.text).toBe(words);
      expect(row.stars).toBe(stars);
    });
  }

  it('does not treat a happy customer as having nothing to say', async () => {
    // A five-star submission carrying a specific and words is stored whole —
    // no branch anywhere drops either because the rating was high.
    const { clientId, token } = await restaurant();
    const { dimensionKey, signalKey } = firstSignal();

    const result = await submit(token, {
      stars: 5,
      text: 'Loved it. The bill took a while though.',
      website: '',
      dimensions: { [dimensionKey]: 5 },
      signals: [signalKey],
    });

    expect(result.ok).toBe(true);
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.text).toContain('bill took a while');
    expect(row.signalsJson ?? '').toContain(signalKey);
    expect(row.source).toBe('REP_OS_QR');
  });
});

// ---------------------------------------------------------------------------
// The positive taxonomy: a new counterpart, not a new pipe
// ---------------------------------------------------------------------------

describe('the positive taxonomy (final experience pass)', () => {
  function firstPositiveSignal(): { dimensionKey: string; signalKey: string } {
    const pack = getPackOrFallback('restaurant');
    const dimension = pack.gateway?.dimensions?.[0];
    if (!dimension?.positiveSignals?.[0]) {
      throw new Error('the restaurant pack has no positive signals');
    }
    return { dimensionKey: dimension.key, signalKey: dimension.positiveSignals[0].key };
  }

  it('stores a positive specific exactly as an issue specific is stored', async () => {
    const { clientId, token } = await restaurant();
    const { dimensionKey, signalKey } = firstPositiveSignal();

    const result = await submit(token, {
      stars: 5,
      dimensions: { [dimensionKey]: 5 },
      signals: [signalKey],
    });

    expect(result.ok).toBe(true);
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.signalsJson ?? '').toContain(signalKey);
  });

  it('drops a positive-looking key that is not in this vertical’s taxonomy', async () => {
    const { clientId, token } = await restaurant();
    const result = await submit(token, {
      stars: 5,
      dimensions: { food: 5 },
      signals: ['not_a_real_positive_key'],
    });
    expect(result.ok).toBe(true);
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.signalsJson ?? '').not.toContain('not_a_real_positive_key');
  });

  it('supports a mixed submission: loved one part, flagged another', async () => {
    // The point of rating each part independently — a 5-star dish and a
    // 2-star wait are both true at once, and both have to survive the trip.
    const pack = getPackOrFallback('restaurant');
    const food = pack.gateway!.dimensions.find((d) => d.key === 'food')!;
    const waiting = pack.gateway!.dimensions.find((d) => d.key === 'waiting')!;
    const lovedTag = food.positiveSignals[0]!.key;
    const issueTag = waiting.signals[0]!.key;

    const { clientId, token } = await restaurant();
    const result = await submit(token, {
      stars: 4,
      dimensions: { food: 5, waiting: 2 },
      signals: [lovedTag, issueTag],
    });

    expect(result.ok).toBe(true);
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.signalsJson ?? '').toContain(lovedTag);
    expect(row.signalsJson ?? '').toContain(issueTag);
  });

  it('every vertical pack carries positive specifics for every dimension it asks about', () => {
    // Content coverage, not behaviour: a dimension with an empty
    // positiveSignals list would show a love/like headline with nothing
    // underneath it to tap.
    for (const pack of listPacks()) {
      for (const dimension of pack.gateway?.dimensions ?? []) {
        expect(
          dimension.positiveSignals.length,
          `${pack.id}/${dimension.key} has no positive specifics`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Nothing that protected the customer was traded away
// ---------------------------------------------------------------------------

describe('the existing protections are untouched', () => {
  it('introduces no review gating: the public offer does not depend on the rating', () => {
    // Every customer is asked the same question in the same words, and the
    // page that asks it never sees what they rated.
    expect(copy).toContain('shareQuestion:');
    expect(copy).toContain('Whatever you wrote here stays private.');
    expect(copy).toContain(
      'Nothing in this module reads the feedback, the rating or anything about',
    );
    // No branch anywhere in the copy layer keys the share offer off a score.
    expect(copy).not.toMatch(/shareQuestion[^\n]*stars/);
  });

  it('still refuses a submission that says nothing at all', async () => {
    const { token } = await restaurant();
    const result = await submit(token, { stars: null, text: '' });
    expect(result.ok).toBe(false);
  });

  it('still drops a signal key that is not in this vertical’s taxonomy', async () => {
    // The chips are now offered more widely, so the guard that keeps invented
    // keys out of the counts matters more, not less.
    const { clientId, token } = await restaurant();
    const result = await submit(token, {
      stars: 5,
      text: '',
      website: '',
      signals: ['not_a_real_signal_key'],
    });
    expect(result.ok).toBe(true);
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.signalsJson ?? '').not.toContain('not_a_real_signal_key');
  });

  it('still catches the honeypot, whatever the rating', async () => {
    const { clientId, token } = await restaurant();
    const result = await submit(token, {
      stars: 5,
      text: 'lovely',
      website: 'http://spam.example',
    });
    // Accepted to the robot's face, stored for nobody.
    expect(result.ok).toBe(true);
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(0);
  });

  it('still keeps the honeypot field in the form', () => {
    expect(form).toContain("name=\"website\"");
    expect(form).toContain('aria-hidden');
  });
});
