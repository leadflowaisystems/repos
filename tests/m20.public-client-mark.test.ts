import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * THE PUBLIC CLIENT MUST STILL LOOK PUBLIC IN A SECOND BUNDLE (M20).
 *
 * `isPublicClient()` decides which of two very different things the anonymous
 * feedback path does: call `app.public_gateway` / `app.public_submit` through
 * the privilege-less boundary, or issue an ordinary Prisma query. Get the
 * answer wrong and the request takes a code path its connection has no rights
 * for.
 *
 * That is exactly what shipped. The mark was a module-local `WeakSet`, while
 * the client itself was shared between chunks through `globalThis`. Next
 * bundles `db-public.ts` into both the page chunk and the server-action chunk,
 * so whichever built the client marked it in ITS set and published it globally;
 * the other received a handle its own set had never seen, answered false, and
 * ran `prisma.feedbackGateway.findUnique()` on the `repos_public` connection.
 * PostgreSQL refused it — `42501 permission denied for table FeedbackGateway` —
 * and the customer got "Something went wrong." after their feedback had, on
 * some requests, already been written.
 *
 * A test that imports the module once cannot see this: within one instance the
 * WeakSet is perfectly correct. So the test below deliberately loads the module
 * TWICE with `vi.resetModules()`, which gives two independent module instances
 * with separate module-level state — the same condition two server bundles
 * create — and passes a client marked by the first to the second.
 */

describe('the public-client mark survives a module boundary', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('is recognised by a SECOND, independent instance of the module', async () => {
    const first = await import('@/lib/db-public');
    const client = first.markPublicClient({ name: 'pretend prisma client' });

    // A second module instance: separate module-level state, exactly as a
    // second Next server chunk would have.
    vi.resetModules();
    const second = await import('@/lib/db-public');

    expect(second).not.toBe(first);
    expect(first.isPublicClient(client), 'the chunk that marked it').toBe(true);
    expect(second.isPublicClient(client), 'a different chunk, same client').toBe(true);
  });

  it('still refuses a client nobody marked, in either instance', async () => {
    const first = await import('@/lib/db-public');
    const unmarked = { name: 'the ordinary application client' };

    vi.resetModules();
    const second = await import('@/lib/db-public');

    expect(first.isPublicClient(unmarked)).toBe(false);
    expect(second.isPublicClient(unmarked)).toBe(false);
  });

  it('refuses non-objects without throwing', async () => {
    const { isPublicClient } = await import('@/lib/db-public');
    for (const value of [null, undefined, 0, '', 'client', false, Symbol('x')]) {
      expect(isPublicClient(value as unknown), String(String(value))).toBe(false);
    }
  });

  it('does not make the mark enumerable, serialisable or forgeable by copying', async () => {
    const { markPublicClient, isPublicClient } = await import('@/lib/db-public');
    const client = markPublicClient({ visible: true });

    // A spread or JSON round trip must NOT carry the mark: only the object the
    // module actually marked is public, never a look-alike built from it.
    expect(Object.keys(client)).toEqual(['visible']);
    expect(JSON.stringify(client)).toBe('{"visible":true}');
    expect(isPublicClient({ ...client })).toBe(false);
    expect(isPublicClient(JSON.parse(JSON.stringify(client)))).toBe(false);
  });

  it('cannot be silently unmarked', async () => {
    const { markPublicClient, isPublicClient } = await import('@/lib/db-public');
    const client = markPublicClient({});
    const mark = Symbol.for('repos.db-public.privilegeless-client');

    // Non-configurable, non-writable: an accidental reassignment elsewhere in
    // the process cannot turn the boundary off.
    expect(() => {
      'use strict';
      (client as Record<symbol, unknown>)[mark] = false;
    }).toThrow();
    expect(isPublicClient(client)).toBe(true);
  });
});
