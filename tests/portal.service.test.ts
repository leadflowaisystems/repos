import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import { importFeedbackBatch } from '@/lib/feedback/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { createMinute } from '@/lib/minutes/service';
import {
  getAnalysisView,
  getCheckinView,
  getImprovementsView,
  getPortalView,
  getReviewsView,
} from '@/lib/portal/service';
import type { ReviewFilters } from '@/lib/portal/pages';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/** The reviews page with nothing selected. */
function filters(overrides: Partial<ReviewFilters> = {}): ReviewFilters {
  return { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null, ...overrides };
}

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('portal-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const REF = new Date('2026-03-15T00:00:00.000Z');
const NOW = new Date('2026-06-01T00:00:00.000Z');

async function makeClient(businessName: string, vertical = 'clinic') {
  const result = await createClient(db, validClientInput({ businessName, vertical }));
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.id;
}

async function addFeedback(clientId: string, raw: string) {
  const imported = await importFeedbackBatch(db, clientId, {
    raw,
    source: 'PUBLIC_REVIEW',
    referenceDate: REF,
  });
  if (!imported.ok) throw new Error(`import failed: ${imported.message}`);
  const analysed = await analyseClientFeedback(db, clientId, { useAi: false, now: NOW });
  if (!analysed.ok) throw new Error('analysis failed');
}

function clinicBatch(tag: string): string {
  const lines: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    lines.push(`1 star Waited over an hour past my appointment time (${tag}${i})`);
  }
  for (let i = 0; i < 14; i += 1) {
    lines.push(`5 stars The doctor explained everything clearly (${tag}${i})`);
  }
  return lines.join('\n');
}

