import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createClient,
  ensurePortalToken,
  regeneratePortalToken,
  setPortalLinkSent,
} from '@/lib/clients/service';
import {
  countClientFeedback,
  deleteFeedbackItem,
  getFeedbackItem,
  listClientFeedback,
} from '@/lib/feedback/service';
import { analyseClientFeedback, getThemeEvidence } from '@/lib/feedback/analysis';
import { setHandled } from '@/lib/feedback/replies';
import { createSnapshot, deleteSnapshot, getSnapshotDetail } from '@/lib/snapshots/service';
import { createMinute, deleteMinute, getMinute, updateMinute } from '@/lib/minutes/service';
import { loadIntelligence } from '@/lib/intelligence/service';
import {
  createActionFromInsight,
  decideAction,
  getAction,
  measureClientAction,
  moveAction,
  recordLearning,
} from '@/lib/improve/service';
import { createContext, deleteContext, getContext, updateContext } from '@/lib/context/service';
import {
  getGatewayView,
  savePublicBaseUrl,
  savePublicReviewUrl,
  setGatewayEnabled,
  submitCustomerFeedback,
} from '@/lib/gateway/service';
import { getKitView, saveKitConfig, setKitInstalled } from '@/lib/kit/service';
import { resolvePortalToken } from '@/lib/portal/access';
import { getAnalysisView, getPortalView, getReviewsView } from '@/lib/portal/service';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/**
 * EVERY BUSINESS IS A WALL (M18).
 *
 * The operator is one person who legitimately sees all their clients, so the
 * boundary that matters is not "can this user reach this row" but "can one
 * business's data ever reach another business's screen, message, evidence,
 * count or link". Every id in this product arrives from a URL segment or a
 * form field, and a mistyped or stale one must produce nothing — never
 * somebody else's business.
 *
 * Each test below hands a service one client's id together with another
 * client's child id, and requires the answer to be "no such thing".
 */

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('m18-isolation');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
  await savePublicBaseUrl(db, BASE);
});

afterAll(async () => {
  await db.$disconnect();
});

const BASE = 'https://repos.example.com';
const OFFLINE = { useAi: false } as const;
const NOW = new Date('2026-06-01T09:00:00.000Z');

async function makeClient(name: string, vertical = 'restaurant'): Promise<string> {
  const r = await createClient(db, validClientInput({ businessName: name, vertical }));
  if (!r.ok) throw new Error(r.message);
  return r.data.id;
}

async function token(clientId: string): Promise<string> {
  const g = await getGatewayView(db, clientId, { requestOrigin: null });
  return g!.token;
}

/** Enough feedback for a theme to become a pattern. */
async function fill(clientId: string, marker: string): Promise<void> {
  const t = await token(clientId);
  const lines = [
    `We waited far too long for the food. ${marker} one.`,
    `The wait was really long again today. ${marker} two.`,
    `Long wait before anything arrived. ${marker} three.`,
    `Waited ages for the order. ${marker} four.`,
    `The staff were warm and helpful. ${marker} five.`,
    `Friendly service throughout. ${marker} six.`,
    `Lovely staff, very welcoming. ${marker} seven.`,
  ];
  for (const [i, text] of lines.entries()) {
    const r = await submitCustomerFeedback(
      db,
      t,
      { stars: i < 4 ? 2 : 5, text },
      { now: new Date(NOW.getTime() + i * 60_000) },
    );
    if (!r.ok) throw new Error(r.message);
  }
  await analyseClientFeedback(db, clientId, OFFLINE);
}

