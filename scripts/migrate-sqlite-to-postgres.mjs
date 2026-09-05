#!/usr/bin/env node
/**
 * SQLITE -> POSTGRESQL DATA MIGRATION (M20 Stage 6B).
 *
 * A data-preservation operation, not an application transformation. Nothing
 * here analyses, recomputes, redacts, reclassifies or regenerates anything: a
 * row is read, its values are coerced to the types the target column actually
 * declares, and it is written. Feedback text, ratings, snapshots, minutes,
 * actions and every JSON blob arrive byte-identical.
 *
 * THE SOURCE IS OPENED READ-ONLY. Not by convention — by the driver, which
 * physically refuses a write on this handle. The SQLite database is the
 * canonical record of four real businesses and it is not this script's to
 * touch, even by accident.
 *
 * WHAT IT DOES NOT CARRY
 *   User, Membership and Invitation have no SQLite source: they arrived with
 *   M20 and there is nothing to migrate into them. They stay empty rather than
 *   being invented. A consequence worth stating plainly: the migrated clients
 *   have no members, so nobody can open them until an administrator is
 *   bootstrapped and memberships are created deliberately.
 *
 * DEFAULTS, NOT GUESSES
 *   Four target columns postdate the source: Client.subscriptionStatus,
 *   Client.setupCompletedAt, ReviewItem.dimensionsJson and
 *   ReviewItem.signalsJson. Each is simply omitted from the insert so the
 *   column default applies. No business value is fabricated.
 *
 * IDEMPOTENT. Rows already present by primary key are skipped, so a re-run
 * after a partial failure completes the job rather than duplicating it.
 *
 * THIS IS NOT A STARTUP OR SEED SCRIPT. It is a one-off migration utility,
 * deliberately absent from package.json so that no `npm run` invocation can
 * reach it. It was used once, on 2026-09-04, to move 384 rows from the
 * pre-M20 SQLite database into the Supabase production database. Running it
 * again is safe (it skips rows that already exist by primary key) but it
 * should not be needed, and it must never be wired into a deploy step.
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-postgres.mjs --dry-run
 *   node scripts/migrate-sqlite-to-postgres.mjs --apply
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const SOURCE = 'data/repos.db';

/**
 * Parents before children. ReviewItem is last because it references both
 * Client and Snapshot; getting this order wrong is a foreign-key violation,
 * not a silent corruption, but it is still cheaper to be right.
 */
const ORDER = [
  'Client',
  'Snapshot',
  'BusinessContext',
  'BusinessPolicy',
  'Competitor',
  'FeedbackGateway',
  'ImprovementAction',
  'KitConfig',
  'Minute',
  'TimeEntry',
  'VoiceProfile',
  'ReviewItem',
  'AppSetting',
];

/** Prisma model accessor for a table name. */
const model = (t) => t.charAt(0).toLowerCase() + t.slice(1);

function loadEnvLocal() {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

/** Never let a connection string reach a log. */
const scrub = (s) => String(s).replace(/postgres(ql)?:\/\/[^\s"']+/gi, '[redacted]');

async function main() {
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run') || !apply;

  loadEnvLocal();
  const url = process.env.DIRECT_DATABASE_URL;
  if (!url || !url.startsWith('postgres')) {
    console.error('DIRECT_DATABASE_URL must point at the PostgreSQL target.');
    process.exit(1);
  }

  const src = new DatabaseSync(SOURCE, { readOnly: true });
  const db = new PrismaClient({ datasources: { db: { url } } });

  try {
    // The target's own declared types drive every conversion, so the script
    // cannot drift from the schema it is writing into.
    const cols = await db.$queryRaw`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `;
    const typeOf = new Map(cols.map((c) => [`${c.table_name}.${c.column_name}`, c.data_type]));

    const plan = [];
    for (const table of ORDER) {
      const rows = src.prepare(`SELECT * FROM "${table}"`).all();
      const sourceCount = rows.length;
      const before = await db[model(table)].count();

      // A source column with nowhere to land is the one failure that could
      // pass unnoticed: every count would still match while a field quietly
      // vanished. So it aborts rather than skipping. Checked once per table
      // against the first row, because SQLite columns are fixed per table.
      if (rows.length > 0) {
        const unmapped = Object.keys(rows[0]).filter((k) => !typeOf.has(`${table}.${k}`));
        if (unmapped.length > 0) {
          throw new Error(
            `${table}: no destination column for ${unmapped.join(', ')}. ` +
              'Refusing to migrate rather than discard data silently.',
          );
        }
      }

      // Coerce per target column type. SQLite has no boolean or date type:
      // Prisma stored booleans as 0/1 and DateTimes as epoch milliseconds.
      const data = rows.map((row) => {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
          const t = typeOf.get(`${table}.${k}`);
          if (v === null) { out[k] = null; continue; }
          if (t === 'boolean') out[k] = v === 1 || v === true || v === '1';
          else if (t.startsWith('timestamp')) out[k] = new Date(Number(v));
          else if (t === 'integer' || t === 'bigint') out[k] = Number(v);
          else if (t === 'double precision' || t === 'numeric' || t === 'real') out[k] = Number(v);
          else out[k] = v; // text, including every *Json column, verbatim
        }
        return out;
      });

      plan.push({ table, sourceCount, before, data });
    }

    console.log('=== PREFLIGHT ===');
    console.log('  table                 source   target(before)');
    for (const p of plan) {
      console.log(`  ${p.table.padEnd(20)} ${String(p.sourceCount).padStart(6)}   ${String(p.before).padStart(6)}`);
    }
    const totalSource = plan.reduce((n, p) => n + p.sourceCount, 0);
    console.log(`  ${'TOTAL'.padEnd(20)} ${String(totalSource).padStart(6)}`);

    if (dryRun) {
      console.log('\nDRY RUN — nothing was written.');
      return;
    }

    // One transaction: a half-migrated production database is worse than a
    // failed one, because the second attempt then has to reason about what
    // survived.
    console.log('\n=== APPLYING (single transaction) ===');
    await db.$transaction(
      async (tx) => {
        for (const p of plan) {
          if (p.data.length === 0) continue;
          const res = await tx[model(p.table)].createMany({
            data: p.data,
            skipDuplicates: true,
          });
          console.log(`  ${p.table.padEnd(20)} inserted ${res.count}`);
        }
      },
      { timeout: 120_000, maxWait: 30_000 },
    );

    console.log('\n=== POST-INSERT COUNTS ===');
    let ok = true;
    for (const p of plan) {
      const after = await db[model(p.table)].count();
      const match = after === p.sourceCount;
      if (!match) ok = false;
      console.log(
        `  ${p.table.padEnd(20)} source=${String(p.sourceCount).padStart(4)}  target=${String(after).padStart(4)}  ${match ? 'MATCH' : '*** MISMATCH ***'}`,
      );
    }
    console.log(ok ? '\nAll table counts match.' : '\n*** COUNT MISMATCH — investigate before proceeding ***');
    if (!ok) process.exitCode = 1;
  } catch (e) {
    console.error('MIGRATION FAILED:', scrub(e.message).split('\n')[0]);
    process.exitCode = 1;
  } finally {
    src.close();
    await db.$disconnect();
  }
}

await main();
