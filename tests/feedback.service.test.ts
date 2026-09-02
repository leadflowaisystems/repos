import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import {
  FEEDBACK_SOURCES,
  createFeedbackItem,
  deleteFeedbackItem,
  getFeedbackItem,
  getFeedbackStats,
  importFeedbackBatch,
  listClientFeedback,
  sourceLabel,
} from '@/lib/feedback/service';
import {
  fingerprintFeedback,
  normaliseForFingerprint,
} from '@/lib/feedback/fingerprint';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('feedback-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const REF = new Date('2026-03-15T00:00:00.000Z');

async function makeClient(businessName = 'Sunrise Clinic', vertical = 'clinic') {
  const result = await createClient(
    db,
    validClientInput({ businessName, vertical }),
  );
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.id;
}

function batch(raw: string, source = 'PUBLIC_REVIEW') {
  return { raw, source, referenceDate: REF };
}

async function importOk(clientId: string, raw: string, source = 'PUBLIC_REVIEW') {
  const result = await importFeedbackBatch(db, clientId, batch(raw, source));
  if (!result.ok) throw new Error(`import failed: ${result.message}`);
  return result.data;
}

// ---------------------------------------------------------------------------

describe('fingerprinting', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(normaliseForFingerprint('Very good service!')).toBe('very good service');
    expect(normaliseForFingerprint('  VERY   good,  service.  ')).toBe(
      'very good service',
    );
    expect(fingerprintFeedback('Very good service!')).toBe(
      fingerprintFeedback('very good   service'),
    );
  });

  it('keeps genuinely different text distinct — this is not fuzzy matching', () => {
    expect(fingerprintFeedback('Very good service')).not.toBe(
      fingerprintFeedback('Very good staff'),
    );
    expect(fingerprintFeedback('Good')).not.toBe(fingerprintFeedback('Good service'));
  });

  it('preserves non-Latin scripts', () => {
    expect(normaliseForFingerprint('डॉक्टर छान आहेत!')).toBe('डॉक्टर छान आहेत');
    expect(fingerprintFeedback('डॉक्टर छान आहेत')).not.toBe(
      fingerprintFeedback('डॉक्टर वाईट आहेत'),
    );
  });

  it('is stable and deterministic', () => {
    const a = fingerprintFeedback('Excellent service, very clean');
    const b = fingerprintFeedback('Excellent service, very clean');
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it('returns an empty fingerprint for text with no content', () => {
    expect(fingerprintFeedback('   ')).toBe('');
    expect(fingerprintFeedback('!!!')).toBe('');
  });
});

// ---------------------------------------------------------------------------

