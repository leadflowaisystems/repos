/**
 * RE-READ STORED FEEDBACK AFTER A READER UPGRADE — once, right after a deploy.
 *
 *   npx tsx scripts/reread-after-upgrade.ts                  dry run: how many rows each business has waiting
 *   npx tsx scripts/reread-after-upgrade.ts --yes            re-read every business
 *   npx tsx scripts/reread-after-upgrade.ts --yes --client <id>
 *
 * When ANALYSIS_VERSION moves, every stored row becomes "waiting to be read
 * again". The pipeline catches up by itself, a few hundred rows per page view
 * or submission, but until it has, those rows are out of every count. This
 * does the whole catch-up at once, before owners arrive.
 *
 * DETERMINISTIC ONLY. A re-read never goes to an AI provider: the customer's
 * words have not changed. Rows nobody has read yet are left alone for the
 * pipeline, which reads them first and may give them the second reader.
 * Only the analysis columns are written; the customer's words never are.
 *
 * The connection is `.env.local`'s DIRECT_DATABASE_URL; nothing is printed
 * about it beyond its host. Nothing is written without --yes.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const onlyClient = args.includes('--client') ? args[args.indexOf('--client') + 1] : null;

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const url = env.DIRECT_DATABASE_URL ?? '';
if (!url) {
  console.error('DIRECT_DATABASE_URL is missing from .env.local.');
  process.exit(2);
}
// Prisma reads these when the client is constructed; set before importing it.
process.env.DATABASE_URL = url;
process.env.DIRECT_DATABASE_URL = url;
process.env.REPOS_AI_DISABLED = '1';

(async () => {
  const { PrismaClient } = await import('@prisma/client');
  const { ANALYSIS_VERSION } = await import('@/lib/analysis/normalize');
  const { analyseClientFeedback } = await import('@/lib/feedback/analysis');
  const { triageClientFeedback } = await import('@/lib/feedback/replies');
  const { runInRequestScope } = await import('@/lib/request-cache');

  const db = new PrismaClient({ datasources: { db: { url } } });
  console.log(`target: ${new URL(url).hostname} — reader version ${ANALYSIS_VERSION}${yes ? '' : ' (dry run)'}`);
  try {
    const waiting = await db.reviewItem.groupBy({
      by: ['clientId'],
      where: { analysisStatus: 'ANALYSED', analysisVersion: { lt: ANALYSIS_VERSION }, ...(onlyClient ? { clientId: onlyClient } : {}) },
      _count: { _all: true },
    });
    console.log(`${waiting.length} business(es) with rows to re-read; ${waiting.reduce((n, w) => n + w._count._all, 0)} rows`);
    if (!yes) return;
    for (const w of waiting) {
      let total = 0;
      for (let round = 0; round < 50; round += 1) {
        const run = await runInRequestScope(() =>
          analyseClientFeedback(db, w.clientId, { useAi: false, onlyReRead: true, limit: 200 }),
        );
        if (!run.ok) {
          console.error(`  ${w.clientId}: ${run.message}`);
          break;
        }
        total += run.data.analysed;
        if (run.data.needsRetry > 0) console.error(`  ${w.clientId}: ${run.data.needsRetry} row(s) failed and stay retryable`);
        if (run.data.analysed === 0) break;
      }
      await runInRequestScope(() => triageClientFeedback(db, w.clientId));
      const left = await db.reviewItem.count({ where: { clientId: w.clientId, analysisStatus: 'ANALYSED', analysisVersion: { lt: ANALYSIS_VERSION } } });
      console.log(`  ${w.clientId}: re-read ${total}, still waiting ${left}`);
    }
  } finally {
    await db.$disconnect();
  }
})().catch((error) => {
  console.error(error instanceof Error ? error.message.slice(0, 300) : 'failed');
  process.exit(1);
});
