import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ANALYSIS_VERSION } from '@/lib/analysis/normalize';
import { lastSeenAt, sinceLabel, sinceLastVisit, touchLastSeen } from '@/lib/retention/service';
import { createTestDb, resetDb } from './helpers/test-db';

/**
 * WHY AN OWNER WOULD COME BACK (M21).
 *
 * The requirement was a reason to return weekly and monthly, with no fake
 * urgency, no streaks, no badges and no points. That splits into two claims and
 * both are tested here.
 *
 * THE FACT IS TRUE. "Since your last visit" reports the previous visit, not
 * this one, and counts only what actually arrived and what RepOS actually did
 * with it. A panel that reported the current visit would say nothing forever;
 * one that counted everything would say the same thing every week.
 *
 * THE FACT IS ALL THERE IS. When nothing happened the panel does not exist, and
 * the words it uses are asserted against the source — no streak, no counter
 * running down, nothing that is worth more today than on Friday.
 */

const ROOT = resolve(__dirname, '..');
let db: PrismaClient;

const NOW = new Date('2026-06-10T09:00:00.000Z');
const DAY = 86_400_000;
const LAST_WEEK = new Date(NOW.getTime() - 7 * DAY);

beforeAll(async () => {
  db = createTestDb('m21-retention');
}, 180_000);

afterAll(async () => {
  await db?.$disconnect();
});

let clientId: string;
let userId: string;