/** The theme this client's own feedback was actually grouped under. */
async function topTheme(clientId: string): Promise<string> {
  const rows = await db.reviewItem.findMany({
    where: { clientId, analysisStatus: 'ANALYSED' },
    select: { themesJson: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const t of JSON.parse(r.themesJson) as Array<{ key: string; sentiment: string }>) {
      if (t.sentiment !== 'NEGATIVE') continue;
      counts.set(t.key, (counts.get(t.key) ?? 0) + 1);
    }
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best) throw new Error('no negative theme was produced by the fixture');
  return best[0];
}

// ---------------------------------------------------------------------------

describe('one business cannot reach another through a child id', () => {
  it('refuses another client’s feedback item, on read and on write', async () => {
    const a = await makeClient('Alpha Cafe');
    const b = await makeClient('Beta Salon', 'salon');
    await fill(a, 'ALPHA');

    const item = await db.reviewItem.findFirstOrThrow({ where: { clientId: a } });

    // Read with B's clientId and A's item id.
    expect(await getFeedbackItem(db, b, item.id)).toBeNull();

    // Delete, mark handled — both scoped, both must refuse.
    expect((await deleteFeedbackItem(db, b, item.id)).ok).toBe(false);
    expect((await setHandled(db, b, item.id, true)).ok).toBe(false);

    // And A's row is untouched by any of it.
    const after = await db.reviewItem.findUnique({ where: { id: item.id } });
    expect(after).not.toBeNull();
    expect(after?.handledAt).toBeNull();
  });

  it('refuses another client’s snapshot', async () => {
    const a = await makeClient('Alpha Cafe');
    const b = await makeClient('Beta Salon', 'salon');
    const snap = await createSnapshot(
      db,
      a,
      {
        label: 'A', capturedAt: NOW, rating: null, reviewCount: null, unansweredCount: null,
        daysSinceLastPost: null, photoRecencyDays: null, reviewsPerWeek: null,
        profileGaps: [], observationNotes: '', reviewsRaw: '',
      } as never,
      OFFLINE,
    );
    expect(snap.ok).toBe(true);
    if (!snap.ok) return;

    expect(await getSnapshotDetail(db, b, snap.data.id)).toBeNull();
    expect((await deleteSnapshot(db, b, snap.data.id)).ok).toBe(false);
    expect(await db.snapshot.count({ where: { clientId: a } })).toBe(1);
  });

  it('refuses another client’s minute', async () => {
    const a = await makeClient('Alpha Cafe');
    const b = await makeClient('Beta Salon', 'salon');
    const m = await createMinute(db, a, {
      category: 'DECISION', title: 'Alpha only', body: 'Private to Alpha.', occurredAt: NOW,
    } as never);
    expect(m.ok).toBe(true);
    if (!m.ok) return;

    expect(await getMinute(db, b, m.data.id)).toBeNull();
    expect((await updateMinute(db, b, m.data.id, {
      category: 'DECISION', title: 'Hijacked', body: 'x', occurredAt: NOW,
    } as never)).ok).toBe(false);
    expect((await deleteMinute(db, b, m.data.id)).ok).toBe(false);

    const still = await getMinute(db, a, m.data.id);
    expect(still?.title).toBe('Alpha only');
  });

  it('refuses another client’s improvement action at every step of the loop', async () => {
    const a = await makeClient('Alpha Cafe');
    const b = await makeClient('Beta Salon', 'salon');
    await fill(a, 'ALPHA');

    const { intelligence } = await loadIntelligence(
      db, { id: a, businessName: 'Alpha Cafe', vertical: 'restaurant' }, NOW,
    );
    const insight = intelligence.unhappy[0] ?? intelligence.loved[0];
    expect(insight, 'the fixture produced no insight to act on').toBeDefined();
    const action = await createActionFromInsight(db, a, insight!.id, { now: NOW });
    expect(action.ok).toBe(true);
    if (!action.ok) return;
    const id = action.data.id;
    const before = (await getAction(db, a, id))!.status;

    expect(await getAction(db, b, id)).toBeNull();
    expect((await decideAction(db, b, id, {
      decision: 'ACCEPT', description: 'x', statusNote: '', recordMinute: false,
    }, { now: NOW })).ok).toBe(false);
    expect((await moveAction(db, b, id, { to: 'DONE', note: '', occurredAt: NOW }, { now: NOW })).ok).toBe(false);
    expect((await measureClientAction(db, b, id, { now: NOW })).ok).toBe(false);
    expect((await recordLearning(db, b, id, 'stolen')).ok).toBe(false);

    // A's action never left the state it opened in.
    expect((await getAction(db, a, id))?.status).toBe(before);
  });

  it('refuses another client’s business context', async () => {
    const a = await makeClient('Alpha Cafe');
    const b = await makeClient('Beta Salon', 'salon');
    const c = await createContext(db, a, {
      kind: 'CONSTRAINT', text: 'Alpha cannot add staff.', themeKey: null,
      constraintKey: 'STAFF', questionKey: null, actionId: null, recordedAt: NOW,
    } as never);
    expect(c.ok).toBe(true);
    if (!c.ok) return;

    expect(await getContext(db, b, c.data.id)).toBeNull();
    expect((await updateContext(db, b, c.data.id, {
      kind: 'CONSTRAINT', text: 'Rewritten.', themeKey: null,
      constraintKey: 'STAFF', questionKey: null, actionId: null, recordedAt: NOW,
    } as never)).ok).toBe(false);
    expect((await deleteContext(db, b, c.data.id)).ok).toBe(false);

    expect((await getContext(db, a, c.data.id))?.text).toBe('Alpha cannot add staff.');
  });

  it('keeps per-client singletons apart', async () => {
    const a = await makeClient('Alpha Cafe');
    const b = await makeClient('Beta Salon', 'salon');

    await saveKitConfig(db, a, {
      qrTargetUrl: '', displayName: 'ALPHA ONLY', headline: '', subhead: '',
      footerNote: '', brandPrimary: '#111111', brandSecondary: '#222222',
    });
    await setKitInstalled(db, a, true);
    await savePublicReviewUrl(db, a, 'https://example.com/review/alpha');

    const kitB = await getKitView(db, b);
    expect(kitB?.content.displayName).not.toBe('ALPHA ONLY');
    expect(kitB?.content.publicReviewUrl).toBeNull();
    expect(kitB?.kitInstalledDate).toBeNull();

    // Voice profile and policy rows are per client and never shared.
    const vpA = await db.voiceProfile.findUnique({ where: { clientId: a } });
    const vpB = await db.voiceProfile.findUnique({ where: { clientId: b } });
    expect(vpA?.id).not.toBe(vpB?.id);
  });
});

// ---------------------------------------------------------------------------

describe('tokens open exactly one business', () => {
  it('never lets a gateway token store feedback against another client', async () => {
    const a = await makeClient('Alpha Cafe');
    const b = await makeClient('Beta Salon', 'salon');
    const ta = await token(a);

    const r = await submitCustomerFeedback(db, ta, { stars: 4, text: 'Meant for Alpha.' }, { now: NOW });
    expect(r.ok).toBe(true);

    expect(await db.reviewItem.count({ where: { clientId: a } })).toBe(1);
    expect(await db.reviewItem.count({ where: { clientId: b } })).toBe(0);
  });

  it('never resolves one client’s portal token to another client', async () => {
    const a = await makeClient('Alpha Cafe');
    const b = await makeClient('Beta Salon', 'salon');
    const pa = (await ensurePortalToken(db, a))!;
    const pb = (await ensurePortalToken(db, b))!;

    expect((await resolvePortalToken(db, pa))?.id).toBe(a);
    expect((await resolvePortalToken(db, pb))?.id).toBe(b);
    expect(pa).not.toBe(pb);
  });

  it('does not let a gateway token be used as a portal token, or the reverse', async () => {
    const a = await makeClient('Alpha Cafe');
    const gatewayToken = await token(a);
    const portal = (await ensurePortalToken(db, a))!;

    // Both are the same shape, so only the column they are looked up in keeps
    // them apart. A gateway token must open no portal.
    expect(await resolvePortalToken(db, gatewayToken)).toBeNull();

    // And a portal token must open no feedback page.
    const wrong = await submitCustomerFeedback(db, portal, { stars: 5, text: 'Wrong door.' }, { now: NOW });
    expect(wrong.ok).toBe(false);
    expect(await db.reviewItem.count()).toBe(0);
  });

  it('closes both doors for an archived business', async () => {
    const a = await makeClient('Alpha Cafe');
    const portal = (await ensurePortalToken(db, a))!;
    const gateway = await token(a);
    await db.client.update({ where: { id: a }, data: { archivedAt: NOW } });

    expect(await resolvePortalToken(db, portal)).toBeNull();
    const submitted = await submitCustomerFeedback(db, gateway, { stars: 5, text: 'Too late.' }, { now: NOW });
    expect(submitted.ok).toBe(false);
    expect(await db.reviewItem.count({ where: { clientId: a } })).toBe(0);
  });

  it('stores nothing while the feedback page is paused, and the portal still opens', async () => {
    const a = await makeClient('Alpha Cafe');
    const portal = (await ensurePortalToken(db, a))!;
    const gateway = await token(a);
    await setGatewayEnabled(db, a, false);

    expect((await submitCustomerFeedback(db, gateway, { stars: 5, text: 'Paused.' }, { now: NOW })).ok).toBe(false);
    expect(await db.reviewItem.count({ where: { clientId: a } })).toBe(0);
    // Pausing collection must not lock the owner out of what they already have.
    expect((await resolvePortalToken(db, portal))?.id).toBe(a);
  });

  it('opens nothing for malformed, unknown or foreign-shaped tokens', async () => {
    const a = await makeClient('Alpha Cafe');
    await ensurePortalToken(db, a);
    for (const bad of ['', '   ', 'short', 'A'.repeat(22), 'l'.repeat(22), 'a'.repeat(23),
      '../../etc/passwd', "' OR 1=1 --", '%2e%2e%2f', a]) {
      expect(await resolvePortalToken(db, bad), bad).toBeNull();
      expect((await submitCustomerFeedback(db, bad, { stars: 5, text: 'x' }, { now: NOW })).ok, bad).toBe(false);
    }
    expect(await db.reviewItem.count()).toBe(0);
  });

  it('retires the old portal link the moment a new one is issued', async () => {
    const a = await makeClient('Alpha Cafe');
    const b = await makeClient('Beta Salon', 'salon');
    const old = (await ensurePortalToken(db, a))!;
    const otherUntouched = (await ensurePortalToken(db, b))!;

    const fresh = (await regeneratePortalToken(db, a))!;
    expect(await resolvePortalToken(db, old)).toBeNull();
    expect((await resolvePortalToken(db, fresh))?.id).toBe(a);
    expect((await resolvePortalToken(db, otherUntouched))?.id).toBe(b);
  });
});

// ---------------------------------------------------------------------------

describe('the owner’s pages carry only their own business', () => {
  it('shows one business’s evidence and never the other’s, whatever the filters say', async () => {
    const a = await makeClient('Alpha Cafe');
    const b = await makeClient('Beta Salon', 'salon');
    await fill(a, 'ALPHA');
    await fill(b, 'BETA');

    const base = { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null };
    const viewA = await getReviewsView(db, a, base);
    const blob = JSON.stringify(viewA);
    expect(blob).toContain('ALPHA');
    expect(blob).not.toContain('BETA');

    // A theme key that belongs to the other client's vertical is not a theme
    // of this one, so it must narrow to nothing rather than leak.
    const foreign = await getReviewsView(db, a, { ...base, theme: 'stylist_skill' });
    expect(JSON.stringify(foreign)).not.toContain('BETA');

    // Free-text search cannot reach across either.
    const searched = await getReviewsView(db, a, { ...base, q: 'BETA' });
    expect(searched?.items).toEqual([]);
    expect(searched?.matching).toBe(0);
  });

  it('keeps every owner-facing view scoped', async () => {
    const a = await makeClient('Alpha Cafe');
    const b = await makeClient('Beta Salon', 'salon');
    await fill(a, 'ALPHA');
    await fill(b, 'BETA');

    for (const [view, name] of [
      [await getPortalView(db, a, { now: NOW }), 'home'],
      [await getAnalysisView(db, a, { now: NOW }), 'customers'],
    ] as const) {
      const blob = JSON.stringify(view);
      expect(blob, name).not.toContain('BETA');
      expect(blob, name).not.toContain('Beta Salon');
    }
  });

  it('never counts another client’s feedback into this one’s evidence', async () => {
    const a = await makeClient('Alpha Cafe');
    const b = await makeClient('Beta Salon', 'salon');
    await fill(a, 'ALPHA');
    await fill(b, 'BETA');

    expect(await countClientFeedback(db, a, {})).toBe(7);
    expect(await countClientFeedback(db, b, {})).toBe(7);

    const evidence = await getThemeEvidence(db, a, await topTheme(a));
    for (const row of evidence) expect(row.text).not.toContain('BETA');
  });
});

// ---------------------------------------------------------------------------

describe('the reviews query is the one source of truth (M18)', () => {
  it('filters by theme in the database, so paging cannot cut the count short', async () => {
    const a = await makeClient('Alpha Cafe');
    await fill(a, 'ALPHA');

    const theme = await topTheme(a);
    const all = await listClientFeedback(db, a, { themeKey: theme });
    const counted = await countClientFeedback(db, a, { themeKey: theme });
    expect(all.length).toBe(counted);
    expect(counted).toBeGreaterThanOrEqual(2);

    // The bug this replaces: a limit applied BEFORE the theme filter made the
    // count and the list disagree. One page must still count them all.
    const firstPage = await listClientFeedback(db, a, { themeKey: theme, limit: counted - 1 });
    expect(firstPage.length).toBe(counted - 1);
    expect(await countClientFeedback(db, a, { themeKey: theme })).toBe(counted);
    for (const row of firstPage) {
      expect(row.themes.some((t) => t.key === theme)).toBe(true);
    }

    // And a theme belonging to a different vertical matches nothing here.
    expect(await countClientFeedback(db, a, { themeKey: 'stylist_skill' })).toBe(0);
  });

  it('pages without dropping or repeating a row', async () => {
    const a = await makeClient('Alpha Cafe');
    await fill(a, 'ALPHA');

    const everything = await listClientFeedback(db, a, {});
    const p1 = await listClientFeedback(db, a, { limit: 3 });
    const p2 = await listClientFeedback(db, a, { limit: 3, offset: 3 });

    expect(p1.map((r) => r.id)).toEqual(everything.slice(0, 3).map((r) => r.id));
    expect(p2.map((r) => r.id)).toEqual(everything.slice(3, 6).map((r) => r.id));
    expect(new Set([...p1, ...p2].map((r) => r.id)).size).toBe(6);
  });

  it('counts what needs an answer with exactly the filter that finds it', async () => {
    const a = await makeClient('Alpha Cafe');
    await fill(a, 'ALPHA');

    const counted = await countClientFeedback(db, a, { worthReply: true });
    const listed = await listClientFeedback(db, a, { worthReply: true });
    expect(listed.length).toBe(counted);

    // Nothing filed as needing no response is ever in that pile, however it
    // ranks — the condition the old count was missing.
    for (const row of listed) {
      expect(row.responseAction).not.toBe('NO_RESPONSE_NEEDED');
      expect(row.handledAt).toBeNull();
    }
  });

  it('drops an item out of that count the moment the operator finishes with it', async () => {
    const a = await makeClient('Alpha Cafe');
    await fill(a, 'ALPHA');

    const before = await countClientFeedback(db, a, { worthReply: true });
    if (before === 0) return;
    const item = (await listClientFeedback(db, a, { worthReply: true }))[0]!;
    await setHandled(db, a, item.id, true, { now: NOW });

    const after = await countClientFeedback(db, a, { worthReply: true });
    expect(after).toBe(before - 1);
    expect((await listClientFeedback(db, a, { worthReply: true })).length).toBe(after);
  });

  it('reports the same total whichever page the owner is on', async () => {
    const a = await makeClient('Alpha Cafe');
    await fill(a, 'ALPHA');
    const base = { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null };

    const first = await getReviewsView(db, a, base, { page: 1 });
    const second = await getReviewsView(db, a, base, { page: 2 });

    expect(first?.matching).toBe(second?.matching);
    expect(first?.matching).toBe(7);
    expect(second!.shown).toBeGreaterThanOrEqual(first!.shown);
  });
});

// ---------------------------------------------------------------------------

describe('setup state is per business', () => {
  it('does not mark one business set up because another one is', async () => {
    const a = await makeClient('Alpha Cafe');
    const b = await makeClient('Beta Salon', 'salon');
    await setPortalLinkSent(db, a, true, NOW);
    await db.client.update({ where: { id: a }, data: { kitInstalledDate: NOW } });

    const { getClientSetup } = await import('@/lib/clients/service');
    expect((await getClientSetup(db, a)).complete).toBe(true);
    expect((await getClientSetup(db, b)).complete).toBe(false);
    expect((await getClientSetup(db, b)).ownerLinkSent).toBe(false);
  });
});
