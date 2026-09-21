/**
 * THE SIX VERTICAL DEMO WORKSPACES — provision or check them.
 *
 *   Synthetic demo data for product evaluation.
 *
 * Run through `scripts/provision-demo-verticals.mjs`, which decides WHICH
 * database this is (a verified backup of it first, or a loopback rehearsal) and
 * hands it over as DATABASE_URL. Run directly only against a local database.
 *
 *   npx tsx scripts/demo-verticals.ts --admin-email <admin>              dry run
 *   npx tsx scripts/demo-verticals.ts --admin-email <admin> --yes        provision
 *       [--only clinic,gym]     just these demo keys
 *       [--reseed salon]        rebuild these demos' stories (business, page and login kept)
 *
 * Idempotent: a second run creates nothing. Demo logins are created only when
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set; each new password is
 * written to `secrets/demo-logins.json` (git-ignored) and never printed.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createTempIdentity, deleteIdentity, isAccountAccessConfigured } from '@/lib/auth/supabase-admin';
import { getPublicBaseUrl } from '@/lib/gateway/service';
import { TOKEN_ALPHABET } from '@/lib/tokens';
import { provisionDemoWorkspaces, type IdentityProvider } from './demo/provision';
import { DEMO_WORKSPACES } from './demo/verticals';

const CREDENTIALS = resolve(join(__dirname, '..', 'secrets', 'demo-logins.json'));

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

function keys(name: string): Set<string> | undefined {
  const raw = arg(name);
  if (!raw) return undefined;
  const set = new Set(raw.split(',').map((k) => k.trim()).filter(Boolean));
  for (const k of set) {
    if (!DEMO_WORKSPACES.some((w) => w.key === k)) throw new Error(`--${name}: no demo called "${k}"`);
  }
  return set;
}

/** Unbiased against the token alphabet, the same way the product mints its tokens. */
function demoPassword(): string {
  let out = '';
  for (const byte of randomBytes(18)) out += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
  return out;
}

const identity: IdentityProvider | null = isAccountAccessConfigured()
  ? {
      async create(email) {
        const password = demoPassword();
        const { authUserId } = await createTempIdentity(email, password);
        return { authUserId, password };
      },
      remove: (authUserId) => deleteIdentity(authUserId),
    }
  : null;

async function main() {
  const yes = process.argv.includes('--yes');
  const adminEmail = (arg('admin-email') ?? '').trim().toLowerCase();
  if (!adminEmail) throw new Error('Pass --admin-email: the platform administrator this run acts as.');

  const db = new PrismaClient();
  try {
    const admin = await db.user.findUnique({ where: { email: adminEmail }, select: { id: true } });
    if (!admin) throw new Error('No user with that --admin-email.');

    console.log(yes ? 'Provisioning the demo workspaces.' : 'Dry run: nothing will be written. Add --yes to provision.');
    console.log(identity ? 'Demo logins: enabled.' : 'Demo logins: SUPABASE_SERVICE_ROLE_KEY is not set, so no login will be created.');
    console.log('');

    const outcomes = await provisionDemoWorkspaces(db, {
      adminUserId: admin.id,
      identity,
      only: keys('only'),
      reseed: keys('reseed'),
      dryRun: !yes,
    });

    const created = outcomes.flatMap((o) => (o.login.state === 'created' ? [{ email: o.login.email, password: o.login.password, clientId: o.clientId }] : []));
    if (created.length > 0) {
      const saved = existsSync(CREDENTIALS) ? (JSON.parse(readFileSync(CREDENTIALS, 'utf8')) as Record<string, unknown>) : {};
      for (const c of created) saved[c.email] = { password: c.password, clientId: c.clientId, createdAt: new Date().toISOString() };
      mkdirSync(dirname(CREDENTIALS), { recursive: true });
      writeFileSync(CREDENTIALS, JSON.stringify(saved, null, 2), 'utf8');
    }

    const base = (process.env.REPOS_PUBLIC_BASE_URL ?? '').trim() || (await getPublicBaseUrl(db)) || '<public base URL>';
    console.log('\nSummary');
    for (const o of outcomes) {
      console.log(
        `  ${o.key.padEnd(12)} ${o.businessName.padEnd(22)} client ${o.client.padEnd(12)} story ${o.story.padEnd(12)} ` +
          `${String(o.feedback).padStart(3)} feedback  login ${o.login.state}` +
          (o.publicToken ? `  ${base.replace(/\/$/, '')}/feedback/${o.publicToken}` : ''),
      );
    }
    if (created.length > 0) console.log(`\n${created.length} new login(s). Passwords written to ${CREDENTIALS} (git-ignored), not printed.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