beforeEach(async () => {
  await resetDb(db);
  const client = await db.client.create({
    data: { businessName: 'Sunrise Cafe', vertical: 'cafe', status: 'ACTIVE' },
    select: { id: true },
  });
  const user = await db.user.create({
    data: { email: 'owner@sunrise.test' },
    select: { id: true },
  });
  await db.membership.create({
    data: { userId: user.id, clientId: client.id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
  });
  clientId = client.id;
  userId = user.id;
});

async function seen(at: Date | null) {
  await db.membership.updateMany({ where: { clientId, userId }, data: { lastSeenAt: at } });
}

async function feedback(at: Date, analysed: boolean) {
  await db.reviewItem.create({
    data: {
      clientId,
      source: 'REP_OS_QR',
      text: 'The coffee was good but the wait was long.',
      reviewDate: at,
      analysisStatus: analysed ? 'ANALYSED' : 'PENDING',
      analysisVersion: analysed ? ANALYSIS_VERSION : 0,
    },
  });
}

// ---------------------------------------------------------------------------

describe('remembering that somebody was here', () => {
  it('starts empty, and is written for the person who visited', async () => {
    expect(await lastSeenAt(db, clientId, userId)).toBeNull();
    await touchLastSeen(db, clientId, { now: NOW });
    expect((await lastSeenAt(db, clientId, userId))?.toISOString()).toBe(NOW.toISOString());
  });

  it('never throws, even for a business that is not there', async () => {
    await expect(touchLastSeen(db, 'clientthatneverexisted', { now: NOW })).resolves.toBeUndefined();
  });
});

describe('what happened while they were away', () => {
  it('says nothing on a first visit, because there is no "away" yet', async () => {
    await feedback(new Date(NOW.getTime() - DAY), true);
    expect(await sinceLastVisit(db, clientId, userId, { now: NOW })).toBeNull();
  });

  it('says nothing when the week was genuinely quiet', async () => {
    await seen(LAST_WEEK);
    await feedback(new Date(LAST_WEEK.getTime() - DAY), true);
    expect(await sinceLastVisit(db, clientId, userId, { now: NOW })).toBeNull();
  });

  it('counts only what arrived after the previous visit', async () => {
    await seen(LAST_WEEK);
    await feedback(new Date(LAST_WEEK.getTime() - DAY), true); // before
    await feedback(new Date(NOW.getTime() - 2 * DAY), true); // after
    await feedback(new Date(NOW.getTime() - DAY), false); // after, unread

    const since = await sinceLastVisit(db, clientId, userId, { now: NOW });
    expect(since?.arrived).toBe(2);
    expect(since?.read).toBe(1);
    expect(since?.daysAgo).toBe(7);
  });

  it('reports an improvement that reached a result while they were away', async () => {
    await seen(LAST_WEEK);
    await db.improvementAction.create({
      data: {
        clientId,
        insightId: `${clientId}:ISSUE:wait_time`,
        themeKey: 'wait_time',
        themeLabel: 'Waiting time',
        title: 'Second person on the counter at 6pm',
        baselineCount: 6,
        baselineTotal: 20,
        baselineCapturedAt: new Date(NOW.getTime() - 30 * DAY),
        status: 'MEASURED',
        doneAt: new Date(NOW.getTime() - 20 * DAY),
        measuredAt: new Date(NOW.getTime() - 2 * DAY),
        result: 'IMPROVED',
      },
    });

    const since = await sinceLastVisit(db, clientId, userId, { now: NOW });
    expect(since?.measured).toHaveLength(1);
    expect(since?.measured[0]?.result).toBe('IMPROVED');
    // The action was marked done long before the last visit, so it is not
    // reported as news a second time.
    expect(since?.done).toBe(0);
  });

  it('does not count another business’s feedback', async () => {
    await seen(LAST_WEEK);
    const other = await db.client.create({
      data: { businessName: 'Somebody Else', vertical: 'gym' },
      select: { id: true },
    });
    await db.reviewItem.create({
      data: {
        clientId: other.id,
        source: 'REP_OS_QR',
        text: 'Not this business.',
        reviewDate: new Date(NOW.getTime() - DAY),
      },
    });
    expect(await sinceLastVisit(db, clientId, userId, { now: NOW })).toBeNull();
  });

  it('answers for the person asking, not for whoever visited most recently', async () => {
    const staff = await db.user.create({
      data: { email: 'staff@sunrise.test' },
      select: { id: true },
    });
    await db.membership.create({
      data: { userId: staff.id, clientId, role: 'BUSINESS_STAFF', status: 'ACTIVE' },
    });
    await db.membership.updateMany({
      where: { clientId, userId: staff.id },
      data: { lastSeenAt: LAST_WEEK },
    });
    await feedback(new Date(NOW.getTime() - DAY), true);

    // The owner has never been here; the staff member was here a week ago.
    expect(await sinceLastVisit(db, clientId, userId, { now: NOW })).toBeNull();
    expect((await sinceLastVisit(db, clientId, staff.id, { now: NOW }))?.arrived).toBe(1);
  });
});

describe('how the gap is described', () => {
  it('reads as a plain interval at every distance', () => {
    expect(sinceLabel(0)).toContain('today');
    expect(sinceLabel(1)).toBe('Since yesterday');
    expect(sinceLabel(3)).toBe('Since your last visit, 3 days ago');
    expect(sinceLabel(9)).toBe('Since your last visit, a week ago');
    expect(sinceLabel(21)).toBe('Since your last visit, 3 weeks ago');
    expect(sinceLabel(90)).toBe('Since your last visit, 3 months ago');
  });

  it('never turns the gap into a warning', () => {
    for (const days of [0, 1, 3, 9, 21, 90, 400]) {
      expect(sinceLabel(days)).not.toMatch(
        /hurry|last chance|don.?t lose|expires|running out|act now|only \d+ left/i,
      );
    }
  });
});

describe('no dark patterns', () => {
  const files = [
    join(ROOT, 'src', 'lib', 'retention', 'service.ts'),
    join(ROOT, 'src', 'components', 'workspace', 'since-visit.tsx'),
    join(ROOT, 'src', 'components', 'workspace', 'home.tsx'),
  ];

  function code(path: string): string {
    return readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  }

  it('has no streak, badge, point, level or reward anywhere in the loop', () => {
    const BANNED = /\bstreak|\bbadge|\bpoints?\b|\bleaderboard|\btrophy|\breward|\bgamif/i;
    const offenders = files.filter((f) => BANNED.test(code(f)));
    expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });

  it('manufactures no urgency and no countdown', () => {
    const BANNED =
      /hurry|last chance|expires (in|soon)|running out|act now|don.?t miss|limited time|only \d+ (hours?|days?) left/i;
    const offenders = files.filter((f) => BANNED.test(code(f)));
    expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });

  it('renders nothing at all when there is nothing to report', () => {
    // Two guards, and both matter: the service returns null for a quiet week,
    // and Home renders the panel only when it is not null. Either one alone
    // would still leave an empty box on the page.
    const service = code(files[0]!);
    expect(service).toContain('return nothingHappened ? null : summary;');
    expect(code(files[2]!)).toContain('{since ? <SinceVisit since={since} basePath={basePath} /> : null}');
  });

  it('reads the previous visit before the current one is stamped', () => {
    const page = code(
      join(ROOT, 'src', 'app', '(workspace)', 'workspace', '[clientId]', 'page.tsx'),
    );
    const layout = code(
      join(ROOT, 'src', 'app', '(workspace)', 'workspace', '[clientId]', 'layout.tsx'),
    );
    // The page reads; the layout stamps, and only after the response.
    expect(page).toContain('await sinceLastVisit(prisma, clientId, gate.actor.userId)');
    expect(page).not.toContain('recordVisit');
    expect(layout).toContain('recordVisit(prisma, clientId)');
    expect(code(files[0]!)).toMatch(/after\(run\)/);
  });
});
