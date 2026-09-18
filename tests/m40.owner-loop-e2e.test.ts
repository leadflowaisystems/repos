import { PrismaClient, type Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRlsTestDb, hasRlsRuntimeDb, type RlsTestDb } from './helpers/rls-db';
import { runInRequestScope } from '@/lib/request-cache';
import { translatorFor } from '@/lib/i18n/translator';
import {
  createActionForTheme,
  decideAction,
  getAction,
  measureClientAction,
  moveAction,
} from '@/lib/improve/service';
import { getImprovementsView } from '@/lib/portal/service';
import { getResponsibility } from '@/lib/responsibility/service';
import { movesFor } from '@/lib/improve/owner-moves';
import { CAUSAL } from '@/lib/portal/test-fixtures';
import { enoughToCheck, shelvesFor } from '@/components/workspace/improvements';

/**
 * THE OWNER LOOP, AGAINST A REAL DATABASE (owner action-loop pass).
 *
 * Every other test of this loop reads source or calls pure builders. This one
 * writes: a real Postgres, the real schema, `rls.sql` applied, and every query
 * issued as `repos_app` — the non-owner runtime role production uses — with
 * `app.user_id` set per operation exactly as the app sets it. What passes here
 * has actually been stored and read back through row-level security.
 *
 * WHAT IT DOES NOT COVER, and why. `ownerDecideAction` resolves the signed-in
 * person through Supabase before it reaches any of this, and there is no
 * Supabase session in a test process. So the gate is proven separately, in a
 * browser, by posting a forged client id and being refused; this file proves
 * everything on the other side of that gate. The two halves meet at
 * `tenantGate`, which `tests/compliance.test.ts` pins as the first statement
 * of the action.
 *
 * THE CLIENTS HERE ARE DISPOSABLE. `createRlsTestDb` creates and drops its own
 * database on a cluster the helper refuses unless it is on localhost, so this
 * can never be pointed at a deployment.
 */

const DAY = 86_400_000;
const OWNER = 'usloopowner0000000001';
const OWNER_AUTH = '88888888-8888-4888-8888-888888888881';
const STRANGER = 'usloopstranger000001';
const STRANGER_AUTH = '88888888-8888-4888-8888-888888888882';
const MINE = 'clloopmine00000000001';
const THEIRS = 'cllooptheirs000000001';

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

/**
 * A business with a complaint big enough to be a pattern.
 *
 * `before` rows are dated before `changeAt`, `after` rows after it, so the
 * measurement engine has two genuinely separate piles to compare rather than
 * a window it has to invent.
 */
