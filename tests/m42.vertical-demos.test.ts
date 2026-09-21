import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRlsTestDb, hasRlsRuntimeDb, type RlsTestDb } from './helpers/rls-db';
import { listPacks, getPackOrFallback } from '@/lib/packs';
import { normalizeFeedback } from '@/lib/analysis/normalize';
import { parseStructured, ratedCount } from '@/lib/feedback/structured';
import { prepareIngest } from '@/lib/feedback/ingest';
import { fingerprintFeedback } from '@/lib/feedback/fingerprint';
import { normaliseBusinessName } from '@/lib/clients/schema';
import { MIN_MENTIONS_TO_NAME } from '@/lib/intelligence/engine';
import { isPublicToken, newPublicToken } from '@/lib/tokens';
import { countStoryFeedback, type DemoStory } from '../scripts/demo/story';
import { DEMO_WORKSPACES, demoMarker, type DemoWorkspace } from '../scripts/demo/verticals';
import { expectedFeedback, provisionDemoWorkspaces, type IdentityProvider } from '../scripts/demo/provision';

/**
 * THE SIX VERTICAL DEMO WORKSPACES (M42).
 *
 * Three things are pinned here.
 *
 * THE SET. One demo per vertical pack except the restaurant, which Corner
 * Cafe already demonstrates. Fictional names that collide with nothing already
 * in production, fictional logins on a domain that receives no mail.
 *
 * EVERY STORY IS ONE THE PRODUCT COULD HAVE STORED. The same blueprint the
 * Corner Cafe story is held to in m24: public reviews are words and a rating;
 * QR submissions carry only the pack's own questions and the chips the form
 * actually offers for each rating; nothing personal; many voices, not one
 * template. And each reads, through the real deterministic reader, as the
 * story its header says — so no page can show a figure the rows do not hold.
 *
 * PROVISIONING IS IDEMPOTENT AND STAYS IN ITS NAMESPACE. Against a real
 * Postgres with the shipped `rls.sql`: a second run creates nothing, Corner
 * Cafe and every other tenant are byte-for-byte unchanged, and each demo
 * owner — read as `repos_app`, the role production runs as — sees their own
 * business and nothing else.
 */

const NOW = new Date('2026-09-20T00:00:00+05:30');

type Row = { at: string; issues: string[]; praises: string[] };

function readStory(story: DemoStory): Row[] {
  const pack = getPackOrFallback(story.vertical);
  const read = (at: string, text: string, stars: number | null): Row => {
    const n = normalizeFeedback({ text, stars, pack });
    return {
      at,
      issues: n.themes.filter((t) => t.kind === 'ISSUE').map((t) => t.key),
      praises: n.themes.filter((t) => t.kind === 'PRAISE').map((t) => t.key),
    };
  };
  return [
    ...story.earlyReviews.map((r) => read(r.at, r.text, r.stars)),
    ...story.firstCheckin.reviews.map((r) => read(story.firstCheckin.capturedAt, r.text, r.stars)),
    ...story.midReviews.map((r) => read(r.at, r.text, r.stars)),
    ...story.lateReviews.map((r) => read(r.at, r.text, r.stars)),
    ...story.secondCheckin.reviews.map((r) => read(story.secondCheckin.capturedAt, r.text, r.stars)),
    ...story.qr.map((q) => read(q.at, q.text, q.stars)),
  ];
}

/**
 * What each story is meant to show, stated once. `action` is the theme the
 * owner changed something about and `result` what the before/after comparison
 * has to say about it; `attention` is what Home leads with at the end.
 */
const EXPECT: Record<string, { strength: string; attention: string; action: string; result: 'IMPROVED' | 'NO_CLEAR_CHANGE' | 'WORSENED' }> = {
  clinic: { strength: 'doctor_care', attention: 'appointment_scheduling', action: 'wait_time', result: 'IMPROVED' },
  coaching: { strength: 'teaching_quality_praise', attention: 'batch_size', action: 'schedule_reliability', result: 'IMPROVED' },
  gym: { strength: 'trainer_quality', attention: 'equipment_condition', action: 'crowding', result: 'IMPROVED' },
  real_estate: { strength: 'transparency', attention: 'responsiveness', action: 'responsiveness', result: 'NO_CLEAR_CHANGE' },
  salon: { strength: 'stylist_skill', attention: 'appointment_scheduling', action: 'appointment_scheduling', result: 'IMPROVED' },
  wedding: { strength: 'output_quality', attention: 'communication', action: 'communication', result: 'WORSENED' },
};