describe('batch import — supported paste formats', () => {
  it('reads "5 stars" on its own line above the review', async () => {
    const clientId = await makeClient();
    const result = await importOk(
      clientId,
      [
        '5 stars',
        '"Very good service. Staff were polite and the clinic was clean."',
        '',
        '4 stars',
        '"Good experience but had to wait past my appointment time."',
      ].join('\n'),
    );

    expect(result.imported).toBe(2);
    const rows = await listClientFeedback(db, clientId);
    expect(rows.map((r) => r.stars).sort()).toEqual([4, 5]);
    // Wrapping quotes are formatting, not content.
    expect(rows.every((r) => !r.text.startsWith('"'))).toBe(true);
    expect(rows.some((r) => r.text.includes('Staff were polite'))).toBe(true);
  });

  it('reads inline star glyphs, one quoted review per line', async () => {
    const clientId = await makeClient();
    const result = await importOk(
      clientId,
      [
        '"★★★★★ Excellent service, the doctor explained everything."',
        '"★★★☆☆ Long waiting time but treatment was fine."',
        '"★☆☆☆☆ Reception was rude and we waited an hour."',
      ].join('\n'),
    );

    expect(result.imported).toBe(3);
    const rows = await listClientFeedback(db, clientId);
    expect(rows.map((r) => r.stars).sort()).toEqual([1, 3, 5]);
    expect(rows.every((r) => !r.text.includes('★'))).toBe(true);
  });

  it('reads blank-line separated blocks', async () => {
    const clientId = await makeClient();
    const result = await importOk(
      clientId,
      'First review about the clinic being clean.\n\nSecond review about a long wait.\n\nThird review praising the doctor.',
    );
    expect(result.imported).toBe(3);
  });

  it('reads --- separated blocks', async () => {
    const clientId = await makeClient();
    const result = await importOk(
      clientId,
      'Great experience overall\n---\nWaited far too long today\n---\nStaff were helpful',
    );
    expect(result.imported).toBe(3);
  });

  it('reads plain one-per-line with no ratings at all', async () => {
    const clientId = await makeClient();
    const result = await importOk(
      clientId,
      'Clean and quick\nRude reception staff\nDoctor was very kind',
    );
    expect(result.imported).toBe(3);
    expect(result.withRating).toBe(0);
    const rows = await listClientFeedback(db, clientId);
    // A rating is never invented when the paste does not contain one.
    expect(rows.every((r) => r.stars === null)).toBe(true);
  });

  it('extracts ratings written several ways', async () => {
    const clientId = await makeClient();
    await importOk(
      clientId,
      [
        '5 stars - excellent doctor and very clean',
        'Rating: 2 the wait was far too long today',
        '4/5 quick and professional service',
        '★★★ average experience nothing special',
      ].join('\n'),
    );
    const rows = await listClientFeedback(db, clientId);
    expect(rows.map((r) => r.stars).sort()).toEqual([2, 3, 4, 5]);
  });

  it('extracts dates when present and never invents them', async () => {
    const clientId = await makeClient();
    await importOk(
      clientId,
      [
        '2 weeks ago the clinic was spotless and staff helpful',
        '2026-01-05 rude reception on arrival',
        'No date on this one but the doctor was excellent',
      ].join('\n'),
    );

    const rows = await listClientFeedback(db, clientId);
    const dated = rows.filter((r) => r.reviewDate !== null);
    expect(dated).toHaveLength(2);
    expect(
      dated.map((r) => r.reviewDate?.toISOString().slice(0, 10)).sort(),
    ).toEqual(['2026-01-05', '2026-03-01']);
  });

  it('is deterministic — the same paste imports identically', async () => {
    const raw = '5 stars a month ago great service\n\n1 star 3 days ago terrible wait';
    const a = await makeClient('Clinic A', 'clinic');
    const b = await makeClient('Clinic B', 'clinic');

    const first = await importOk(a, raw);
    const second = await importOk(b, raw);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));

    const rowsA = (await listClientFeedback(db, a)).map((r) => [r.text, r.stars]);
    const rowsB = (await listClientFeedback(db, b)).map((r) => [r.text, r.stars]);
    expect(rowsB).toEqual(rowsA);
  });
});

describe('batch import — multilingual text', () => {
  it('preserves Hindi, Marathi and Hinglish exactly', async () => {
    const clientId = await makeClient();
    await importOk(
      clientId,
      [
        'डॉक्टर छान आहेत पण खूप उशीर झाला',
        'बहुत अच्छा अनुभव था और स्टाफ अच्छा है',
        'Staff bahut accha hai lekin waiting thoda zyada tha',
      ].join('\n'),
    );

    const texts = (await listClientFeedback(db, clientId)).map((r) => r.text);
    expect(texts).toContain('डॉक्टर छान आहेत पण खूप उशीर झाला');
    expect(texts).toContain('बहुत अच्छा अनुभव था और स्टाफ अच्छा है');
    expect(texts).toContain('Staff bahut accha hai lekin waiting thoda zyada tha');
  });

  it('leaves language unset — that is the analysis layer, not intake', async () => {
    const clientId = await makeClient();
    await importOk(clientId, 'डॉक्टर छान आहेत');

    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.language).toBeNull();
    expect(row.sentiment).toBe('UNCLASSIFIED');
    expect(row.classifiedBy).toBe('NONE');
    expect(row.analysedAt).toBeNull();
    expect(row.issueTags).toBe('[]');
    expect(row.praiseTags).toBe('[]');
  });
});