async function seed(
  db: PrismaClient,
  id: string,
  owner: { userId: string; authId: string; email: string },
  counts: { bad: number; good: number },
) {
  const now = Date.now();
  await db.client.create({
    data: {
      id,
      businessName: `Loop ${id}`,
      vertical: 'restaurant',
      status: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
    },
  });
  await db.user.upsert({
    where: { id: owner.userId },
    create: { id: owner.userId, email: owner.email, authProviderId: owner.authId },
    update: {},
  });
  await db.membership.create({
    data: { userId: owner.userId, clientId: id, role: 'BUSINESS_OWNER', status: 'ACTIVE' },
  });
  await db.feedbackGateway.create({
    data: { clientId: id, publicToken: `${id}tok`.slice(0, 24), enabled: true },
  });
  await db.snapshot.create({
    data: { clientId: id, label: 'Check-in', capturedAt: new Date(now - 60 * DAY), rating: 3.9, reviewCount: 30 },
  });

  let n = 0;
  const rows: Prisma.ReviewItemCreateManyInput[] = [];
  const push = (bad: boolean, daysAgo: number) => {
    const at = new Date(now - daysAgo * DAY);
    rows.push({
      id: `${id}f${(n++).toString(36).padStart(4, '0')}`.slice(0, 32),
      clientId: id,
      text: bad
        ? 'Waited almost forty minutes for the main course even though the place was half empty.'
        : 'Quick friendly service, our order came within ten minutes and everything was hot.',
      stars: bad ? 2 : 5,
      reviewDate: at,
      source: 'REP_OS_QR',
      fingerprint: `${id}-${n}`,
      sentiment: bad ? 'NEGATIVE' : 'POSITIVE',
      issueTags: JSON.stringify(bad ? ['service_speed'] : []),
      praiseTags: JSON.stringify(bad ? [] : ['service_quality']),
      analysisStatus: 'ANALYSED',
      analysisVersion: 2,
      analysedAt: at,
      themesJson: JSON.stringify([
        bad
          ? { key: 'service_speed', label: 'Service speed', kind: 'ISSUE', sentiment: 'NEGATIVE', severity: 'high' }
          : { key: 'service_quality', label: 'Service quality', kind: 'PRAISE', sentiment: 'POSITIVE', severity: 'low' },
      ]),
      responseAction: bad ? 'REPLY_RECOMMENDED' : 'REPLY_OPTIONAL',
      priorityBand: bad ? 'HIGH' : 'LOW',
      triageVersion: 1,
      draftStatus: 'READY',
      draftVersion: 1,
      createdAt: at,
      updatedAt: at,
    });
  };

  for (let i = 0; i < counts.bad; i += 1) push(true, 40);
  for (let i = 0; i < counts.good; i += 1) push(false, 40);
  await db.reviewItem.createMany({ data: rows });
  return n;
}

/**
 * Feedback arriving AFTER a change was made.
 *
 * This is a separate step, and that is the whole point: the measurement's
 * "before" is the baseline frozen when the action was created, and its "after"
 * is what arrived from the change onward. Seeding both up front produced a
 * before of 21 and an after of 21 — every row sat on both sides, because every
 * row predated the change. The real sequence is decide, change, then new
 * customers, so the test has to run in that order too.
 */
async function arrive(
  db: PrismaClient,
  id: string,
  from: number,
  counts: { bad: number; good: number },
  at: Date,
) {
  let n = from;
  const rows: Prisma.ReviewItemCreateManyInput[] = [];
  const push = (bad: boolean) => {
    rows.push({
      id: `${id}g${(n++).toString(36).padStart(4, '0')}`.slice(0, 32),
      clientId: id,
      text: bad
        ? 'Still a long wait for the main course, nearly half an hour on a quiet evening.'
        : 'Served quickly and the staff checked on us twice, no waiting at all.',
      stars: bad ? 2 : 5,
      reviewDate: at,
      source: 'REP_OS_QR',
      fingerprint: `${id}-after-${n}`,
      sentiment: bad ? 'NEGATIVE' : 'POSITIVE',
      issueTags: JSON.stringify(bad ? ['service_speed'] : []),
      praiseTags: JSON.stringify(bad ? [] : ['service_quality']),
      analysisStatus: 'ANALYSED',
      analysisVersion: 2,
      analysedAt: at,
      themesJson: JSON.stringify([
        bad
          ? { key: 'service_speed', label: 'Service speed', kind: 'ISSUE', sentiment: 'NEGATIVE', severity: 'high' }
          : { key: 'service_quality', label: 'Service quality', kind: 'PRAISE', sentiment: 'POSITIVE', severity: 'low' },
      ]),
      responseAction: bad ? 'REPLY_RECOMMENDED' : 'REPLY_OPTIONAL',
      priorityBand: bad ? 'HIGH' : 'LOW',
      triageVersion: 1,
      draftStatus: 'READY',
      draftVersion: 1,
      createdAt: at,
      updatedAt: at,
    });
  };
  for (let i = 0; i < counts.bad; i += 1) push(true);
  for (let i = 0; i < counts.good; i += 1) push(false);
  await db.reviewItem.createMany({ data: rows });
}

const t = translatorFor('en');
/** Every read goes through a fresh request scope, as a page render would. */
const scoped = <T>(fn: () => Promise<T>): Promise<T> => runInRequestScope(fn);

