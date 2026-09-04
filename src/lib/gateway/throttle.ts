import { createHash, randomBytes } from 'node:crypto';

/**
 * LIGHTWEIGHT ABUSE PROTECTION FOR A PUBLIC PAGE (M14).
 *
 * A feedback page anyone can open needs a ceiling on how fast it can be fed.
 * Everything here lives in this process's memory and nowhere else:
 *
 *   - counters are keyed by a salted hash, and the salt is regenerated every
 *     time the application starts, so a key can never be joined back to a
 *     network address later — not by RepOS, not by anyone reading the disk;
 *   - nothing is written to the database, a file or a log;
 *   - entries expire on their own within the window and are pruned as they go.
 *
 * This is not a bot-detection system and does not try to be. It stops a stuck
 * finger, a repeated tap and a crude flood, which is what a local business's
 * counter actually sees.
 */

/** Rotates on every start, so the same address hashes differently tomorrow. */
const PROCESS_SALT = randomBytes(16).toString('hex');

export function hashKey(value: string, salt: string = PROCESS_SALT): string {
  return createHash('sha256').update(`${salt}:${value}`).digest('hex').slice(0, 20);
}

export type LimitCheck = { allowed: true } | { allowed: false; retryAfterMs: number };

/** Sliding window: at most `limit` events per key within `windowMs`. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    /** Ceiling on distinct keys kept, so memory cannot grow without bound. */
    private readonly maxKeys = 5000,
  ) {}

  private prune(key: string, now: number): number[] {
    const floor = now - this.windowMs;
    const kept = (this.hits.get(key) ?? []).filter((t) => t > floor);
    if (kept.length === 0) this.hits.delete(key);
    else this.hits.set(key, kept);
    return kept;
  }

  check(key: string, now: Date = new Date()): LimitCheck {
    const stamps = this.prune(key, now.getTime());
    if (stamps.length < this.limit) return { allowed: true };
    const oldest = stamps[0] ?? now.getTime();
    return { allowed: false, retryAfterMs: Math.max(0, oldest + this.windowMs - now.getTime()) };
  }

  record(key: string, now: Date = new Date()): void {
    const stamps = this.prune(key, now.getTime());
    stamps.push(now.getTime());
    this.hits.set(key, stamps);
    if (this.hits.size > this.maxKeys) {
      // Drop the oldest-inserted key. Map iteration is insertion-ordered.
      const first = this.hits.keys().next().value;
      if (first !== undefined) this.hits.delete(first);
    }
  }

  /** Test seam. */
  reset(): void {
    this.hits.clear();
  }
}

/**
 * Remembers form nonces for a short while, so the same form posted twice —
 * a double tap, a browser retry — lands once. Unknown nonces are accepted by
 * the caller; this only refuses one it has already seen.
 */
export class OnceSet {
  private readonly seen = new Map<string, number>();

  constructor(
    readonly ttlMs: number,
    private readonly maxKeys = 5000,
  ) {}

  /** True the first time an id is presented within the window. */
  useOnce(id: string, now: Date = new Date()): boolean {
    const at = now.getTime();
    for (const [key, stamp] of this.seen) {
      if (stamp + this.ttlMs < at) this.seen.delete(key);
    }
    if (this.seen.has(id)) return false;
    this.seen.set(id, at);
    if (this.seen.size > this.maxKeys) {
      const first = this.seen.keys().next().value;
      if (first !== undefined) this.seen.delete(first);
    }
    return true;
  }

  reset(): void {
    this.seen.clear();
  }
}

/** Per feedback page: a whole business's customers, at a busy counter. */
export const PAGE_LIMIT = { limit: 60, windowMs: 10 * 60_000 } as const;
/** Per network address, when one is known: one phone, one stuck finger. */
export const ADDRESS_LIMIT = { limit: 15, windowMs: 10 * 60_000 } as const;
/** How long a form's nonce is remembered. */
export const NONCE_TTL_MS = 30 * 60_000;

/** A short random id for one rendering of the form. Never stored. */
export function newFormNonce(): string {
  return randomBytes(12).toString('hex');
}