describe('the demo set', () => {
  it('is one fictional business for every vertical except the restaurant', () => {
    const verticals = DEMO_WORKSPACES.map((w) => w.vertical).sort();
    const packs = listPacks().map((p) => p.id).filter((id) => id !== 'restaurant').sort();
    expect(DEMO_WORKSPACES).toHaveLength(6);
    expect(verticals).toEqual(packs);
    for (const w of DEMO_WORKSPACES) expect(w.story.vertical).toBe(w.vertical);
  });

  it('has stable, distinct identities that collide with nothing already live', () => {
    const unique = (xs: string[]) => new Set(xs).size === xs.length;
    expect(unique(DEMO_WORKSPACES.map((w) => w.key))).toBe(true);
    expect(unique(DEMO_WORKSPACES.map((w) => normaliseBusinessName(w.businessName)))).toBe(true);
    expect(unique(DEMO_WORKSPACES.map((w) => w.loginEmail))).toBe(true);
    // Corner Cafe, and the three older templated demo businesses, keep their names to themselves.
    const taken = ['Corner Cafe', 'Sunrise Dental Clinic', 'Glow Salon & Spa', 'FitZone Gym'].map(normaliseBusinessName);
    for (const w of DEMO_WORKSPACES) {
      expect(taken).not.toContain(normaliseBusinessName(w.businessName));
      expect(w.businessName).toBe(w.story.businessName);
      expect(w.loginEmail).toMatch(/^demo\.[a-z]+@headway\.demo$/);
      expect(demoMarker(w.key)).toBe(`[headway-demo:${w.key}]`);
      expect(w.headline.length).toBeGreaterThan(40);
    }
  });
});

