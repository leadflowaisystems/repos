import { describe, expect, it } from 'vitest';
import { publicDbConfig, PUBLIC_DATABASE_URL_VAR } from '@/lib/db-public';

/**
 * THE ANONYMOUS CONNECTION IS REQUIRED IN PRODUCTION (M20).
 *
 * `db-public.ts` used to answer "no PUBLIC_DATABASE_URL" by handing the
 * anonymous feedback page the ORDINARY application client. Everything kept
 * working, which was the problem: the page stopped going through
 * `app.public_gateway` / `app.public_submit` and started reading and writing
 * with a tenant id the application derived for itself. The whole reason the SQL
 * boundary exists is that a stranger's request should have no argument through
 * which it can name a business.
 *
 * And it failed in the shape that hides: `.env.example` ships the variable
 * empty, so the default for an operator who fills in the two documented
 * database URLs was the fallback — every console screen healthy, every printed
 * QR pointing at a page whose boundary was gone, nothing logged.
 *
 * So production must refuse. These tests are pure — they pass an environment in
 * rather than mutating `process.env` — because the branch that matters is the
 * one this machine is never in.
 */

describe('a production install must be given its own anonymous connection', () => {
  it('refuses when the variable is absent', () => {
    const result = publicDbConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The message has to name the variable and the role, or it is a puzzle
    // rather than an error.
    expect(result.reason).toContain(PUBLIC_DATABASE_URL_VAR);
    expect(result.reason).toContain('repos_public');
  });

  it('refuses the empty string, which is what the template actually ships', () => {
    const result = publicDbConfig({
      NODE_ENV: 'production',
      PUBLIC_DATABASE_URL: '',
    } as NodeJS.ProcessEnv);

    expect(result.ok).toBe(false);
  });

  it('refuses whitespace, which looks set and is not', () => {
    const result = publicDbConfig({
      NODE_ENV: 'production',
      PUBLIC_DATABASE_URL: '   ',
    } as NodeJS.ProcessEnv);

    expect(result.ok).toBe(false);
  });

  it('never silently offers the application connection instead', () => {
    // The old behaviour returned the ordinary client. Whatever this function
    // says, it must never say "ok, with nothing" in production — that is the
    // exact answer that produced a healthy-looking, boundary-less deployment.
    for (const env of [
      { NODE_ENV: 'production' },
      { NODE_ENV: 'production', PUBLIC_DATABASE_URL: '' },
      { NODE_ENV: 'production', PUBLIC_DATABASE_URL: '\t ' },
    ] as NodeJS.ProcessEnv[]) {
      const result = publicDbConfig(env);
      expect(result.ok && result.url === null).toBe(false);
    }
  });

  it('accepts a real connection string, trimmed', () => {
    const result = publicDbConfig({
      NODE_ENV: 'production',
      PUBLIC_DATABASE_URL: '  postgresql://repos_public@db.example.com:6543/postgres  ',
    } as NodeJS.ProcessEnv);

    expect(result).toEqual({
      ok: true,
      url: 'postgresql://repos_public@db.example.com:6543/postgres',
    });
  });
});

describe('development and the test suite keep the documented fallback', () => {
  it('allows an absent variable outside production', () => {
    expect(publicDbConfig({} as NodeJS.ProcessEnv)).toEqual({ ok: true, url: null });
    expect(publicDbConfig({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toEqual({
      ok: true,
      url: null,
    });
    expect(publicDbConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toEqual({
      ok: true,
      url: null,
    });
  });

  it('still uses a connection string when one is given', () => {
    expect(
      publicDbConfig({
        NODE_ENV: 'development',
        PUBLIC_DATABASE_URL: 'postgresql://repos_public@127.0.0.1:45432/repos',
      } as NodeJS.ProcessEnv),
    ).toEqual({ ok: true, url: 'postgresql://repos_public@127.0.0.1:45432/repos' });
  });
});
