import { networkInterfaces } from 'node:os';
import { headers } from 'next/headers';

/**
 * Where RepOS is being reached from, read from the current request (M14).
 *
 * Server-only: `next/headers` has no browser build. Nothing here makes a
 * request of its own — it reads the one that just arrived.
 */

/**
 * The scheme and host RepOS was opened on — for development only.
 *
 * Forwarded headers are attacker-controlled: anyone who can reach the server
 * can send `Host: evil.example` and, before M16, poison the address baked into
 * a printed QR code. So in production this returns null and the public address
 * comes from `REPOS_PUBLIC_BASE_URL` instead. Nothing customer-facing is ever
 * derived from a request header.
 */
export async function requestOrigin(): Promise<string | null> {
  if (process.env.NODE_ENV === 'production') return null;

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto.split(',')[0]?.trim() || 'http'}://${host.split(',')[0]?.trim() || host}`;
}

/**
 * The network address a public submission came from, when a proxy passed
 * one on. Used only as a short-lived rate-limit key that is hashed with a
 * per-start salt and never written anywhere. Null when there is none.
 */
export async function requestAddress(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = h.get('x-real-ip');
  return real?.trim() || null;
}

/**
 * This computer's own network addresses, so the operator can pick the one
 * the shop's Wi-Fi uses without knowing what an IP address is. Read from the
 * operating system, not from the network.
 */
export function lanOrigins(port: string): string[] {
  const out: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.internal) continue;
      if (String(entry.family) !== 'IPv4' && String(entry.family) !== '4') continue;
      // Link-local addresses are never reachable by another device.
      if (entry.address.startsWith('169.254.')) continue;
      out.push(`http://${entry.address}${port ? `:${port}` : ''}`);
    }
  }
  return [...new Set(out)];
}

/** The port part of an origin, or '' when it is implied by the scheme. */
export function portOf(origin: string): string {
  try {
    return new URL(origin).port;
  } catch {
    return '';
  }
}