/** The service result, or the service's own message as the failure. */
function must<T>(result: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

describe('the owner action loop, written and read back through RLS', () => {
  let rls: RlsTestDb;
  let db: PrismaClient;
  let actionId = '';
  let seeded = 0;
  /** When the owner said the change was made. The measurement splits here. */
  let changedAt = new Date();

  beforeAll(async () => {
    expect(
      hasRlsRuntimeDb(),
      'REPOS_TEST_DATABASE_URL and REPOS_TEST_APP_DATABASE_URL must be set',
    ).toBe(true);
    rls = await createRlsTestDb('owner-loop-e2e');
    // What the business looked like when the owner opened the app: 18
    // complaints out of 30. The feedback that follows the change arrives later
    // in the test, because that is the order it arrives in life.
    seeded = await seed(
      rls.owner,
      MINE,
      { userId: OWNER, authId: OWNER_AUTH, email: 'loop-owner@example.test' },
      { bad: 18, good: 12 },
    );
    await seed(
      rls.owner,
      THEIRS,
      { userId: STRANGER, authId: STRANGER_AUTH, email: 'loop-stranger@example.test' },
      { bad: 9, good: 9 },
    );
    db = appClient(rls.appUrl, OWNER);
  }, 180_000);

  afterAll(async () => {
    await db?.$disconnect();
    await rls?.dispose();
  });

  // -------------------------------------------------------------------------
  // Notice → decide → do
  // -------------------------------------------------------------------------

  it('finds a real complaint with no decision on it, and offers only the first move', async () => {
    const bundle = await scoped(() => getResponsibility(db, MINE, { t }));
    expect(bundle).not.toBeNull();
    const signal = bundle!.view.unhappy.find((s) => s.themeKey === 'service_speed');
    expect(signal, 'the seeded complaint should be read as a pattern').toBeTruthy();
    expect(signal!.evidenceCount).toBe(18);
    // Nobody has decided anything, so the loop has no action and one move.
    expect(signal!.actionId).toBeNull();
    expect(signal!.actionStatus).toBeNull();
    expect(movesFor(signal!.actionStatus)).toEqual(['HANDLE']);
  });

  it('“I’ll handle this” opens the action and accepts it, in one tap', async () => {
    // Exactly what `ownerDecideAction` does for HANDLE on an undecided theme:
    // open the action from the theme, then accept it in the product's words.
    actionId = must(await scoped(() => createActionForTheme(db, MINE, 'service_speed'))).id;

    const current = await scoped(() => getAction(db, MINE, actionId));
    expect(current!.status).toBe('RECOMMENDED');

    const decided = must(
      await scoped(() =>
        decideAction(db, MINE, actionId, {
          decision: 'ACCEPT',
          description: current!.provenance.recommendationText.trim() || current!.title,
          statusNote: '',
          recordMinute: false,
        }),
      ),
    );
    expect(decided.status).toBe('ACCEPTED');
  });

  it('persists the decision, and a fresh session sees it', async () => {
    // A new connection and a new request scope: nothing cached from the write.
    const fresh = appClient(rls.appUrl, OWNER);
    const stored = await scoped(() => getAction(fresh, MINE, actionId));
    expect(stored!.status).toBe('ACCEPTED');
    expect(stored!.decidedAt).toBeInstanceOf(Date);
    // What was agreed is stored, not an empty field.
    expect(stored!.description.trim().length).toBeGreaterThan(2);
    await fresh.$disconnect();
  });

  it('shows the owner the next real move, and never an illegal one', async () => {
    const bundle = await scoped(() => getResponsibility(db, MINE, { t }));
    const signal = bundle!.view.unhappy.find((s) => s.themeKey === 'service_speed');
    expect(signal!.actionStatus).toBe('ACCEPTED');
    expect(signal!.actionId).toBe(actionId);
    expect(movesFor(signal!.actionStatus)).toEqual(['DONE', 'WATCH']);
  });

  it('“Done” records that the change was made, and it survives a fresh session', async () => {
    must(await scoped(() => moveAction(db, MINE, actionId, { to: 'DONE', note: '', occurredAt: null })));

    const fresh = appClient(rls.appUrl, OWNER);
    const stored = await scoped(() => getAction(fresh, MINE, actionId));
    expect(stored!.status).toBe('DONE');
    expect(stored!.doneAt).toBeInstanceOf(Date);
    changedAt = stored!.doneAt!;
    await fresh.$disconnect();
    // Nothing to press once the change is made: measuring is Headway's job.
    expect(movesFor('DONE')).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Check → learn
  // -------------------------------------------------------------------------

  it('waits for evidence, with the counts, while nothing has arrived since', async () => {
    const view = await scoped(() => getImprovementsView(db, MINE, { t }));
    const open = view!.open.find((a) => a.id === actionId);
    expect(open, 'the change should be on the board while it is being checked').toBeTruthy();
    expect(open!.stage).toBe('DONE');
    expect(open!.awaiting).toEqual({ have: 0, need: 10 });
    // And the action centre files it under "Headway is watching", as a change
    // still COLLECTING the feedback that follows it — with the counts.
    expect(enoughToCheck(open!)).toBe(false);
    const shelves = shelvesFor(view!, t);
    const row = shelves.watching.find((r) => r.key === actionId);
    expect(row?.watch).toBe('COLLECTING');
    expect(row?.awaiting).toEqual({ have: 0, need: 10 });
    // And the row opens the change's own page.
    expect(row?.actionId).toBe(actionId);
  });

  it('associates the feedback that arrives after the change with this action', async () => {
    // New customers, a minute after the change: 3 complaints out of 30.
    await arrive(rls.owner, MINE, seeded, { bad: 3, good: 27 }, new Date(changedAt.getTime() + 60_000));

    // The baseline was frozen when the action was opened; the check reads what
    // arrived after `doneAt`. Both hang off the same provenance.
    const stored = await scoped(() => getAction(db, MINE, actionId));
    expect(stored!.provenance.themeKey).toBe('service_speed');
    expect(stored!.baseline.count).toBe(18);
    expect(stored!.baseline.total).toBe(30);

    const view = await scoped(() => getImprovementsView(db, MINE, { t }));
    const open = view!.open.find((a) => a.id === actionId);
    // A progress figure, present on every made change — see `enoughToCheck`.
    expect(open!.awaiting).toEqual({ have: 30, need: 10 });
    // Enough has arrived to look, so it moves shelves. This is the assertion
    // that caught the action centre reading `awaiting` as a flag.
    expect(enoughToCheck(open!)).toBe(true);
    const shelves = shelvesFor(view!, t);
    const row = shelves.watching.find((r) => r.key === actionId);
    expect(row?.watch).toBe('READY');
    expect(row?.awaiting).toBeUndefined();
  });

  it('measures the before and after from the real rows, and claims no cause', async () => {
    const { measurement: m } = must(await scoped(() => measureClientAction(db, MINE, actionId)));
    // 18 of 30 before, 3 of 30 after.
    expect(m.before.count).toBe(18);
    expect(m.before.total).toBe(30);
    expect(m.after.count).toBe(3);
    expect(m.after.total).toBe(30);
    expect(m.result).toBe('IMPROVED');
    // "after the change", never "because of it" — and the engine's own
    // disclaimer, which says outright that it cannot show a cause, is there.
    const words = JSON.stringify(m);
    expect(words).not.toMatch(CAUSAL);
    expect(words).toContain('cannot show that the change caused the difference');
  });

  it('puts the checked change on the record, with both counts, for a fresh session', async () => {
    const fresh = appClient(rls.appUrl, OWNER);
    const view = await scoped(() => getImprovementsView(fresh, MINE, { t }));
    const checked = view!.checked.find((a) => a.id === actionId);
    expect(checked, 'a measured change belongs on the checked shelf').toBeTruthy();
    expect(checked!.outcome!.beforeCount).toBe(18);
    expect(checked!.outcome!.beforeTotal).toBe(30);
    expect(checked!.outcome!.afterCount).toBe(3);
    expect(checked!.outcome!.afterTotal).toBe(30);
    expect(checked!.outcome!.good).toBe(true);
    // And the shelf row draws those same two counts.
    const row = shelvesFor(view!, t).checked.find((r) => r.key === actionId);
    expect(row!.moved).toEqual({ before: '18/30', after: '3/30', good: true });
    await fresh.$disconnect();
  });

  // -------------------------------------------------------------------------
  // Reconsidering
  // -------------------------------------------------------------------------

  it('lets an owner revisit a decision they declined, without rewriting it', async () => {
    const declinedId = must(await scoped(() => createActionForTheme(db, MINE, 'service_quality'))).id;
    must(
      await scoped(() =>
        decideAction(db, MINE, declinedId, {
          decision: 'DECLINE',
          description: '',
          statusNote: '',
          recordMinute: false,
        }),
      ),
    );
    expect(movesFor('DECLINED')).toEqual(['REVISIT']);

    // What "Revisit" does: a NEW action; the declined row is untouched history.
    const againId = must(await scoped(() => createActionForTheme(db, MINE, 'service_quality'))).id;
    expect(againId).not.toBe(declinedId);
    expect((await scoped(() => getAction(db, MINE, declinedId)))!.status).toBe('DECLINED');
    expect((await scoped(() => getAction(db, MINE, againId)))!.status).toBe('RECOMMENDED');

    // The theme now reports the new action, because DECLINED ranks lowest —
    // so the owner is offered a decision again rather than a dead end.
    const view = await scoped(() => getImprovementsView(db, MINE, { t }));
    const reopened = view!.open.find((a) => a.id === againId);
    expect(reopened, 'the revisited action should be back on the board').toBeTruthy();
    expect(movesFor(reopened!.status)).toEqual(['HANDLE', 'NOT_DOING']);
    expect(view!.notPursued.map((a) => a.id)).toContain(declinedId);
  });

  // -------------------------------------------------------------------------
  // Whose business it is
  // -------------------------------------------------------------------------

  it('never shows one owner another business’s action', async () => {
    const theirs = appClient(rls.appUrl, STRANGER);
    must(await scoped(() => createActionForTheme(theirs, THEIRS, 'service_speed')));
    await theirs.$disconnect();

    // This owner is not a member of THEIRS: RLS returns nothing at all.
    const view = await scoped(() => getImprovementsView(db, THEIRS, { t }));
    const actions = view ? [...view.open, ...view.checked, ...view.notPursued] : [];
    expect(actions).toEqual([]);
  });

  it('refuses to move an action that belongs to another business', async () => {
    const theirs = appClient(rls.appUrl, STRANGER);
    const view = await scoped(() => getImprovementsView(theirs, THEIRS, { t }));
    const theirAction = view!.open[0]!;
    await theirs.$disconnect();

    // Their action id, under this owner's own client id — the shape a forged
    // request takes once it is past the session check.
    const stolen = await scoped(() =>
      moveAction(db, MINE, theirAction.id, { to: 'DONE', note: '', occurredAt: null }),
    );
    expect(stolen.ok).toBe(false);
    // Naming their client id directly: RLS hides the row entirely.
    expect(await scoped(() => getAction(db, THEIRS, theirAction.id))).toBeNull();

    // And their action is exactly as they left it.
    const owner = appClient(rls.appUrl, STRANGER);
    const untouched = await scoped(() => getAction(owner, THEIRS, theirAction.id));
    expect(untouched!.status).toBe('RECOMMENDED');
    await owner.$disconnect();
  });

  it('will not open a loop on a business the caller is not a member of', async () => {
    const opened = await scoped(() => createActionForTheme(db, THEIRS, 'service_speed'));
    expect(opened.ok).toBe(false);
  });
});
