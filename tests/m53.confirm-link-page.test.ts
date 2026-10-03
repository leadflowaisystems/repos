import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The test runner compiles the page's JSX to React.createElement calls (the
// app's own build uses the automatic runtime); give it the React they name.
(globalThis as { React?: typeof React }).React = React;

/**
 * THE ONE BUTTON BETWEEN AN EMAILED LINK AND WHAT IT DOES (M53).
 *
 * `/auth/callback` no longer spends a token when a link is merely opened —
 * mail scanners and chat previews open links before people do. It sends the
 * browser to `/auth/confirm`, and this page's button posts the token back.
 * What has to hold for that to work for a person and for nothing else:
 *
 *   - it is a plain HTML form that POSTs to the callback — no script needed,
 *     and none that could press the button by itself;
 *   - it carries exactly the token, its type and a same-site `next`, in
 *     hidden fields, and shows none of them;
 *   - anything else is "not complete" — no form at all.
 */

// A plain anchor: this file is about the page's own markup.
vi.mock('next/link', async () => {
  const { createElement } = await import('react');
  return {
    default: ({ href, children, className }: { href: string; children?: React.ReactNode; className?: string }) =>
      createElement('a', { href, className }, children),
  };
});

async function render(query: Record<string, string | string[] | undefined>): Promise<string> {
  const { default: ConfirmLinkPage } = await import('@/app/(auth)/auth/confirm/page');
  return renderToStaticMarkup(await ConfirmLinkPage({ searchParams: Promise.resolve(query) }));
}

describe('/auth/confirm', () => {
  it('asks for a same-origin referrer policy — never no-referrer, under which its form would carry Origin "null"', async () => {
    const { metadata } = await import('@/app/(auth)/auth/confirm/page');
    expect(metadata.referrer).toBe('same-origin');
    const { default: config } = await import('../next.config');
    const rules = await config.headers!();
    const forPage = rules.filter((r) => r.source === '/auth/confirm');
    expect(forPage).toHaveLength(1);
    expect(forPage[0]!.headers).toEqual([{ key: 'Referrer-Policy', value: 'same-origin' }]);
    // Listed after the site-wide rule, so it is the one that applies.
    expect(rules.findIndex((r) => r.source === '/auth/confirm')).toBeGreaterThan(rules.findIndex((r) => r.source === '/:path*'));
  });

  it('a reset link: one button that posts the token back to the callback', async () => {
    const html = await render({ token_hash: 'pkce_abc123', type: 'recovery', next: '/reset-password' });
    const form = html.match(/<form[^>]*>/)?.[0] ?? '';
    expect(form).toContain('action="/auth/callback"');
    expect(form).toContain('method="post"');
    expect(html).toContain('<input type="hidden" name="token_hash" value="pkce_abc123"/>');
    expect(html).toContain('<input type="hidden" name="type" value="recovery"/>');
    expect(html).toContain('<input type="hidden" name="next" value="/reset-password"/>');
    expect(html).toContain('Choose a new password');
    expect(html.match(/<button/g)).toHaveLength(1);
    // Nothing presses it but a person.
    expect(html).not.toMatch(/<script|onload|autofocus|http-equiv="refresh"/i);
    // The token is never shown as text.
    expect(html.replace(/value="pkce_abc123"/, '')).not.toContain('pkce_abc123');
  });

  it('a confirm-your-email link says so', async () => {
    const html = await render({ token_hash: 'abc', type: 'signup' });
    expect(html).toContain('Confirm my email');
    expect(html).not.toContain('name="next"');
  });

  it('drops a next that leaves the site', async () => {
    for (const next of ['https://evil.example', '//evil.example', '/\\evil.example']) {
      const html = await render({ token_hash: 'abc', type: 'recovery', next });
      expect(html, next).not.toContain('name="next"');
    }
  });

  it('anything incomplete or of another type gets no form at all', async () => {
    for (const query of [
      {},
      { token_hash: 'abc' },
      { type: 'recovery' },
      { token_hash: 'abc', type: 'magiclink' },
      { token_hash: 'abc', type: 'constructor' },
      { token_hash: ['a', 'b'], type: 'recovery' },
    ]) {
      const html = await render(query);
      expect(html, JSON.stringify(query)).not.toContain('<form');
      expect(html, JSON.stringify(query)).toContain('That link is not complete');
    }
  });
});