describe.each(DEMO_WORKSPACES.map((w) => [w.key, w] as [string, DemoWorkspace]))('the %s story', (key, w) => {
  const story = w.story;
  const pack = getPackOrFallback(story.vertical);
  const dimensions = pack.gateway?.dimensions ?? [];
  const publicReviews = [...story.earlyReviews, ...story.firstCheckin.reviews, ...story.midReviews, ...story.lateReviews, ...story.secondCheckin.reviews];
  const t = (iso: string) => new Date(iso).getTime();

  it('holds enough feedback for a demo and not more, every date real and in the past', () => {
    const n = countStoryFeedback(story);
    expect(n).toBeGreaterThanOrEqual(35);
    expect(n).toBeLessThanOrEqual(60);
    for (const x of [...story.earlyReviews, ...story.midReviews, ...story.lateReviews, ...story.qr]) {
      expect(Number.isNaN(t(x.at)), x.at).toBe(false);
      expect(t(x.at), x.at).toBeLessThan(NOW.getTime());
    }
    for (const c of [story.firstCheckin, story.secondCheckin]) for (const r of c.reviews) expect(r.at).toBe('');
  });

  it('keeps the timeline in the order it could have happened', () => {
    const last = (xs: { at: string }[]) => Math.max(...xs.map((x) => t(x.at)));
    const first = (xs: { at: string }[]) => Math.min(...xs.map((x) => t(x.at)));
    expect(last(story.earlyReviews)).toBeLessThan(t(story.firstCheckin.capturedAt));
    expect(first(story.midReviews)).toBeGreaterThan(t(story.firstCheckin.capturedAt));
    expect(last(story.midReviews)).toBeLessThan(t(story.action.suggestedAt));
    expect(t(story.action.suggestedAt)).toBeLessThan(t(story.action.decidedAt));
    expect(t(story.action.decidedAt)).toBeLessThan(t(story.action.doneAt));
    expect(t(story.action.doneAt)).toBeLessThan(t(story.secondCheckin.capturedAt));
    expect(t(story.secondCheckin.capturedAt)).toBeLessThan(t(story.action.measuredAt));
    for (const x of [...story.lateReviews, ...story.qr]) expect(t(x.at)).toBeGreaterThanOrEqual(t(story.action.doneAt));
    expect(t(story.owner.conversation.at)).toBeLessThan(t(story.action.suggestedAt));
    if (story.owner.answer) expect(t(story.owner.answer.at)).toBeGreaterThanOrEqual(t(story.action.decidedAt));
    expect(t(story.owner.afterNote.at)).toBeGreaterThanOrEqual(t(story.action.measuredAt));
  });

  it('shapes every QR submission exactly as the form would store it', () => {
    for (const q of story.qr) {
      const structured = parseStructured(dimensions, { dimensions: q.dimensions, signals: q.signals });
      expect(Object.keys(structured.dimensions).sort(), q.at).toEqual(Object.keys(q.dimensions).sort());
      expect([...structured.signals].sort(), q.at).toEqual([...q.signals].sort());
      for (const signal of q.signals) {
        const red = dimensions.find((d) => d.signals.some((s) => s.key === signal));
        const green = dimensions.find((d) => d.positiveSignals.some((s) => s.key === signal));
        const dim = red ?? green;
        expect(dim, `${q.at} ${signal}`).toBeDefined();
        const rating = q.dimensions[dim!.key]!;
        // The form offers red chips for 1–3, and for a 4 behind "make it a 5";
        // green chips for a 4 or a 5. Nothing else can be tapped.
        if (red) expect(rating, `${q.at} ${signal}`).toBeLessThanOrEqual(4);
        else expect(rating, `${q.at} ${signal}`).toBeGreaterThanOrEqual(4);
      }
      if (q.stars !== null) expect(Number.isInteger(q.stars) && q.stars >= 1 && q.stars <= 5).toBe(true);
      const hasWords = /[\p{L}\p{N}]/u.test(q.text);
      expect(hasWords || q.stars !== null || ratedCount(structured) > 0).toBe(true);
      const prepared = prepareIngest(
        { text: q.text, stars: q.stars, occurredAt: new Date(q.at), source: 'REP_OS_QR', structured },
        { allowEmptyText: true },
      );
      expect(prepared.ok, q.at).toBe(true);
      if (prepared.ok) expect(prepared.data.redacted, q.at).toBe(false);
    }
    // Something for the form to demonstrate: taps with words, taps alone, a rating alone.
    expect(story.qr.filter((q) => Object.keys(q.dimensions).length > 0 && q.text.trim()).length).toBeGreaterThanOrEqual(8);
    expect(story.qr.filter((q) => Object.keys(q.dimensions).length > 0 && !q.text.trim()).length).toBeGreaterThanOrEqual(2);
    expect(story.qr.filter((q) => Object.keys(q.dimensions).length === 0 && !q.text.trim()).length).toBeGreaterThanOrEqual(1);
  });

  it('keeps public reviews as public reviews, written by many people', () => {
    for (const r of publicReviews) {
      expect(r.text.trim().length).toBeGreaterThan(0);
      if (r.stars !== null) expect(r.stars >= 1 && r.stars <= 5).toBe(true);
    }
    expect(publicReviews.some((r) => r.stars === null)).toBe(true);
    const ratings = new Set(publicReviews.map((r) => r.stars));
    for (const s of [2, 3, 4, 5]) expect(ratings.has(s), `a ${s}-star review`).toBe(true);
    const texts = [...publicReviews.map((r) => r.text), ...story.qr.map((q) => q.text)].filter((x) => x.trim());
    const prints = texts.map((x) => fingerprintFeedback(x));
    expect(new Set(prints).size).toBe(prints.length);
    const openings = texts.map((x) => x.toLowerCase().split(/\s+/).slice(0, 6).join(' '));
    expect(new Set(openings).size).toBe(openings.length);
  });

  it('carries no personal details and no medical claims', () => {
    const texts = [...publicReviews.map((r) => r.text), ...story.qr.map((q) => q.text), story.owner.conversation.body, story.owner.afterNote.body];
    for (const x of texts) {
      expect(x).not.toMatch(/@|\d{7,}|\+91/);
      expect(x).not.toMatch(/\b(?:mr|mrs|ms|dr)\.? [A-Z]/);
      expect(x.toLowerCase()).not.toMatch(/diagnos|cured|prescribed|surgery|disease/);
    }
  });

  it('tells Headway things the pack understands', () => {
    const issueKeys = new Set(pack.issueTaxonomy.map((i) => i.key));
    for (const line of story.owner.context) if (line.themeKey) expect(issueKeys.has(line.themeKey), line.text).toBe(true);
    if (story.owner.answer) {
      const issue = pack.issueTaxonomy.find((i) => i.key === story.owner.answer!.themeKey);
      expect(issue?.askOwner?.options).toContain(story.owner.answer.answer);
    }
  });

  it('reads, through the real deterministic reader, as the story it tells', () => {
    const expected = EXPECT[key]!;
    const rows = readStory(story);
    const count = (k: string, pred: (r: Row) => boolean = () => true) =>
      rows.filter((r) => pred(r) && (r.issues.includes(k) || r.praises.includes(k))).length;

    // What customers love: the strength leads every other praise, and it is not alone.
    const praiseKeys = pack.praiseTaxonomy.map((p) => p.key);
    for (const p of praiseKeys.filter((p) => p !== expected.strength)) {
      expect(count(expected.strength), p).toBeGreaterThan(count(p));
    }
    expect(count(expected.strength)).toBeGreaterThanOrEqual(MIN_MENTIONS_TO_NAME * 3);
    expect(praiseKeys.filter((p) => count(p) >= MIN_MENTIONS_TO_NAME).length).toBeGreaterThanOrEqual(2);

    // What needs attention is a pattern, not a bad day.
    expect(count(expected.attention)).toBeGreaterThanOrEqual(MIN_MENTIONS_TO_NAME * 3);

    // Before and after the change, as shares of their own pile.
    const done = t(story.action.doneAt);
    const before = rows.filter((r) => t(r.at) < done);
    const after = rows.filter((r) => t(r.at) >= done);
    expect(before.length).toBeGreaterThanOrEqual(10);
    expect(after.length).toBeGreaterThanOrEqual(10);
    const share = (xs: Row[]) => xs.filter((r) => r.issues.includes(expected.action)).length / xs.length;
    const moved = share(after) - share(before);
    if (expected.result === 'IMPROVED') expect(moved).toBeLessThan(-0.05);
    if (expected.result === 'WORSENED') expect(moved).toBeGreaterThan(0.05);
    if (expected.result === 'NO_CLEAR_CHANGE') expect(Math.abs(moved)).toBeLessThan(0.05);

    // A new problem really is new: it rose after the change.
    if (expected.attention !== expected.action) {
      const s = (xs: Row[]) => xs.filter((r) => r.issues.includes(expected.attention)).length / xs.length;
      expect(s(after) - s(before)).toBeGreaterThan(0.2);
    }
  });
});