describe('batch import — PII minimisation', () => {
  it('strips phone numbers and email addresses before storage', async () => {
    const clientId = await makeClient();
    const result = await importOk(
      clientId,
      'Call me on 9876543210 or write to test.person@example.com, the wait was far too long',
    );

    expect(result.redacted).toBe(1);
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.text).not.toContain('9876543210');
    expect(row.text).not.toContain('test.person@example.com');
    expect(row.redacted).toBe(true);
    // The complaint itself survives, so analysis still has something to read.
    expect(row.text).toContain('wait was far too long');
  });

  it('strips a leading reviewer name line', async () => {
    const clientId = await makeClient();
    await importOk(clientId, 'Rahul Sharma\n5 stars\nDoctor explained everything well');

    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.text).not.toContain('Rahul');
    expect(row.text).toContain('Doctor explained everything well');
    expect(row.stars).toBe(5);
  });

  it('strips address-like details', async () => {
    const clientId = await makeClient();
    await importOk(
      clientId,
      'I live at Flat 402, 12 MG Road, pincode 411038 and the clinic was very clean',
    );

    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.text).not.toContain('402');
    expect(row.text).not.toContain('411038');
    expect(row.text.toLowerCase()).not.toContain('mg road');
    expect(row.text).toContain('clinic was very clean');
  });

  it('strips booking and order references', async () => {
    const clientId = await makeClient();
    await importOk(clientId, 'My booking id 4471XZ was cancelled without any warning');

    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.text).not.toContain('4471XZ');
    expect(row.text).toContain('cancelled without any warning');
  });

  it('does NOT over-redact ordinary business language', async () => {
    const clientId = await makeClient();
    const originals = [
      'The bill was too high for what we received',
      'The shop was clean and there was room for everyone',
      'Waited 45 minutes past my appointment time',
      'Rated 5 stars because the doctor listened properly',
    ];
    await importOk(clientId, originals.join('\n'));

    const rows = await db.reviewItem.findMany({ where: { clientId } });
    const stored = rows.map((r) => r.text);

    expect(stored).toContain('The bill was too high for what we received');
    expect(stored).toContain('The shop was clean and there was room for everyone');
    expect(stored.some((t) => t.includes('45 minutes'))).toBe(true);
    expect(rows.filter((r) => r.redacted)).toHaveLength(0);
  });

  it('reports which categories were removed', async () => {
    const clientId = await makeClient();
    const result = await importOk(
      clientId,
      'Reach me at someone@example.com about my long wait',
    );
    expect(result.redactionCategories).toContain('email address');
  });
});

describe('batch import — duplicates', () => {
  it('skips duplicates inside a single paste and reports the count', async () => {
    const clientId = await makeClient();
    const result = await importOk(
      clientId,
      [
        'Excellent service and very clean clinic',
        'Long waiting time at reception today',
        'Excellent service and very clean clinic',
      ].join('\n'),
    );

    expect(result.imported).toBe(2);
    expect(result.skippedDuplicates).toBe(1);
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(2);
  });

  it('skips duplicates against what the client already holds', async () => {
    const clientId = await makeClient();
    await importOk(clientId, 'Excellent service and very clean clinic');

    const second = await importOk(
      clientId,
      'Excellent service and very clean clinic\nBrand new feedback about parking',
    );
    expect(second.imported).toBe(1);
    expect(second.skippedDuplicates).toBe(1);
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(2);
  });

  it('treats punctuation and case differences as the same review', async () => {
    const clientId = await makeClient();
    await importOk(clientId, 'Excellent service!');
    const second = await importOk(clientId, 'excellent service');
    expect(second.skippedDuplicates).toBe(1);
  });

  it('does NOT treat different reviews as duplicates', async () => {
    const clientId = await makeClient();
    const result = await importOk(
      clientId,
      'Excellent service\nExcellent staff\nExcellent doctor',
    );
    expect(result.imported).toBe(3);
    expect(result.skippedDuplicates).toBe(0);
  });

  it('allows the same text under two different clients', async () => {
    const a = await makeClient('Clinic A', 'clinic');
    const b = await makeClient('Clinic B', 'clinic');
    await importOk(a, 'Excellent service and very clean');
    const second = await importOk(b, 'Excellent service and very clean');

    expect(second.imported).toBe(1);
    expect(second.skippedDuplicates).toBe(0);
  });

  it('makes re-pasting the same batch a no-op', async () => {
    const clientId = await makeClient();
    const raw = 'One review here\nAnother review here\nA third review';
    const first = await importOk(clientId, raw);
    const again = await importOk(clientId, raw);

    expect(first.imported).toBe(3);
    expect(again.imported).toBe(0);
    expect(again.skippedDuplicates).toBe(3);
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(3);
  });
});

