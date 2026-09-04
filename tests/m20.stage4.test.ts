import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { completeOnboarding } from '@/lib/onboarding/service';
import { getWeeklyPulse, getMonthlyReview, periodWindows } from '@/lib/reporting/service';
import { MIN_MENTIONS_TO_NAME } from '@/lib/intelligence/engine';
import { ACTIVE, ROLE_OWNER, ROLE_STAFF } from '@/lib/tenancy/service';
import { getTeam, inviteMember, acceptInvite } from '@/lib/team/service';
import { createTestDb, resetDb } from './helpers/test-db';

/**
 * PERIOD REPORTS AND THE TEAM (M20 Stage 4).
 *
 * The Pulse and the Review are the two surfaces most likely to drift into
 * telling an owner what they want to hear. Most of this file exists to hold
 * them to the opposite: that a quiet week reads as a quiet week, that a
 * comparison is refused when the evidence will not carry one, and that no
 * sentence anywhere claims a change caused an outcome.
 */

let db: PrismaClient;
const NOW = new Date('2026-06-15T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

beforeAll(() => {
  db = createTestDb('m20-stage4');
}, 180_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

async function owner(providerId: string, email: string) {
  return db.user.create({
    data: { email, authProviderId: providerId },
    select: { id: true },
  });
}

async function business(name = 'Anand Tiffin', vertical = 'restaurant') {
  const user = await owner(`sb_${name.replace(/\W/g, '')}`, `${name.replace(/\W/g, '')}@x.com`);
  const result = await completeOnboarding(db, user.id, { businessName: name, vertical });
  if (!result.ok) throw new Error('fixture onboarding failed');
  return { clientId: result.data.clientId, userId: user.id };
}

/** Analysed feedback carrying one theme, placed a given number of days ago. */
async function feedback(clientId: string, themeKey: string, daysAgo: number, count: number) {
  for (let i = 0; i < count; i += 1) {
    await db.reviewItem.create({
      data: {
        clientId,
        text: `feedback about ${themeKey} #${i}`,
        analysisStatus: 'ANALYSED',
        themesJson: JSON.stringify([
          { key: themeKey, label: themeKey, kind: 'ISSUE', severity: 'high' },
        ]),
        createdAt: new Date(NOW.getTime() - daysAgo * DAY),
        updatedAt: NOW,
      },
    });
  }
}

const ALL_TEXT = (r: unknown) => JSON.stringify(r);
/** Words that would turn an observation into a claim about cause. */
const CAUSAL = /\bcaused\b|\bbecause of\b|\bthanks to\b|\bresulted in\b|\bled to\b|\bdue to\b|\bfixed it\b|\bproves\b/i;

// ---------------------------------------------------------------------------

describe('the period boundary', () => {
  it('is two equal, adjacent, deterministic windows', () => {
    const week = periodWindows('WEEK', NOW);
    expect(week.current.days).toBe(7);
    expect(week.previous.days).toBe(7);
    expect(week.current.to).toEqual(NOW);
    // Adjacent, not overlapping: the previous window ends where this one starts.
    expect(week.previous.to).toEqual(week.current.from);
    expect(week.current.from.getTime()).toBe(NOW.getTime() - 7 * DAY);

    const month = periodWindows('MONTH', NOW);
    expect(month.current.days).toBe(30);
    expect(month.previous.to).toEqual(month.current.from);
  });

  it('gives the same answer for the same moment, every time', () => {
    expect(periodWindows('WEEK', NOW)).toEqual(periodWindows('WEEK', NOW));
  });
});

describe('the weekly pulse', () => {
  it('says so honestly when no feedback arrived', async () => {
    const b = await business();
    const report = (await getWeeklyPulse(db, b.clientId, { now: NOW }))!;

    expect(report.volume.current).toBe(0);
    expect(report.enoughEvidence).toBe(false);
    expect(report.headline).toBe('No new feedback this week.');
    expect(report.issues).toEqual([]);
    expect(report.limits.length).toBeGreaterThan(0);
  });

  it('refuses to name a theme below the evidence floor', async () => {
    const b = await business();
    await feedback(b.clientId, 'service_speed', 2, MIN_MENTIONS_TO_NAME - 1);

    const report = (await getWeeklyPulse(db, b.clientId, { now: NOW }))!;
    expect(report.enoughEvidence).toBe(false);
    expect(report.headline).toMatch(/not enough new feedback/i);
    expect(report.issues).toEqual([]);
    expect(report.worsened).toEqual([]);
  });

  it('will not compare against a previous week that is too thin', async () => {
    const b = await business();
    await feedback(b.clientId, 'service_speed', 2, 6);
    await feedback(b.clientId, 'service_speed', 9, 1);

    const report = (await getWeeklyPulse(db, b.clientId, { now: NOW }))!;
    expect(report.enoughEvidence).toBe(true);
    expect(report.comparable).toBe(false);
    expect(report.headline).toMatch(/not enough in the week before/i);
    // Every movement is withheld rather than guessed.
    expect(report.issues.every((t) => t.movement === null)).toBe(true);
    expect(report.improved).toEqual([]);
    expect(report.worsened).toEqual([]);
  });

  it('says there was no major change when nothing moved much', async () => {
    const b = await business();
    await feedback(b.clientId, 'service_speed', 2, 5);
    await feedback(b.clientId, 'service_speed', 9, 5);

    const report = (await getWeeklyPulse(db, b.clientId, { now: NOW }))!;
    expect(report.comparable).toBe(true);
    expect(report.headline).toBe('No major change this week.');
    expect(report.issues[0]?.movement).toBe('STEADY');
  });

  it('reports a complaint coming up more often', async () => {
    const b = await business();
    await feedback(b.clientId, 'service_speed', 2, 9);
    await feedback(b.clientId, 'service_speed', 9, 3);

    const report = (await getWeeklyPulse(db, b.clientId, { now: NOW }))!;
    expect(report.worsened.map((t) => t.key)).toContain('service_speed');
    expect(report.worsened[0]!.before).toBe(3);
    expect(report.worsened[0]!.count).toBe(9);
    expect(report.headline).toMatch(/came up more often/i);
    expect(report.focus).toBeTruthy();
  });

  it('reports a complaint coming up less often', async () => {
    const b = await business();
    await feedback(b.clientId, 'service_speed', 2, 3);
    await feedback(b.clientId, 'service_speed', 9, 9);

    const report = (await getWeeklyPulse(db, b.clientId, { now: NOW }))!;
    expect(report.improved.map((t) => t.key)).toContain('service_speed');
    expect(report.headline).toMatch(/came up less often/i);
  });

  it('counts only the feedback inside its own window', async () => {
    const b = await business();
    await feedback(b.clientId, 'service_speed', 2, 4); // this week
    await feedback(b.clientId, 'service_speed', 9, 4); // last week
    await feedback(b.clientId, 'service_speed', 40, 50); // long ago, irrelevant

    const report = (await getWeeklyPulse(db, b.clientId, { now: NOW }))!;
    expect(report.volume.current).toBe(4);
    expect(report.volume.previous).toBe(4);
  });

  it('shows an improvement action that is under way', async () => {
    const b = await business();
    await feedback(b.clientId, 'service_speed', 2, 5);
    await db.improvementAction.create({
      data: {
        clientId: b.clientId,
        insightId: `${b.clientId}:UNHAPPY:service_speed`,
        themeKey: 'service_speed',
        themeLabel: 'Slow service',
        title: 'Add a second person at the counter',
        status: 'IN_PROGRESS',
        baselineCount: 5,
        baselineTotal: 20,
        baselineCapturedAt: NOW,
      },
    });

    const report = (await getWeeklyPulse(db, b.clientId, { now: NOW }))!;
    expect(report.actions).toHaveLength(1);
    expect(report.actions[0]!.title).toContain('second person');
    expect(report.actions[0]!.outcome).toBeNull();
  });

  it('never claims a change caused anything', async () => {
    const b = await business();
    await feedback(b.clientId, 'service_speed', 2, 3);
    await feedback(b.clientId, 'service_speed', 9, 9);
    await db.improvementAction.create({
      data: {
        clientId: b.clientId,
        insightId: `${b.clientId}:UNHAPPY:service_speed`,
        themeKey: 'service_speed',
        themeLabel: 'Slow service',
        title: 'Add a second person at the counter',
        status: 'DONE',
        result: 'IMPROVED',
        measuredAt: NOW,
        baselineCount: 9,
        baselineTotal: 20,
        baselineCapturedAt: NOW,
      },
    });

    const report = (await getWeeklyPulse(db, b.clientId, { now: NOW }))!;
    expect(report.actions[0]!.outcome).toMatch(/after the change/i);
    expect(ALL_TEXT(report)).not.toMatch(CAUSAL);
  });

  it('returns nothing for a business that does not exist', async () => {
    expect(await getWeeklyPulse(db, 'no_such_client', { now: NOW })).toBeNull();
  });

  it('never reads another tenant’s feedback into the report', async () => {
    const a = await business('Alpha', 'restaurant');
    const c = await business('Beta', 'clinic');
    await feedback(a.clientId, 'service_speed', 2, 5);
    await feedback(c.clientId, 'wait_time', 2, 40);

    const report = (await getWeeklyPulse(db, a.clientId, { now: NOW }))!;
    expect(report.volume.current).toBe(5);
    expect(ALL_TEXT(report)).not.toContain('wait_time');
  });
});

describe('the monthly review', () => {
  it('uses the wider window', async () => {
    const b = await business();
    await feedback(b.clientId, 'service_speed', 20, 6);

    const week = (await getWeeklyPulse(db, b.clientId, { now: NOW }))!;
    const month = (await getMonthlyReview(db, b.clientId, { now: NOW }))!;

    expect(week.volume.current).toBe(0);
    expect(month.volume.current).toBe(6);
    expect(month.window.days).toBe(30);
  });

  it('names what is still unresolved', async () => {
    const b = await business();
    await feedback(b.clientId, 'service_speed', 10, 8);
    await feedback(b.clientId, 'service_speed', 40, 8);

    const month = (await getMonthlyReview(db, b.clientId, { now: NOW }))!;
    expect(month.comparable).toBe(true);
    expect(month.unresolved.map((t) => t.key)).toContain('service_speed');
  });

  it('does not call something unresolved when it improved', async () => {
    const b = await business();
    await feedback(b.clientId, 'service_speed', 10, 3);
    await feedback(b.clientId, 'service_speed', 40, 12);

    const month = (await getMonthlyReview(db, b.clientId, { now: NOW }))!;
    expect(month.improved.map((t) => t.key)).toContain('service_speed');
    expect(month.unresolved.map((t) => t.key)).not.toContain('service_speed');
  });

  it('says so when the month is too thin to review', async () => {
    const b = await business();
    await feedback(b.clientId, 'service_speed', 10, 1);

    const month = (await getMonthlyReview(db, b.clientId, { now: NOW }))!;
    expect(month.enoughEvidence).toBe(false);
    expect(month.headline).toMatch(/not enough new feedback/i);
    expect(month.unresolved).toEqual([]);
  });

  it('reports a measured outcome observationally, never causally', async () => {
    const b = await business();
    await feedback(b.clientId, 'service_speed', 10, 5);
    for (const result of ['IMPROVED', 'WORSENED', 'NO_CLEAR_CHANGE', 'INSUFFICIENT_DATA']) {
      await db.improvementAction.create({
        data: {
          clientId: b.clientId,
          insightId: `${b.clientId}:UNHAPPY:${result}`,
          themeKey: 'service_speed',
          themeLabel: 'Slow service',
          title: `Change ${result}`,
          status: 'MEASURED',
          result,
          measuredAt: NOW,
          baselineCount: 5,
          baselineTotal: 20,
          baselineCapturedAt: NOW,
        },
      });
    }

    const month = (await getMonthlyReview(db, b.clientId, { now: NOW }))!;
    expect(month.actions.length).toBeGreaterThanOrEqual(4);
    for (const a of month.actions) {
      expect(a.outcome).toBeTruthy();
      expect(a.outcome!).toMatch(/after the change/i);
    }
    expect(ALL_TEXT(month)).not.toMatch(CAUSAL);
  });

  it('bounds how many actions it will load', async () => {
    const b = await business();
    for (let i = 0; i < 25; i += 1) {
      await db.improvementAction.create({
        data: {
          clientId: b.clientId,
          insightId: `${b.clientId}:UNHAPPY:t${i}`,
          themeKey: 't',
          themeLabel: 'T',
          title: `Change ${i}`,
          status: 'IN_PROGRESS',
          baselineCount: 1,
          baselineTotal: 10,
          baselineCapturedAt: NOW,
        },
      });
    }
    const month = (await getMonthlyReview(db, b.clientId, { now: NOW }))!;
    expect(month.actions.length).toBeLessThanOrEqual(10);
  });
});

describe('the team, through the product', () => {
  async function team() {
    const b = await business('Alpha', 'salon');
    const staff = await owner('sb_staff', 'staff@x.com');
    await db.membership.create({
      data: { userId: staff.id, clientId: b.clientId, role: ROLE_STAFF, status: ACTIVE },
    });
    return { ...b, staffId: staff.id };
  }

  it('shows the owner who is on the team, with roles and status', async () => {
    const t = await team();
    const view = await getTeam(db, t.clientId);
    expect(view.members).toHaveLength(2);
    expect(view.members.map((m) => m.role).sort()).toEqual([ROLE_OWNER, ROLE_STAFF]);
    expect(view.members.every((m) => m.status === ACTIVE)).toBe(true);
  });

  it('lists a pending invitation and never its token', async () => {
    const t = await team();
    const invite = await inviteMember(db, t.clientId, {
      email: 'new@x.com',
      role: ROLE_STAFF,
      invitedById: t.userId,
    });
    if (!invite.ok) throw new Error('invite failed');

    const view = await getTeam(db, t.clientId);
    expect(view.invites).toHaveLength(1);
    expect(view.invites[0]!.email).toBe('new@x.com');
    expect(JSON.stringify(view)).not.toContain(invite.data.token);
  });

  it('marks an expired invitation as expired rather than hiding it', async () => {
    const t = await team();
    const invite = await inviteMember(db, t.clientId, {
      email: 'new@x.com',
      role: ROLE_STAFF,
      invitedById: t.userId,
    });
    if (!invite.ok) throw new Error('invite failed');
    await db.invitation.update({
      where: { id: invite.data.inviteId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const view = await getTeam(db, t.clientId);
    expect(view.invites[0]!.expired).toBe(true);
  });

  it('shows no invitation belonging to another business', async () => {
    const a = await team();
    const other = await business('Beta', 'clinic');
    await inviteMember(db, other.clientId, {
      email: 'elsewhere@x.com',
      role: ROLE_STAFF,
      invitedById: other.userId,
    });

    const view = await getTeam(db, a.clientId);
    expect(view.invites).toEqual([]);
    expect(JSON.stringify(view)).not.toContain('elsewhere@x.com');
  });

  it('lets an invited person join, once, with the right address', async () => {
    const t = await team();
    const invite = await inviteMember(db, t.clientId, {
      email: 'joiner@x.com',
      role: ROLE_STAFF,
      invitedById: t.userId,
    });
    if (!invite.ok) throw new Error('invite failed');

    const joiner = await owner('sb_joiner', 'joiner@x.com');
    const first = await acceptInvite(db, invite.data.token, joiner.id);
    expect(first.ok).toBe(true);

    // Spent: the same link cannot be used again.
    const second = await acceptInvite(db, invite.data.token, joiner.id);
    expect(second.ok).toBe(false);

    const view = await getTeam(db, t.clientId);
    expect(view.members).toHaveLength(3);
    expect(view.invites).toEqual([]);
  });

  it('a joiner never becomes a platform admin', async () => {
    const t = await team();
    const invite = await inviteMember(db, t.clientId, {
      email: 'joiner@x.com',
      role: ROLE_OWNER,
      invitedById: t.userId,
    });
    if (!invite.ok) throw new Error('invite failed');
    const joiner = await owner('sb_joiner', 'joiner@x.com');
    await acceptInvite(db, invite.data.token, joiner.id);

    const after = await db.user.findUniqueOrThrow({ where: { id: joiner.id } });
    expect(after.isPlatformAdmin).toBe(false);
  });
});

describe('onboarding leads to a team without requiring one', () => {
  it('finishes with one owner and no invitations outstanding', async () => {
    const b = await business();
    const view = await getTeam(db, b.clientId);

    expect(view.members).toHaveLength(1);
    expect(view.members[0]!.role).toBe(ROLE_OWNER);
    expect(view.members[0]!.isLastOwner).toBe(true);
    expect(view.invites).toEqual([]);

    const client = await db.client.findUniqueOrThrow({ where: { id: b.clientId } });
    expect(client.setupCompletedAt).not.toBeNull();
  });
});
