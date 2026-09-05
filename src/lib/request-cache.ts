import { AsyncLocalStorage } from 'node:async_hooks';
import { cache } from 'react';

/**
 * ONE READ PER REQUEST, FOR READS THAT CANNOT DISAGREE WITH THEMSELVES.
 *
 * A single client page asks three services for its intelligence, and each of
 * them independently loads the same snapshots and the same themes. The work is
 * identical every time — same rows, same order — so the second, third and
 * fourth trips exist only because nobody was in a position to notice the first.
 * Measured against the real database that was 80 queries where far fewer do.
 *
 * TWO WAYS TO GET A SCOPE, BOTH PER-REQUEST, NEITHER GLOBAL.
 *
 * In a server render React's `cache()` hands out one map per request. That is
 * the whole safety argument: two people looking at two businesses never share
 * an entry because they never share a map, and nothing survives the response.
 * It is not a cache in the sense of holding data over time — there is no TTL
 * because there is no later.
 *
 * Outside a render — a benchmark, a script, a test — React has nothing to hang
 * a store on and simply calls through, which means the deduplication cannot be
 * observed in the very place you would want to measure it. So `runInRequestScope`
 * establishes the same scope explicitly with AsyncLocalStorage. Async context is
 * per-call-tree, so a script measuring one page still cannot see another's rows;
 * it is the same guarantee arrived at by the other door.
 *
 * ONLY for reads whose arguments fully determine their result. Anything varying
 * with the clock, or that a caller might reasonably want re-read after a write
 * in the same request, does not belong here.
 */
const explicit = new AsyncLocalStorage<Map<string, Promise<unknown>>>();
const perRender = cache(() => new Map<string, Promise<unknown>>());

function store(): Map<string, Promise<unknown>> {
  // The explicit scope wins when present; otherwise React's, if we are inside a
  // render; otherwise `perRender()` returns a fresh map and nothing is shared.
  return explicit.getStore() ?? perRender();
}

/** Runs `fn` with its own read scope. For benchmarks and tests, not for pages. */
export function runInRequestScope<T>(fn: () => Promise<T>): Promise<T> {
  return explicit.run(new Map(), fn);
}

export function oncePerRequest<T>(key: string, load: () => Promise<T>): Promise<T> {
  const map = store();
  const pending = map.get(key);
  if (pending) return pending as Promise<T>;
  // The promise is stored, not the value, so concurrent callers in the same
  // request share one in-flight query rather than starting a second.
  const started = load();
  map.set(key, started);
  return started;
}