function salonBatch(): string {
  const lines: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    lines.push(`1 star The haircut was not what I asked for at all (${i})`);
  }
  for (let i = 0; i < 12; i += 1) {
    lines.push(`5 stars The stylist was friendly and the salon was spotless (${i})`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------

describe('the portal shows one business and only that business', () => {
  it('never mentions another client anywhere in the view', async () => {
    const clinic = await makeClient('Sunrise Dental Clinic', 'clinic');
    const salon = await makeClient('Glow Salon & Spa', 'salon');
    await addFeedback(clinic, clinicBatch('c'));
    await addFeedback(salon, salonBatch());

    const bundle = await getPortalView(db, clinic, { now: NOW });
    if (!bundle) throw new Error('no portal view');

    const serialised = JSON.stringify(bundle.view);
    expect(bundle.view.businessName).toBe('Sunrise Dental Clinic');
    expect(serialised).not.toContain('Glow Salon');
    // The salon's own themes must not appear on the clinic's page.
    expect(serialised).not.toMatch(/stylist|haircut/i);
  });

  it('counts only this client\'s feedback', async () => {
    const clinic = await makeClient('Sunrise Dental Clinic', 'clinic');
    await addFeedback(clinic, clinicBatch('c'));
    const before = await getPortalView(db, clinic, { now: NOW });

    const other = await makeClient('Second Clinic', 'clinic');
    await addFeedback(other, clinicBatch('o'));
    const after = await getPortalView(db, clinic, { now: NOW });

    expect(after?.view.basedOn).toBe(before?.view.basedOn);
    expect(after?.view).toEqual(before?.view);
  });

  it('returns nothing for a client that does not exist', async () => {
    expect(await getPortalView(db, 'nope', { now: NOW })).toBeNull();
  });

  it('never serves one client\'s evidence through another client\'s id', async () => {
    const clinic = await makeClient('Sunrise Dental Clinic', 'clinic');
    const salon = await makeClient('Glow Salon & Spa', 'salon');
    await addFeedback(clinic, clinicBatch('c'));
    await addFeedback(salon, salonBatch());

    // A theme that exists only in the clinic pack is not a salon theme: the
    // filter is dropped rather than applied, and the page says so.
    const foreign = await getReviewsView(db, salon, filters({ theme: 'consultation_rush' }));
    expect(foreign?.filters.theme).toBeNull();
    expect(foreign?.filterSummary).toBeNull();
    expect(JSON.stringify(foreign)).not.toMatch(/Sunrise|appointment time/i);

    // A theme key both packs happen to share resolves within the SALON's own
    // feedback and carries none of the clinic's. This is the isolation that
    // matters: the key is shared, the evidence never is.
    const shared = await getReviewsView(db, salon, filters({ theme: 'wait_time' }));
    expect(shared?.businessName).toBe('Glow Salon & Spa');
    expect(shared?.items).toEqual([]);

    const own = await getReviewsView(db, clinic, filters({ theme: 'wait_time' }));
    expect(own?.items.length).toBeGreaterThan(0);
    const ids = own?.items.map((i) => i.id) ?? [];
    const rows = await db.reviewItem.findMany({
      where: { id: { in: ids } },
      select: { clientId: true },
    });
    expect(rows.every((r) => r.clientId === clinic)).toBe(true);
  });

  it('drops a theme filter that is not in the client\'s own vertical', async () => {
    const clinic = await makeClient('Sunrise Dental Clinic', 'clinic');
    await addFeedback(clinic, clinicBatch('c'));
    const all = await getReviewsView(db, clinic, filters());
    for (const theme of ['stylist_skill', 'made_up_key']) {
      const v = await getReviewsView(db, clinic, filters({ theme }));
      expect(v?.filters.theme).toBeNull();
      expect(v?.shown).toBe(all?.shown);
    }
  });

  it('keeps every deeper page on the same client', async () => {
    const clinic = await makeClient('Sunrise Dental Clinic', 'clinic');
    const salon = await makeClient('Glow Salon & Spa', 'salon');
    await addFeedback(clinic, clinicBatch('c'));
    await addFeedback(salon, salonBatch());

    const pages = [
      await getAnalysisView(db, clinic, { now: NOW }),
      await getImprovementsView(db, clinic, { now: NOW }),
      await getCheckinView(db, clinic, { now: NOW }),
      await getReviewsView(db, clinic, filters()),
    ];
    for (const page of pages) {
      expect(page?.businessName).toBe('Sunrise Dental Clinic');
      expect(JSON.stringify(page)).not.toMatch(/Glow Salon|stylist|haircut/i);
    }
    expect(await getReviewsView(db, 'nope', filters())).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('operator-only material never reaches the portal', () => {
  it('does not carry Minutes into the owner view', async () => {
    const clinic = await makeClient('Sunrise Dental Clinic', 'clinic');
    await addFeedback(clinic, clinicBatch('c'));
    const minute = await createMinute(db, clinic, {
      occurredAt: new Date('2026-05-01T00:00:00.000Z'),
      category: 'DECISION',
      title: 'Internal note about the owner being difficult',
      body: 'Operator-only context that must never be shown to the client.',
    });
    if (!minute.ok) throw new Error('minute failed');

    const bundle = await getPortalView(db, clinic, { now: NOW });
    const serialised = JSON.stringify(bundle?.view);
    expect(serialised).not.toContain('Operator-only context');
    expect(serialised).not.toContain('being difficult');
  });

  it('shows a review as the owner may see it and nothing more', async () => {
    const clinic = await makeClient('Sunrise Dental Clinic', 'clinic');
    await addFeedback(clinic, clinicBatch('c'));

    const view = await getReviewsView(db, clinic, filters({ theme: 'wait_time' }));
    const item = view?.items[0];
    expect(item).toBeDefined();
    // The owner-facing shape, exactly. Triage reasons, priority ranks, draft
    // internals and redaction details are not in it.
    expect(Object.keys(item ?? {}).sort()).toEqual([
      'at',
      'classLabel',
      'id',
      'replyState',
      'sentiment',
      'sentimentLabel',
      'sourceLabel',
      'stars',
      'suggestedReply',
      'text',
      'themes',
    ]);
    expect(JSON.stringify(view)).not.toMatch(/priorityRank|priorityReasons|draftNotes|redactions|clientId/);
  });

  it('searches and narrows within this client only', async () => {
    const clinic = await makeClient('Sunrise Dental Clinic', 'clinic');
    await addFeedback(clinic, clinicBatch('c'));

    const all = await getReviewsView(db, clinic, filters());
    expect(all?.total).toBe(22);
    expect(all?.shown).toBe(22);
    expect(all?.ratings.find((r) => r.stars === 1)?.count).toBe(8);
    expect(all?.ratings.find((r) => r.stars === 5)?.count).toBe(14);

    const ones = await getReviewsView(db, clinic, filters({ stars: 1 }));
    expect(ones?.shown).toBe(8);
    expect(ones?.items.every((i) => i.stars === 1)).toBe(true);
    expect(ones?.filterSummary).toBe('rated 1 star');

    const search = await getReviewsView(db, clinic, filters({ q: 'explained' }));
    expect(search?.shown).toBe(14);
    expect(search?.filterSummary).toBe('mentioning "explained"');

    const none = await getReviewsView(db, clinic, filters({ q: 'haircut' }));
    expect(none?.shown).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('the portal is truthful when there is little to say', () => {
  it('shows an honest empty state for a client with no feedback', async () => {
    const id = await makeClient('FitZone Gym', 'gym');
    const bundle = await getPortalView(db, id, { now: NOW });

    expect(bundle?.view.mood).toBe('TOO_EARLY');
    expect(bundle?.view.keep).toBeNull();
    expect(bundle?.view.loved).toEqual([]);
    expect(bundle?.view.first).toBeNull();
    expect(bundle?.view.question).toBeNull();
    expect(bundle?.view.watching).toEqual([]);
    expect(bundle?.view.actions).toEqual([]);
    expect(bundle?.view.basedOn).toBe(0);
  });

  it('renders every page honestly for a client with nothing yet', async () => {
    const id = await makeClient('FitZone Gym', 'gym');
    const analysis = await getAnalysisView(db, id, { now: NOW });
    expect(analysis?.loved).toEqual([]);
    expect(analysis?.unhappy).toEqual([]);
    expect(analysis?.telling).toEqual([]);
    expect(analysis?.recurrenceNote).toMatch(/No check-in/);
    const improvements = await getImprovementsView(db, id, { now: NOW });
    expect(improvements?.record).toBe('No change has been agreed yet.');
    const checkin = await getCheckinView(db, id, { now: NOW });
    expect(checkin?.title).toBe('Your customer check-in');
    expect(checkin?.movementLine).toMatch(/two check-ins/);
    expect(checkin?.next).toEqual([]);
    const reviews = await getReviewsView(db, id, filters());
    expect(reviews?.total).toBe(0);
    expect(reviews?.found).toEqual([]);
    expect(reviews?.quick).toEqual([]);
  });

  it('counts as worth a reply only what the reply engine ranked high or handed to a person', async () => {
    const clinic = await makeClient('Sunrise Dental Clinic', 'clinic');
    await addFeedback(clinic, clinicBatch('c'));
    const all = await getReviewsView(db, clinic, filters());
    const worth = await getReviewsView(db, clinic, filters({ needs: 'reply' }));
    expect(worth?.shown).toBe(all?.replyWorth);
    expect(worth?.shown).toBeLessThan(all?.shown ?? 0);
  });

  it('does not invent a comparison without two check-ins', async () => {
    const id = await makeClient('Corner Cafe', 'restaurant');
    await addFeedback(
      id,
      Array.from({ length: 14 }, (_, i) => `5 stars The food was delicious (${i})`).join(
        '\n',
      ),
    );
    const bundle = await getPortalView(db, id, { now: NOW });
    expect(bundle?.view.changed).toEqual([]);
    expect(bundle?.view.changedNote).toMatch(/two check-ins/i);
  });

  it('works across clinic, restaurant, salon and gym', async () => {
    const cases: Array<[string, string, string]> = [
      ['Sunrise Dental Clinic', 'clinic', clinicBatch('c')],
      ['Glow Salon & Spa', 'salon', salonBatch()],
      [
        'Corner Cafe',
        'restaurant',
        Array.from(
          { length: 20 },
          (_, i) => `1 star The service was very slow, we waited ages (${i})`,
        ).join('\n'),
      ],
      [
        'FitZone Gym',
        'gym',
        Array.from(
          { length: 20 },
          (_, i) => `2 stars Far too crowded at peak hours, waiting for machine (${i})`,
        ).join('\n'),
      ],
    ];

    for (const [name, vertical, batch] of cases) {
      const id = await makeClient(name, vertical);
      await addFeedback(id, batch);
      const bundle = await getPortalView(db, id, { now: NOW });

      expect(bundle?.view.businessName).toBe(name);
      expect(bundle?.view.verticalLabel.length).toBeGreaterThan(0);
      expect(bundle?.view.verticalLabel).not.toBe(vertical);
      expect(bundle?.view.summary.length).toBeGreaterThan(0);
      expect(bundle?.view.facts.length).toBeGreaterThan(0);
    }
  });
});
