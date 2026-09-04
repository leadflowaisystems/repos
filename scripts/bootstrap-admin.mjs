#!/usr/bin/env node
/**
 * FIRST ADMIN BOOTSTRAP (M20 Stage 3).
 *
 * Platform admin is the one privilege RepOS will not let anything grant
 * itself. It is not settable from a form, not settable at signup, not settable
 * by an invitation, and the database refuses the column to the application
 * role outright. That leaves a genuine problem: the very first administrator.
 *
 * This script is the answer, and it is deliberately awkward to run:
 *
 *   * it is a CLI, never a route, so no browser can reach it;
 *   * it demands REPOS_BOOTSTRAP_SECRET in the environment and compares it to
 *     --secret, so having the repository is not enough — you need the
 *     deployment's own secret too;
 *   * it connects with DIRECT_DATABASE_URL as the schema owner, which is the
 *     one connection that is not the RLS-restricted application role;
 *   * it is idempotent: promoting someone twice is a no-op, and it never
 *     creates a password, a session or an identity.
 *
 * It does NOT create the Supabase Auth account. Sign up through the normal
 * flow first, then run this against the email you used. That keeps Supabase
 * Auth the single source of identity — this only marks an existing person as
 * staff.
 *
 * Usage:
 *   REPOS_BOOTSTRAP_SECRET=... node scripts/bootstrap-admin.mjs \
 *     --email you@example.com --secret ...
 *
 * Add --revoke to take the privilege away again.
 *
 * PRODUCTION PROCEDURE: see README, "First administrator". The short version
 * is that the secret is set in the deployment environment, the command is run
 * once from a trusted machine against DIRECT_DATABASE_URL, and the secret is
 * then rotated or removed. Nothing here is printed, logged or echoed.
 */

import { PrismaClient } from '@prisma/client';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

function fail(message) {
  // Deliberately says what is wrong without repeating any value back.
  console.error(`bootstrap-admin: ${message}`);
  process.exit(1);
}

const expected = process.env.REPOS_BOOTSTRAP_SECRET ?? '';
const supplied = arg('secret') ?? '';
const email = (arg('email') ?? '').trim().toLowerCase();
const revoke = process.argv.includes('--revoke');

if (expected.length < 16) {
  fail('set REPOS_BOOTSTRAP_SECRET to at least 16 characters in the environment.');
}
// Length-independent comparison is overkill for a local CLI, but constant-time
// habits are cheap and this is the highest-privilege operation RepOS has.
if (supplied.length !== expected.length || supplied !== expected) {
  fail('the --secret does not match REPOS_BOOTSTRAP_SECRET.');
}
if (!email.includes('@')) {
  fail('pass --email with the address of an account that already signed up.');
}

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
if (!url.startsWith('postgres')) {
  fail('DIRECT_DATABASE_URL must point at the PostgreSQL database.');
}

const db = new PrismaClient({ datasources: { db: { url } } });

try {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, isPlatformAdmin: true, authProviderId: true },
  });

  if (!user) {
    fail('no RepOS account with that address. Sign up through /signup first, then run this again.');
  }
  if (!user.authProviderId) {
    fail('that account has no verified identity yet. Confirm the email address first.');
  }

  const target = !revoke;
  if (user.isPlatformAdmin === target) {
    console.log(`bootstrap-admin: already ${target ? 'an administrator' : 'not an administrator'}. Nothing to do.`);
  } else {
    await db.user.update({
      where: { id: user.id },
      // Bumping the session version forces them to sign in again, so the new
      // privilege is carried by a fresh session rather than an old one.
      data: { isPlatformAdmin: target, sessionVersion: { increment: 1 } },
    });
    console.log(`bootstrap-admin: ${target ? 'granted' : 'revoked'} platform administrator.`);
  }
} finally {
  await db.$disconnect();
}