// ---------------------------------------------------------------------------
// Provisioning, against a real database with the shipped policies
// ---------------------------------------------------------------------------

const ADMIN = 'usm42admin00000000001';
const OTHER_OWNER = 'usm42other0000000001';
const CAFE = 'clm42cornercafe000001';
const OTHER = 'clm42otherbusiness0001';

/** Stands in for the Supabase admin API: mints ids, never a real account. */
function fakeIdentity() {
  const created: string[] = [];
  const removed: string[] = [];
  const provider: IdentityProvider = {
    async create(email) {
      created.push(email);
      return { authUserId: randomUUID(), password: 'not-a-real-password' };
    },
    async remove(authUserId) {
      removed.push(authUserId);
    },
  };
  return { provider, created, removed };
}

/** The runtime role, with the identity set per operation, as production does. */
function appClient(appUrl: string, userId: string): PrismaClient {
  const base = new PrismaClient({ datasources: { db: { url: appUrl } } });
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.user_id', ${userId}, TRUE)`,
            query(args),
          ]);
          return result as unknown;
        },
      },
    },
  }) as unknown as PrismaClient;
}

/** Every row a tenant owns, as the database itself prints it. */
async function fingerprint(db: PrismaClient, clientIds: string[], userIds: string[]): Promise<string> {
  const tables = ['Client', 'FeedbackGateway', 'ReviewItem', 'Snapshot', 'ImprovementAction', 'Minute', 'BusinessContext', 'Membership', 'KitConfig', 'VoiceProfile', 'BusinessPolicy'];
  const parts: string[] = [];
  for (const table of tables) {
    const column = table === 'Client' ? 'id' : 'clientId';
    const rows = await db.$queryRawUnsafe<{ j: string }[]>(
      `SELECT to_jsonb(t)::text AS j FROM "${table}" t WHERE t."${column}" = ANY($1::text[]) ORDER BY 1`,
      clientIds,
    );
    parts.push(`${table}:${rows.map((r) => r.j).join('\n')}`);
  }
  const users = await db.$queryRawUnsafe<{ j: string }[]>(`SELECT to_jsonb(t)::text AS j FROM "User" t WHERE t.id = ANY($1::text[]) ORDER BY 1`, userIds);
  parts.push(`User:${users.map((r) => r.j).join('\n')}`);
  return parts.join('\n\n');
}

