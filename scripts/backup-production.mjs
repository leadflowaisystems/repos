/**
 * A full, read-only backup of the production database (M23).
 *
 *   node scripts/backup-production.mjs
 *
 * Reads DIRECT_DATABASE_URL from .env.local — the owner role over the session
 * pooler — and writes backups/prod-<stamp>/ containing:
 *
 *   data/public.<Table>.ndjson   one JSON object per row, taken inside ONE
 *                                REPEATABLE READ, READ ONLY transaction, with
 *                                a server-side md5 of every table recorded in
 *                                the manifest so a restore can be checked
 *   schema/*.json                columns, constraints, indexes, RLS flags,
 *                                policies, function definitions, grants, roles
 *   auth/auth.*.ndjson           Supabase Auth users and identities
 *   db/*.dump | *.sql            pg_dump of schemas public and app, when a
 *                                pg_dump matching the server's major version is
 *                                available (see PG_BIN below)
 *   repo/                        the schema.prisma and SQL files at this commit
 *   manifest.json                everything above, git HEAD, and a sha256 per file
 *
 * Nothing is written to the database. No URL and no password is printed.
 * Verify the result with scripts/verify-production-backup.mjs.
 *
 * The PostgreSQL 16 client cannot dump a PostgreSQL 17 server. Point PG_BIN at
 * a matching client (pgAdmin 4 ships one under its `runtime` folder) or let the
 * script look in the usual places.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const two = (n) => String(n).padStart(2, '0');
const at = new Date();
const STAMP = `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}-${two(at.getHours())}${two(at.getMinutes())}${two(at.getSeconds())}`;
const OUT = resolve(ROOT, 'backups', `prod-${STAMP}`);
const log = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

function loadEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function findPgBin(majorVersion) {
  const candidates = [
    process.env.PG_BIN,
    `C:/Program Files/PostgreSQL/${majorVersion}/bin`,
    'C:/Program Files/pgAdmin 4/runtime',
    `/usr/lib/postgresql/${majorVersion}/bin`,
    '/opt/homebrew/opt/libpq/bin',
  ].filter(Boolean);
  for (const dir of candidates) {
    const exe = join(dir, process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump');
    if (!existsSync(exe)) continue;
    const version = spawnSync(exe, ['--version'], { encoding: 'utf8' }).stdout ?? '';
    if (version.includes(` ${majorVersion}.`)) return { dir, exe, version: version.trim() };
  }
  return null;
}

const env = loadEnv(join(ROOT, '.env.local'));
const url = process.env.DIRECT_DATABASE_URL ?? env.DIRECT_DATABASE_URL;
if (!url) {
  console.error('DIRECT_DATABASE_URL is not set (in the environment or .env.local).');
  process.exit(1);
}
const u = new URL(url);
const conn = { host: u.hostname, port: u.port || '5432', user: decodeURIComponent(u.username), database: u.pathname.slice(1) || 'postgres' };
if (existsSync(OUT)) {
  console.error(`${OUT} already exists.`);
  process.exit(1);
}
for (const d of ['db', 'data', 'auth', 'schema', 'repo/m20', 'repo/m21', 'repo/m23', 'repo/packs']) mkdirSync(join(OUT, d), { recursive: true });

const manifest = { kind: 'repos-production-backup', takenAt: at.toISOString(), folder: OUT, database: { ...conn } };
const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};
manifest.git = { head: git(['rev-parse', 'HEAD']), branch: git(['rev-parse', '--abbrev-ref', 'HEAD']), clean: (git(['status', '--porcelain']) ?? '').length === 0 };
manifest.environment = { envLocalVariableNames: Object.keys(env) };

const db = new PrismaClient({ datasourceUrl: url });
const q = (tx, sql, ...params) => tx.$queryRawUnsafe(sql, ...params);
const DIGEST = (schema, t) => `SELECT count(*)::text AS n, md5(coalesce(string_agg(to_jsonb(t)::text, chr(10) ORDER BY to_jsonb(t)::text), '')) AS d FROM "${schema}"."${t}" t`;
let serverMajor = null;
try {
  await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const head = (await q(tx, `SELECT version() AS version, current_setting('server_version') AS server_version, current_setting('transaction_read_only') AS ro, now()::text AS now, pg_current_wal_lsn()::text AS wal_lsn, pg_current_snapshot()::text AS snapshot`))[0];
      if (head.ro !== 'on') throw new Error('transaction is not read only');
      serverMajor = Number(String(head.server_version).split('.')[0]);
      manifest.snapshot = head;
      log(`snapshot at ${head.wal_lsn}, server ${head.server_version}`);

      const tables = await q(tx, `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`);
      manifest.tables = {};
      for (const { table_name: t } of tables) {
        const pk = await q(tx, `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = ('public."' || $1 || '"')::regclass AND i.indisprimary ORDER BY array_position(i.indkey, a.attnum)`, t);
        const order = pk.length ? pk.map((c) => `"${c.attname}"`).join(', ') : 'to_jsonb(t)::text';
        const rows = await q(tx, `SELECT to_jsonb(t)::text AS j FROM public."${t}" t ORDER BY ${order}`);
        const dig = (await q(tx, DIGEST('public', t)))[0];
        writeFileSync(join(OUT, 'data', `public.${t}.ndjson`), rows.map((r) => r.j).join('\n') + (rows.length ? '\n' : ''));
        manifest.tables[t] = { rows: Number(dig.n), contentMd5: dig.d, primaryKey: pk.map((c) => c.attname), file: `data/public.${t}.ndjson` };
      }
      log(`tables: ${Object.keys(manifest.tables).length}, rows: ${Object.values(manifest.tables).reduce((a, b) => a + b.rows, 0)}`);

      const schema = {};
      schema.columns = await q(tx, `SELECT table_name, ordinal_position, column_name, data_type, udt_name, character_maximum_length, numeric_precision, datetime_precision, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`);
      schema.constraints = await q(tx, `SELECT conrelid::regclass::text AS "table", conname, contype, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2`);
      schema.indexes = await q(tx, `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2`);
      schema.rls = await q(tx, `SELECT c.relname AS "table", c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' ORDER BY 1`);
      schema.policies = await q(tx, `SELECT tablename, policyname, permissive, roles::text AS roles, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname`);
      schema.functions = await q(tx, `SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef AS security_definer, p.proconfig::text AS config, pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('app','public') ORDER BY 1,2,3`);
      schema.tableGrants = await q(tx, `SELECT grantee, table_schema, table_name, privilege_type FROM information_schema.role_table_grants WHERE table_schema IN ('public','app') AND grantee IN ('repos_app','repos_public') ORDER BY 1,2,3,4`);
      schema.columnGrants = await q(tx, `SELECT grantee, table_name, column_name, privilege_type FROM information_schema.column_privileges WHERE table_schema='public' AND grantee IN ('repos_app','repos_public') ORDER BY 1,2,3,4`);
      schema.routineGrants = await q(tx, `SELECT grantee, routine_schema, routine_name, privilege_type FROM information_schema.role_routine_grants WHERE routine_schema IN ('app','public') AND grantee IN ('repos_app','repos_public') ORDER BY 1,2,3,4`);
      schema.roles = await q(tx, `SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname IN ('repos_app','repos_public','postgres','anon','authenticated','service_role','supabase_admin') ORDER BY 1`);
      schema.extensions = await q(tx, `SELECT extname, extversion FROM pg_extension ORDER BY 1`);
      for (const [k, v] of Object.entries(schema)) writeFileSync(join(OUT, 'schema', `${k}.json`), JSON.stringify(v, null, 2));
      manifest.schemaSummary = { tables: schema.rls.length, rlsEnabledAndForced: schema.rls.filter((r) => r.enabled && r.forced).length, policies: schema.policies.length, appFunctions: schema.functions.filter((f) => f.schema === 'app').length };

      manifest.auth = {};
      for (const t of ['users', 'identities']) {
        try {
          const rows = await q(tx, `SELECT to_jsonb(t)::text AS j FROM auth."${t}" t ORDER BY id`);
          const dig = (await q(tx, DIGEST('auth', t)))[0];
          writeFileSync(join(OUT, 'auth', `auth.${t}.ndjson`), rows.map((r) => r.j).join('\n') + (rows.length ? '\n' : ''));
          manifest.auth[t] = { rows: Number(dig.n), contentMd5: dig.d, file: `auth/auth.${t}.ndjson` };
        } catch (e) {
          manifest.auth[t] = { error: String(e.message).split('\n')[0] };
        }
      }
    },
    { isolationLevel: 'RepeatableRead', maxWait: 30_000, timeout: 600_000 },
  );
} finally {
  await db.$disconnect();
}

// pg_dump, when a client of the server's major version is at hand.
const pg = serverMajor ? findPgBin(serverMajor) : null;
if (pg) {
  const pgEnv = { ...process.env, PGHOST: conn.host, PGPORT: conn.port, PGUSER: conn.user, PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: conn.database, PGSSLMODE: 'require' };
  const dump = (name, args) => {
    const r = spawnSync(pg.exe, args, { env: pgEnv, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    writeFileSync(join(OUT, 'db', `${name}.stderr.txt`), r.stderr ?? '');
    log(`pg_dump ${name}: exit ${r.status}`);
    return { exit: r.status, ok: r.status === 0 };
  };
  manifest.pgDump = { version: pg.version };
  manifest.pgDump.custom = dump('public_app.custom', ['--format=custom', '--schema=public', '--schema=app', '--lock-wait-timeout=60000', `--file=${join(OUT, 'db', 'public_app.dump')}`]);
  manifest.pgDump.plain = dump('public_app.plain', ['--format=plain', '--schema=public', '--schema=app', '--lock-wait-timeout=60000', `--file=${join(OUT, 'db', 'public_app.sql')}`]);
  manifest.pgDump.authData = dump('auth.data_only', ['--format=plain', '--data-only', '--table=auth.users', '--table=auth.identities', `--file=${join(OUT, 'db', 'auth.users_identities.data-only.sql')}`]);
} else {
  manifest.pgDump = { skipped: `no pg_dump for PostgreSQL ${serverMajor} found; set PG_BIN` };
  log(manifest.pgDump.skipped);
}

for (const f of ['prisma/schema.prisma', 'prisma/m20/rls.sql', 'prisma/m20/public-gateway.sql', 'prisma/m20/README.md', 'prisma/m21/migration.sql', 'prisma/m23/migration.sql', 'prisma/m23/backfill.sql', 'package.json']) {
  const src = join(ROOT, f);
  if (!existsSync(src)) continue;
  const dest = join(OUT, 'repo', f.replace(/^prisma\//, ''));
  mkdirSync(resolve(dest, '..'), { recursive: true });
  copyFileSync(src, dest);
}
for (const f of readdirSync(join(ROOT, 'packs'))) copyFileSync(join(ROOT, 'packs', f), join(OUT, 'repo', 'packs', f));

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
manifest.files = {};
for (const p of walk(OUT).sort()) {
  const rel = p.slice(OUT.length + 1).replace(/\\/g, '/');
  if (rel === 'manifest.json') continue;
  manifest.files[rel] = { bytes: statSync(p).size, sha256: sha256File(p) };
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
writeFileSync(join(OUT, 'manifest.sha256'), `${sha256File(join(OUT, 'manifest.json'))}  manifest.json\n`);
log(`wrote ${Object.keys(manifest.files).length} files -> ${OUT}`);
console.log(`\nNow verify it:\n  node scripts/verify-production-backup.mjs "${OUT}"\n`);
