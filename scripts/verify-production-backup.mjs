/**
 * Verifies a folder written by scripts/backup-production.mjs (M23).
 *
 *   node scripts/verify-production-backup.mjs backups/prod-<stamp>
 *
 * Against the LOCAL test cluster only, named by REPOS_TEST_DATABASE_URL (the
 * same variable the test suite uses, so it can never be production):
 *
 *   1. every file re-hashes to the sha256 in the manifest;
 *   2. the repository runbook rebuilds the schema from repo/schema.prisma,
 *      repo/m20/rls.sql and repo/m20/public-gateway.sql into a fresh database,
 *      the data/*.ndjson rows are loaded, and every table's content digest is
 *      compared with the one the backup recorded on the server;
 *   3. the catalog of the rebuilt database (columns, constraints, indexes, RLS,
 *      policies, functions, grants) is compared with the production snapshot.
 *
 * Writes verification.json into the folder and exits non-zero on any mismatch.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] ? resolve(process.argv[2]) : null;
if (!OUT || !existsSync(join(OUT, 'manifest.json'))) {
  console.error('usage: node scripts/verify-production-backup.mjs <backup folder>');
  process.exit(1);
}
const base = (process.env.REPOS_TEST_DATABASE_URL ?? '').trim();
if (!base) {
  console.error('REPOS_TEST_DATABASE_URL is not set. Point it at the LOCAL test cluster.');
  process.exit(1);
}
const baseUrl = new URL(base);
if (!['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)) {
  console.error(`Refusing to verify against a non-local database (${baseUrl.hostname}).`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));
const stamp = OUT.replace(/\\/g, '/').split('/').pop().replace(/^prod-/, '').replace(/-/g, '_');
const dbName = `repos_backup_verify_${stamp}`;
const log = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const report = { verifiedAt: new Date().toISOString(), folder: OUT, database: dbName, checks: {} };

// 1. integrity
const problems = [];
for (const [rel, meta] of Object.entries(manifest.files)) {
  const p = join(OUT, rel);
  if (!existsSync(p)) problems.push(`${rel}: missing`);
  else if (sha256(p) !== meta.sha256) problems.push(`${rel}: sha256 differs`);
}
report.checks.integrity = { files: Object.keys(manifest.files).length, problems };
log(`integrity: ${problems.length} problems`);

// 2. rebuild
const admin = new PrismaClient({ datasourceUrl: base });
try {
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
} finally {
  await admin.$disconnect();
}
const target = new URL(base);
target.pathname = `/${dbName}`;
target.searchParams.set('schema', 'public');
const url = target.toString();
const prismaCli = join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');
const schemaPath = join(OUT, 'repo', 'schema.prisma');
const env = { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url };
const run = (args) => execFileSync(process.execPath, [prismaCli, ...args], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
run(['db', 'push', '--skip-generate', '--schema', schemaPath]);
run(['db', 'execute', '--file', join(OUT, 'repo', 'm20', 'rls.sql'), '--schema', schemaPath]);
run(['db', 'execute', '--file', join(OUT, 'repo', 'm20', 'public-gateway.sql'), '--schema', schemaPath]);
log('schema rebuilt from the runbook');

// Foreign keys decide this order. Two names were missing and the script threw
// rather than restoring: ServiceContinuationRequest (M28) and AiUsageDay (M30).
// AiUsageDay references nothing — it is a per-day token counter holding no
// customer data. KitOrder (M33) references Client and holds no customer data
// either: a business, how many cards it asked for, and what that came to.
const ORDER = ['User', 'Client', 'Membership', 'Invitation', 'Commercial', 'FeedbackGateway', 'BusinessContext', 'VoiceProfile', 'BusinessPolicy', 'Competitor', 'KitConfig', 'Minute', 'TimeEntry', 'AppSetting', 'Snapshot', 'ReviewItem', 'ImprovementAction', 'ServiceContinuationRequest', 'AiUsageDay', 'KitOrder'];
const unknown = Object.keys(manifest.tables).filter((t) => !ORDER.includes(t));
if (unknown.length) throw new Error(`restore order does not know: ${unknown.join(', ')}`);

const db = new PrismaClient({ datasourceUrl: url });
const q = (sql, ...params) => db.$queryRawUnsafe(sql, ...params);
try {
  for (const t of ORDER) {
    if (!manifest.tables[t]) continue;
    const lines = readFileSync(join(OUT, manifest.tables[t].file), 'utf8').split('\n').filter((l) => l.length > 0);
    if (lines.length === 0) continue;
    await db.$executeRawUnsafe(`INSERT INTO public."${t}" SELECT * FROM jsonb_populate_recordset(NULL::public."${t}", $1::jsonb)`, `[${lines.join(',')}]`);
  }
  const tables = {};
  let allMatch = true;
  for (const [t, meta] of Object.entries(manifest.tables)) {
    const d = (await q(`SELECT count(*)::text AS n, md5(coalesce(string_agg(to_jsonb(t)::text, chr(10) ORDER BY to_jsonb(t)::text), '')) AS d FROM public."${t}" t`))[0];
    const match = Number(d.n) === meta.rows && d.d === meta.contentMd5;
    if (!match) allMatch = false;
    tables[t] = { rows: Number(d.n), expected: meta.rows, match };
  }
  report.checks.data = { allMatch, tables };
  log(`data: ${allMatch ? 'every table matches' : 'MISMATCH'}`);

  // 3. catalog
  const local = {
    columns: await q(`SELECT table_name, column_name, data_type, udt_name, character_maximum_length, numeric_precision, datetime_precision, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY 1,2`),
    constraints: await q(`SELECT conrelid::regclass::text AS "table", conname, contype, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2`),
    indexes: await q(`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2`),
    rls: await q(`SELECT c.relname AS "table", c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' ORDER BY 1`),
    policies: await q(`SELECT tablename, policyname, permissive, roles::text AS roles, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname`),
    functions: await q(`SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef AS security_definer, p.proconfig::text AS config, pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('app','public') ORDER BY 1,2,3`),
    tableGrants: await q(`SELECT grantee, table_schema, table_name, privilege_type FROM information_schema.role_table_grants WHERE table_schema IN ('public','app') AND grantee IN ('repos_app','repos_public') ORDER BY 1,2,3,4`),
    columnGrants: await q(`SELECT grantee, table_name, column_name, privilege_type FROM information_schema.column_privileges WHERE table_schema='public' AND grantee IN ('repos_app','repos_public') ORDER BY 1,2,3,4`),
    routineGrants: await q(`SELECT grantee, routine_schema, routine_name, privilege_type FROM information_schema.role_routine_grants WHERE routine_schema IN ('app','public') AND grantee IN ('repos_app','repos_public') ORDER BY 1,2,3,4`),
  };
  const KEY = {
    columns: (r) => `${r.table_name}.${r.column_name}`,
    constraints: (r) => `${r.table}.${r.conname}`,
    indexes: (r) => `${r.tablename}.${r.indexname}`,
    rls: (r) => r.table,
    policies: (r) => `${r.tablename}.${r.policyname}`,
    functions: (r) => `${r.schema}.${r.name}(${r.args})`,
    tableGrants: (r) => `${r.grantee}:${r.table_schema}.${r.table_name}:${r.privilege_type}`,
    columnGrants: (r) => `${r.grantee}:${r.table_name}.${r.column_name}:${r.privilege_type}`,
    routineGrants: (r) => `${r.grantee}:${r.routine_schema}.${r.routine_name}:${r.privilege_type}`,
  };
  const strip = (k, r) => {
    const copy = { ...r };
    delete copy.ordinal_position;
    delete copy.owner;
    delete copy.acl;
    delete copy.is_grantable;
    delete copy.language;
    if (k === 'functions' && typeof copy.definition === 'string') copy.definition = copy.definition.replace(/\r\n/g, '\n');
    return copy;
  };
  const catalog = {};
  let catalogClean = true;
  for (const k of Object.keys(KEY)) {
    const prodRows = JSON.parse(readFileSync(join(OUT, 'schema', `${k}.json`), 'utf8')).filter((r) => !('grantee' in r) || r.grantee === 'repos_app' || r.grantee === 'repos_public');
    const a = new Map(prodRows.map((r) => [KEY[k](r), JSON.stringify(strip(k, r))]));
    const b = new Map(local[k].map((r) => [KEY[k](r), JSON.stringify(strip(k, r))]));
    const missing = [...a.keys()].filter((key) => !b.has(key));
    const extra = [...b.keys()].filter((key) => !a.has(key));
    const changed = [...a.keys()].filter((key) => b.has(key) && a.get(key) !== b.get(key));
    if (missing.length || extra.length || changed.length) catalogClean = false;
    catalog[k] = { prod: a.size, local: b.size, missing, extra, changed };
  }
  report.checks.catalog = { clean: catalogClean, categories: catalog };
  log(`catalog: ${catalogClean ? 'identical' : 'differences (see verification.json)'}`);
  report.pass = problems.length === 0 && allMatch;
} finally {
  await db.$disconnect();
}
writeFileSync(join(OUT, 'verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, integrity: report.checks.integrity.problems, data: report.checks.data.allMatch, catalog: Object.fromEntries(Object.entries(report.checks.catalog.categories).map(([k, v]) => [k, `${v.prod}/${v.local}${v.missing.length ? ` -${v.missing.length}` : ''}${v.extra.length ? ` +${v.extra.length}` : ''}${v.changed.length ? ` ~${v.changed.length}` : ''}`])) }, null, 2));
process.exit(report.pass ? 0 : 1);