describe('provisioning the demo workspaces', () => {
  let rls: RlsTestDb;
  let db: PrismaClient;
  let baseline = '';
  const identity = fakeIdentity();
  const cafeToken = newPublicToken();
  const quiet = () => {};

  beforeAll(async () => {
    expect(hasRlsRuntimeDb(), 'REPOS_TEST_DATABASE_URL and REPOS_TEST_APP_DATABASE_URL must be set').toBe(true);
    rls = await createRlsTestDb('vertical-demos');
    db = rls.owner;

    await db.user.create({ data: { id: ADMIN, email: 'admin@example.test', authProviderId: randomUUID(), isPlatformAdmin: true } });
    await db.user.create({ data: { id: OTHER_OWNER, email: 'owner@example.test', authProviderId: randomUUID() } });
    // Corner Cafe, as production holds it: the demonstration restaurant, its
    // own page, its own feedback — and no demo marker.
    await db.client.create({
      data: {
        id: CAFE,
        businessName: 'Corner Cafe',
        vertical: 'restaurant',
        status: 'ACTIVE',
        serviceExemption: 'DEMO',
        gateway: { create: { publicToken: cafeToken } },
        feedback: {
          create: [
            { text: 'The biryani was outstanding.', stars: 5, source: 'PUBLIC_REVIEW', fingerprint: 'cafe-1' },
            { text: 'Waited nearly an hour for mains on Saturday.', stars: 2, source: 'PUBLIC_REVIEW', fingerprint: 'cafe-2' },
          ],
        },
      },
    });
    await db.client.create({
      data: {
        id: OTHER,
        businessName: 'Other Business',
        vertical: 'clinic',
        status: 'ACTIVE',
        gateway: { create: { publicToken: newPublicToken() } },
        memberships: { create: { userId: OTHER_OWNER, role: 'BUSINESS_OWNER', status: 'ACTIVE' } },
      },
    });
    baseline = await fingerprint(db, [CAFE, OTHER], [ADMIN, OTHER_OWNER]);
  }, 240_000);

  afterAll(async () => {
    await rls?.dispose();
  });

  it('creates six workspaces, each seeded, exempt, with its own page and one owner login', async () => {
    const outcomes = await provisionDemoWorkspaces(db, { adminUserId: ADMIN, identity: identity.provider, now: NOW, log: quiet });
    expect(outcomes.map((o) => o.client)).toEqual(Array(6).fill('created'));
    expect(outcomes.map((o) => o.story)).toEqual(Array(6).fill('seeded'));
    expect(outcomes.map((o) => o.login.state)).toEqual(Array(6).fill('created'));
    expect(identity.created.sort()).toEqual(DEMO_WORKSPACES.map((w) => w.loginEmail).sort());
    expect(identity.removed).toEqual([]);

    for (const w of DEMO_WORKSPACES) {
      const o = outcomes.find((x) => x.key === w.key)!;
      const client = await db.client.findUniqueOrThrow({ where: { id: o.clientId! }, include: { gateway: true, memberships: { include: { user: true } } } });
      expect(client.businessName).toBe(w.businessName);
      expect(client.vertical).toBe(w.vertical);
      expect(client.serviceExemption).toBe('DEMO');
      expect(client.notes).toContain(demoMarker(w.key));
      expect(isPublicToken(client.gateway?.publicToken)).toBe(true);
      expect(client.gateway?.enabled).toBe(true);
      expect(o.feedback).toBe(expectedFeedback(w));
      expect(await db.reviewItem.count({ where: { clientId: client.id, NOT: { analysisStatus: 'ANALYSED' } } })).toBe(0);
      expect(await db.snapshot.count({ where: { clientId: client.id } })).toBe(2);
      const action = await db.improvementAction.findFirstOrThrow({ where: { clientId: client.id } });
      expect(action.themeKey).toBe(EXPECT[w.key]!.action);
      expect(action.result).toBe(EXPECT[w.key]!.result);
      expect(client.memberships).toHaveLength(1);
      expect(client.memberships[0]!.role).toBe('BUSINESS_OWNER');
      expect(client.memberships[0]!.user.email).toBe(w.loginEmail);
      expect(client.memberships[0]!.user.isPlatformAdmin).toBe(false);
    }
    const tokens = outcomes.map((o) => o.publicToken);
    expect(new Set([...tokens, cafeToken]).size).toBe(7);
  }, 240_000);

  it('creates nothing the second time', async () => {
    const counts = async () => ({
      clients: await db.client.count(),
      gateways: await db.feedbackGateway.count(),
      users: await db.user.count(),
      memberships: await db.membership.count(),
      feedback: await db.reviewItem.count(),
      snapshots: await db.snapshot.count(),
      actions: await db.improvementAction.count(),
      minutes: await db.minute.count(),
      context: await db.businessContext.count(),
    });
    const before = await counts();
    const outcomes = await provisionDemoWorkspaces(db, { adminUserId: ADMIN, identity: identity.provider, now: NOW, log: quiet });
    expect(outcomes.map((o) => o.client)).toEqual(Array(6).fill('found'));
    expect(outcomes.map((o) => o.story)).toEqual(Array(6).fill('kept'));
    expect(outcomes.map((o) => o.login.state)).toEqual(Array(6).fill('exists'));
    expect(identity.created).toHaveLength(6);
    expect(await counts()).toEqual(before);
  }, 240_000);

  it('leaves Corner Cafe and every other tenant exactly as they were', async () => {
    expect(await fingerprint(db, [CAFE, OTHER], [ADMIN, OTHER_OWNER])).toBe(baseline);
    const demoIds = (await db.client.findMany({ where: { notes: { contains: '[headway-demo:' } }, select: { id: true } })).map((c) => c.id);
    expect(demoIds).toHaveLength(6);
    // Every piece of story the runs wrote belongs to a demo business.
    for (const model of ['reviewItem', 'snapshot', 'improvementAction', 'minute', 'businessContext'] as const) {
      const delegate = db[model] as unknown as { count: (a: object) => Promise<number> };
      expect(await delegate.count({ where: { clientId: { notIn: [...demoIds, CAFE, OTHER] } } }), model).toBe(0);
    }
  });

  it('shows each demo owner their own business and nothing else', async () => {
    const owners = await db.membership.findMany({
      where: { client: { notes: { contains: '[headway-demo:' } } },
      select: { userId: true, clientId: true },
    });
    expect(owners).toHaveLength(6);
    for (const { userId, clientId } of owners) {
      const as = appClient(rls.appUrl, userId);
      try {
        expect((await as.client.findMany({ select: { id: true } })).map((c) => c.id)).toEqual([clientId]);
        expect((await as.feedbackGateway.findMany({ select: { clientId: true } })).map((g) => g.clientId)).toEqual([clientId]);
        expect(await as.reviewItem.count()).toBe(await db.reviewItem.count({ where: { clientId } }));
        expect(await as.reviewItem.count({ where: { clientId: CAFE } })).toBe(0);
        expect(await as.improvementAction.count({ where: { NOT: { clientId } } })).toBe(0);
      } finally {
        await as.$disconnect();
      }
    }
    // And the other tenant's owner sees none of the demos.
    const other = appClient(rls.appUrl, OTHER_OWNER);
    try {
      expect((await other.client.findMany({ select: { id: true } })).map((c) => c.id)).toEqual([OTHER]);
    } finally {
      await other.$disconnect();
    }
  });

  it('refuses to adopt a business that merely shares a demo name', async () => {
    const impostor: DemoWorkspace = { ...DEMO_WORKSPACES[0]!, key: 'probe', businessName: 'Other Business' };
    await expect(
      provisionDemoWorkspaces(db, { adminUserId: ADMIN, identity: null, now: NOW, log: quiet, workspaces: [impostor] }),
    ).rejects.toThrow(/without the demo marker/);
    expect(await db.client.count({ where: { notes: { contains: demoMarker('probe') } } })).toBe(0);
  });

  it('acts only for an active platform administrator', async () => {
    await expect(
      provisionDemoWorkspaces(db, { adminUserId: OTHER_OWNER, identity: null, now: NOW, log: quiet }),
    ).rejects.toThrow(/platform administrator/);
  });
});