describe('batch import — invalid input', () => {
  it('rejects an empty paste', async () => {
    const clientId = await makeClient();
    const result = await importFeedbackBatch(db, clientId, batch(''));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.raw).toContain('Paste some feedback');
  });

  it('rejects a paste with nothing readable in it', async () => {
    const clientId = await makeClient();
    const result = await importFeedbackBatch(db, clientId, batch('!!!  ***  ...'));
    expect(result.ok).toBe(false);
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(0);
  });

  it('rejects an unknown source', async () => {
    const clientId = await makeClient();
    const result = await importFeedbackBatch(
      db,
      clientId,
      batch('Good service', 'GOOGLE'),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.source).toContain('where this came from');
  });

  it('rejects an unknown client instead of throwing', async () => {
    const result = await importFeedbackBatch(db, 'nope', batch('Good service'));
    expect(result.ok).toBe(false);
  });

  it('rejects junk input without throwing', async () => {
    const clientId = await makeClient();
    for (const raw of [null, undefined, 'text', 42, [], {}]) {
      expect((await importFeedbackBatch(db, clientId, raw)).ok, String(raw)).toBe(
        false,
      );
    }
  });
});

// ---------------------------------------------------------------------------

describe('single item entry', () => {
  it('stores one item with everything supplied', async () => {
    const clientId = await makeClient();
    const result = await createFeedbackItem(db, clientId, {
      text: 'Owner told me in person that the wait was unacceptable',
      stars: 2,
      reviewDate: new Date('2026-03-01T00:00:00.000Z'),
      source: 'PRIVATE_FEEDBACK',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await db.reviewItem.findUniqueOrThrow({ where: { id: result.data.id } });
    expect(row.clientId).toBe(clientId);
    expect(row.snapshotId).toBeNull();
    expect(row.stars).toBe(2);
    expect(row.source).toBe('PRIVATE_FEEDBACK');
  });

  it('accepts an item with no rating and no date', async () => {
    const clientId = await makeClient();
    const result = await createFeedbackItem(db, clientId, {
      text: 'Customer mentioned parking is difficult',
      stars: null,
      reviewDate: null,
      source: 'MANUAL_ENTRY',
    });
    expect(result.ok).toBe(true);
  });

  it('redacts PII on a single item too', async () => {
    const clientId = await makeClient();
    const result = await createFeedbackItem(db, clientId, {
      text: 'Ring me on 9876543210, the service was slow',
      stars: null,
      reviewDate: null,
      source: 'MANUAL_ENTRY',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.redacted).toBe(true);

    const row = await db.reviewItem.findUniqueOrThrow({ where: { id: result.data.id } });
    expect(row.text).not.toContain('9876543210');
  });

  it('rejects an out-of-range rating', async () => {
    const clientId = await makeClient();
    const result = await createFeedbackItem(db, clientId, {
      text: 'Good service',
      stars: 9,
      reviewDate: null,
      source: 'MANUAL_ENTRY',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.stars).toContain('between 1 and 5');
  });

  it('rejects empty text', async () => {
    const clientId = await makeClient();
    const result = await createFeedbackItem(db, clientId, {
      text: '',
      stars: null,
      reviewDate: null,
      source: 'MANUAL_ENTRY',
    });
    expect(result.ok).toBe(false);
  });

  it('refuses an exact duplicate and says so', async () => {
    const clientId = await makeClient();
    const input = {
      text: 'The clinic was spotless today',
      stars: 5,
      reviewDate: null,
      source: 'MANUAL_ENTRY',
    };
    expect((await createFeedbackItem(db, clientId, input)).ok).toBe(true);

    const again = await createFeedbackItem(db, clientId, input);
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.message).toContain('already has that exact feedback');
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe('sources', () => {
  it('offers generic sources with no platform privileged', () => {
    expect(FEEDBACK_SOURCES).toEqual([
      'PUBLIC_REVIEW',
      'PRIVATE_FEEDBACK',
      'MANUAL_ENTRY',
      'OTHER',
    ]);
    expect(FEEDBACK_SOURCES.join(' ').toLowerCase()).not.toContain('google');
    for (const source of FEEDBACK_SOURCES) {
      expect(sourceLabel(source)).not.toBe(source);
    }
  });

  it('records the source on every imported item', async () => {
    const clientId = await makeClient();
    await importOk(clientId, 'Told us at the counter it was slow', 'PRIVATE_FEEDBACK');
    const rows = await listClientFeedback(db, clientId);
    expect(rows[0]?.source).toBe('PRIVATE_FEEDBACK');
    expect(rows[0]?.sourceLabel).toBe('Private feedback');
  });
});

describe('listing and filtering', () => {
  async function seed(clientId: string) {
    await importOk(
      clientId,
      [
        '5 stars 2026-03-10 excellent and very clean',
        '1 star 2026-02-10 rude reception and long wait',
        '3 stars 2026-01-10 average visit nothing special',
      ].join('\n'),
    );
    await createFeedbackItem(db, clientId, {
      text: 'Owner passed on a complaint about parking',
      stars: null,
      reviewDate: new Date('2026-03-12T00:00:00.000Z'),
      source: 'PRIVATE_FEEDBACK',
    });
  }

  it('returns an empty list for a client with no feedback', async () => {
    expect(await listClientFeedback(db, await makeClient())).toEqual([]);
  });

  it('lists newest first', async () => {
    const clientId = await makeClient();
    await seed(clientId);
    const rows = await listClientFeedback(db, clientId);
    expect(rows[0]?.reviewDate?.toISOString().slice(0, 10)).toBe('2026-03-12');
  });

  it('filters by rating', async () => {
    const clientId = await makeClient();
    await seed(clientId);
    const rows = await listClientFeedback(db, clientId, { stars: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toContain('rude reception');
  });

  it('filters by source', async () => {
    const clientId = await makeClient();
    await seed(clientId);
    const rows = await listClientFeedback(db, clientId, { source: 'PRIVATE_FEEDBACK' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toContain('parking');
  });

  it('filters by date range', async () => {
    const clientId = await makeClient();
    await seed(clientId);
    const rows = await listClientFeedback(db, clientId, {
      from: new Date('2026-02-01T00:00:00.000Z'),
      to: new Date('2026-03-11T00:00:00.000Z'),
    });
    expect(rows).toHaveLength(2);
  });

  it('filters by analysed state', async () => {
    const clientId = await makeClient();
    await seed(clientId);
    expect(await listClientFeedback(db, clientId, { analysed: true })).toHaveLength(0);
    expect(await listClientFeedback(db, clientId, { analysed: false })).toHaveLength(4);
  });

  it('provides a short preview without dropping the full text', async () => {
    const clientId = await makeClient();
    const long = `The clinic was clean ${'and the staff were helpful '.repeat(20)}`;
    await importOk(clientId, long);

    const row = (await listClientFeedback(db, clientId))[0];
    expect(row?.preview.length).toBeLessThanOrEqual(151);
    expect(row?.preview.endsWith('…')).toBe(true);
    expect(row?.text.length).toBeGreaterThan(200);
  });
});

describe('stats', () => {
  it('is all zeroes for a client with no feedback', async () => {
    const stats = await getFeedbackStats(db, await makeClient());
    expect(stats.total).toBe(0);
    expect(stats.averageRating).toBeNull();
    expect(stats.newestAt).toBeNull();
  });

  it('counts totals, ratings and redactions deterministically', async () => {
    const clientId = await makeClient();
    await importOk(
      clientId,
      [
        '5 stars very clean and quick',
        '5 stars doctor was excellent',
        '1 star rude staff and long wait',
        'No rating on this one about parking',
      ].join('\n'),
    );

    const stats = await getFeedbackStats(db, clientId);
    expect(stats.total).toBe(4);
    expect(stats.withRating).toBe(3);
    expect(stats.ratingCounts['5']).toBe(2);
    expect(stats.ratingCounts['1']).toBe(1);
    expect(stats.averageRating).toBeCloseTo(3.67, 2);
    expect(stats.unanalysed).toBe(4);
    expect(stats.analysed).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('client isolation', () => {
  it('never shows one client feedback under another', async () => {
    const a = await makeClient('Sunrise Clinic', 'clinic');
    const b = await makeClient('Glow Salon', 'salon');

    await importOk(a, 'Clinic feedback about the doctor');
    await importOk(b, 'Salon feedback about the haircut');

    const forA = await listClientFeedback(db, a);
    const forB = await listClientFeedback(db, b);

    expect(forA.map((r) => r.text)).toEqual(['Clinic feedback about the doctor']);
    expect(forB.map((r) => r.text)).toEqual(['Salon feedback about the haircut']);
    expect(forA.every((r) => r.clientId === a)).toBe(true);
  });

  it('cannot fetch another client feedback item by id', async () => {
    const a = await makeClient('Sunrise Clinic', 'clinic');
    const b = await makeClient('Glow Salon', 'salon');
    await importOk(a, 'Only for the clinic');

    const item = (await listClientFeedback(db, a))[0];
    expect(item).toBeDefined();
    expect(await getFeedbackItem(db, a, item?.id as string)).not.toBeNull();
    expect(await getFeedbackItem(db, b, item?.id as string)).toBeNull();
  });

  it('cannot delete another client feedback item', async () => {
    const a = await makeClient('Sunrise Clinic', 'clinic');
    const b = await makeClient('Glow Salon', 'salon');
    await importOk(a, 'Only for the clinic');
    const item = (await listClientFeedback(db, a))[0];

    expect((await deleteFeedbackItem(db, b, item?.id as string)).ok).toBe(false);
    expect(await db.reviewItem.count()).toBe(1);

    expect((await deleteFeedbackItem(db, a, item?.id as string)).ok).toBe(true);
    expect(await db.reviewItem.count()).toBe(0);
  });

  it('keeps stats scoped to one client', async () => {
    const a = await makeClient('Sunrise Clinic', 'clinic');
    const b = await makeClient('Glow Salon', 'salon');
    await importOk(a, '5 stars one\n5 stars two');
    await importOk(b, '1 star three');

    expect((await getFeedbackStats(db, a)).total).toBe(2);
    expect((await getFeedbackStats(db, b)).total).toBe(1);
  });

  it('removes feedback when its client is deleted', async () => {
    const clientId = await makeClient();
    await importOk(clientId, 'Some feedback here');
    expect(await db.reviewItem.count()).toBe(1);

    await db.client.delete({ where: { id: clientId } });
    expect(await db.reviewItem.count()).toBe(0);
  });
});

describe('persistence', () => {
  it('survives a fresh read with every field intact', async () => {
    const clientId = await makeClient();
    await importOk(
      clientId,
      '5 stars 2026-02-14 Doctor explained everything and the clinic was clean',
    );

    const rows = await listClientFeedback(db, clientId);
    const again = await listClientFeedback(db, clientId);
    expect(JSON.stringify(again)).toBe(JSON.stringify(rows));

    const row = rows[0];
    expect(row?.stars).toBe(5);
    expect(row?.reviewDate?.toISOString().slice(0, 10)).toBe('2026-02-14');
    expect(row?.source).toBe('PUBLIC_REVIEW');
    expect(row?.analysed).toBe(false);
  });

  it('keeps intake items unattached to any snapshot', async () => {
    const clientId = await makeClient();
    await importOk(clientId, 'Feedback that came in outside a snapshot');
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.snapshotId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Multiline reconstruction, end to end
// ---------------------------------------------------------------------------

describe('multiline reviews survive intake intact', () => {
  const SPEC_EXAMPLE = [
    '5 stars',
    'The staff were very helpful and polite.',
    'The whole experience was smooth and comfortable.',
    '',
    '4 stars',
    'Good service, but I had to wait longer than expected.',
    '',
    '5 stars',
    'Very clean place and excellent service.',
  ].join('\n');

  it('imports exactly three items, with the wrapped one kept whole', async () => {
    const clientId = await makeClient();
    const result = await importOk(clientId, SPEC_EXAMPLE);

    expect(result.imported).toBe(3);
    expect(result.skippedDuplicates).toBe(0);

    const rows = await listClientFeedback(db, clientId);
    expect(rows).toHaveLength(3);

    const wrapped = rows.find((r) => r.text.includes('The staff were very helpful'));
    expect(wrapped?.text).toContain('The whole experience was smooth and comfortable.');
    expect(wrapped?.stars).toBe(5);
  });

  it('fingerprints from the reconstructed text, so a re-paste is a duplicate', async () => {
    const clientId = await makeClient();
    await importOk(clientId, SPEC_EXAMPLE);

    const again = await importOk(clientId, SPEC_EXAMPLE);
    expect(again.imported).toBe(0);
    expect(again.skippedDuplicates).toBe(3);
    expect(await db.reviewItem.count({ where: { clientId } })).toBe(3);
  });

  it('treats the same wrapped review as a duplicate however it is re-wrapped', async () => {
    const clientId = await makeClient();
    await importOk(clientId, SPEC_EXAMPLE);

    // Same review, same words, different physical line break.
    const rewrapped = [
      '5 stars',
      'The staff were very helpful and polite. The whole experience was smooth and comfortable.',
    ].join('\n');

    const result = await importOk(clientId, rewrapped);
    expect(result.imported).toBe(0);
    expect(result.skippedDuplicates).toBe(1);
  });

  it('redacts PII spread across the lines of one wrapped review', async () => {
    const clientId = await makeClient();
    await importOk(
      clientId,
      [
        '2 stars',
        'Nobody warned me about the delay.',
        'Call me on 9876543210 or email test.person@example.com to discuss.',
        'I live at Flat 402, 12 MG Road.',
      ].join('\n'),
    );

    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId } });
    expect(row.redacted).toBe(true);
    expect(row.text).not.toContain('9876543210');
    expect(row.text).not.toContain('test.person@example.com');
    expect(row.text).not.toContain('402');
    expect(row.text.toLowerCase()).not.toContain('mg road');
    // The complaint itself is still there for the analysis layer to read.
    expect(row.text).toContain('Nobody warned me about the delay.');
  });

  it('keeps multiline reconstruction scoped to one client', async () => {
    const a = await makeClient('Clinic A', 'clinic');
    const b = await makeClient('Clinic B', 'clinic');

    await importOk(a, SPEC_EXAMPLE);
    const forB = await listClientFeedback(db, b);
    expect(forB).toEqual([]);

    // The identical batch is brand new for a different client.
    const result = await importOk(b, SPEC_EXAMPLE);
    expect(result.imported).toBe(3);
    expect(result.skippedDuplicates).toBe(0);
  });

  it('counts a mixed multiline and one-line batch correctly', async () => {
    const clientId = await makeClient();
    const result = await importOk(
      clientId,
      [
        '5 stars',
        'Wrapped review, first line.',
        'Wrapped review, second line.',
        '',
        '"★★☆☆☆ A separate quoted review."',
        '"★★★★★ Another separate quoted review."',
        '',
        '3 stars',
        'A third review on one line.',
      ].join('\n'),
    );

    expect(result.imported).toBe(4);
    const rows = await listClientFeedback(db, clientId);
    expect(rows.map((r) => r.stars).sort()).toEqual([2, 3, 5, 5]);
  });

  it('imports a multiline Marathi review as one item', async () => {
    const clientId = await makeClient();
    const result = await importOk(
      clientId,
      [
        '5 stars',
        'डॉक्टर खूप छान आहेत आणि सर्व काही समजावून सांगितले.',
        'स्टाफ पण मदत करणारा होता.',
        '',
        'Separate English review about parking.',
      ].join('\n'),
    );

    expect(result.imported).toBe(2);
    const rows = await listClientFeedback(db, clientId);
    const marathi = rows.find((r) => r.text.includes('डॉक्टर'));
    expect(marathi?.text).toContain('स्टाफ पण मदत करणारा होता.');
    expect(marathi?.stars).toBe(5);
  });
});
