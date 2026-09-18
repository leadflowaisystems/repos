import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRlsTestDb, hasRlsRuntimeDb, type RlsTestDb } from './helpers/rls-db';
import { runInRequestScope } from '@/lib/request-cache';
import { createActionForTheme, decideAction, getAction, moveAction } from '@/lib/improve/service';
import { measureReadyActions } from '@/lib/improve/auto-measure';

/**
 * HEADWAY CHECKS A CHANGE ITSELF, ONCE ENOUGH FEEDBACK HAS ARRIVED.
 *
 * The final experience pass wired the existing measurement into the existing
 * post-response pipeline (`improve/auto-measure.ts`, called from
 * `pipeline/trigger.ts`). Proven here against a real Postgres with `rls.sql`
 * applied, through the same kind of handle the trigger uses: the runtime role
 * scoped to ONE client and no person.
 */

const ROOT = resolve(__dirname, '..');
const DAY = 86_400_000;
const OWNER = 'usautoowner0000000001';
const OWNER_AUTH = '66666666-6666-4666-8666-666666666661';
const MINE = 'clautomine0000000001';
const THEIRS = 'clautotheirs00000001';

const scoped = <T>(fn: () => Promise<T>): Promise<T> => runInRequestScope(fn);
function must<T>(result: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

function handle(appUrl: string, setting: 'app.user_id' | 'app.service_client_id', value: string): PrismaClient {
  const base = new PrismaClient({ datasources: { db: { url: appUrl } } });
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config(${setting}, ${value}, TRUE)`,
            query(args),
          ]);
          return result as unknown;
        },
      },
    },
  }) as unknown as PrismaClient;
}

function feedback(id: string, prefix: string, at: Date, counts: { bad: number; good: number }): Prisma.ReviewItemCreateManyInput[] {
  const rows: Prisma.ReviewItemCreateManyInput[] = [];
  for (let i = 0; i < counts.bad + counts.good; i += 1) {
    const bad = i < counts.bad;
    rows.push({
      id: `${id}${prefix}${i.toString(36).padStart(3, '0')}`.slice(0, 32),
      clientId: id,
      text: bad ? 'Waited almost forty minutes for the main course.' : 'Quick friendly service, everything was hot.',
      stars: bad ? 2 : 5,
      reviewDate: at,
      source: 'REP_OS_QR',
      fingerprint: `${id}-${prefix}-${i}`,
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
      triageVersion: 1,
      createdAt: at,
      updatedAt: at,
    });
  }
  return rows;
}

describe('the pipeline measures a made change on its own', () => {
  let rls: RlsTestDb;
  let owner: PrismaClient;
  let pipeline: PrismaClient;
  let actionId = '';
  let doneAt = new Date();

  beforeAll(async () => {
    expect(hasRlsRuntimeDb(), 'REPOS_TEST_DATABASE_URL and REPOS_TEST_APP_DATABASE_URL must be set').toBe(true);
    rls = await createRlsTestDb('auto-measure-e2e');
    for (const id of [MINE, THEIRS]) {
      await rls.owner.client.create({
        data: { id, businessName: `Auto ${id}`, vertical: 'restaurant', status: 'ACTIVE', subscriptionStatus: 'ACTIVE' },
      });
      await rls.owner.snapshot.create({
        data: { clientId: id, label: 'Check-in', capturedAt: new Date(Date.now() - 60 * DAY), rating: 3.9, reviewCount: 30 },
      });
      await rls.owner.reviewItem.createMany({ data: feedback(id, 'b', new Date(Date.now() - 40 * DAY), { bad: 18, good: 12 }) });
    }
    await rls.owner.user.create({ data: { id: OWNER, email: 'auto-owner@example.test', authProviderId: OWNER_AUTH } });
    await rls.owner.membership.create({ data: { userId: OWNER, clientId: MINE, role: 'BUSINESS_OWNER', status: 'ACTIVE' } });
    owner = handle(rls.appUrl, 'app.user_id', OWNER);
    pipeline = handle(rls.appUrl, 'app.service_client_id', MINE);

    // The owner's side, as the product does it: I'll handle this, then Done.
    actionId = must(await scoped(() => createActionForTheme(owner, MINE, 'service_speed'))).id;
    must(
      await scoped(() =>
        decideAction(owner, MINE, actionId, { decision: 'ACCEPT', description: 'Second server at lunch', statusNote: '', recordMinute: false }),
      ),
    );
    must(await scoped(() => moveAction(owner, MINE, actionId, { to: 'DONE', note: '', occurredAt: null })));
    doneAt = (await scoped(() => getAction(owner, MINE, actionId)))!.doneAt!;
  }, 240_000);

  afterAll(async () => {
    await Promise.all([owner?.$disconnect(), pipeline?.$disconnect()]);
    await rls?.dispose();
  });

  it('waits while too little has arrived since the change', async () => {
    expect(await measureReadyActions(pipeline, MINE)).toEqual({ measured: [] });
    expect((await rls.owner.improvementAction.findUniqueOrThrow({ where: { id: actionId } })).status).toBe('DONE');
  });

  it('measures it once enough new feedback has come in — with no person in the loop', async () => {
    await rls.owner.reviewItem.createMany({
      data: feedback(MINE, 'a', new Date(doneAt.getTime() + 60_000), { bad: 3, good: 27 }),
    });
    expect(await measureReadyActions(pipeline, MINE)).toEqual({ measured: [actionId] });
    const stored = await rls.owner.improvementAction.findUniqueOrThrow({ where: { id: actionId } });
    expect(stored.status).toBe('MEASURED');
    expect(stored.measuredAt).toBeInstanceOf(Date);
  });

  it('does nothing the second time: nothing is left waiting', async () => {
    expect(await measureReadyActions(pipeline, MINE)).toEqual({ measured: [] });
  });

  it('cannot see or measure another business from this business’s run', async () => {
    const theirs = await pipeline.improvementAction.count({ where: { clientId: THEIRS } });
    expect(theirs).toBe(0);
    expect(await measureReadyActions(pipeline, THEIRS)).toEqual({ measured: [] });
  });

  it('is wired into both moments the pipeline runs, after the response', () => {
    const trigger = readFileSync(join(ROOT, 'src', 'lib', 'pipeline', 'trigger.ts'), 'utf8');
    expect(trigger.match(/await measureReadyActions\(db, clientId\);/g)?.length).toBe(2);
    expect(trigger).toContain('after(run);');
    const auto = readFileSync(join(ROOT, 'src', 'lib', 'improve', 'auto-measure.ts'), 'utf8');
    expect(auto).toContain("where: { clientId, status: 'DONE' }");
    expect(auto).toContain("p.action.status === 'DONE' && p.canMeasure");
  });
});
