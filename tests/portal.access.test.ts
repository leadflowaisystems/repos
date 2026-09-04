import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createClient,
  ensurePortalToken,
  regeneratePortalToken,
} from '@/lib/clients/service';
import { resolvePortalToken, portalPath } from '@/lib/portal/access';
import { TOKEN_ALPHABET, TOKEN_LENGTH, isPublicToken } from '@/lib/tokens';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/**
 * THE OWNER'S PRIVATE LINK (M16).
 *
 * Before M16 the owner's workspace was addressed by the client's database id,
 * which is printed on every operator screen and is a sortable timestamp rather
 * than a secret. These tests are about the one thing that replaced it: an
 * address that cannot be guessed, cannot be walked, and can be revoked.
 */

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('portal-access');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

async function makeClient(businessName: string): Promise<string> {
  const result = await createClient(db, validClientInput({ businessName }));
  if (!result.ok) throw new Error(result.message);
  return result.data.id;
}

describe('the address itself', () => {
  it('is a random token, never the client id', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await ensurePortalToken(db, id);

    expect(token).not.toBeNull();
    expect(token).not.toBe(id);
    expect(token).not.toContain(id);
    expect(id).not.toContain(token!);
  });

  it('is long enough that guessing is pointless', async () => {
    const id = await makeClient('Corner Cafe');
    const token = (await ensurePortalToken(db, id))!;

    expect(token).toHaveLength(TOKEN_LENGTH);
    expect(isPublicToken(token)).toBe(true);
    for (const character of token) expect(TOKEN_ALPHABET).toContain(character);
    // 32 symbols over 22 places is 110 bits.
    expect(Math.log2(TOKEN_ALPHABET.length) * TOKEN_LENGTH).toBeGreaterThanOrEqual(110);
  });

  it('is different for every client', async () => {
    const tokens = new Set<string>();
    for (const name of ['One', 'Two', 'Three', 'Four', 'Five']) {
      const id = await makeClient(name);
      tokens.add((await ensurePortalToken(db, id))!);
    }
    expect(tokens.size).toBe(5);
  });

  it('is issued once and then stays the same', async () => {
    // The owner bookmarks this link. It must not change under them.
    const id = await makeClient('Corner Cafe');
    const first = await ensurePortalToken(db, id);
    const second = await ensurePortalToken(db, id);
    const third = await ensurePortalToken(db, id);

    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('appears in the path exactly as issued', async () => {
    const id = await makeClient('Corner Cafe');
    const token = (await ensurePortalToken(db, id))!;
    expect(portalPath(token)).toBe(`/portal/${token}`);
    expect(portalPath(token)).not.toContain(id);
  });
});

describe('opening a link', () => {
  it('opens exactly the business it belongs to', async () => {
    const cafe = await makeClient('Corner Cafe');
    const salon = await makeClient('Glow Salon');
    const cafeToken = (await ensurePortalToken(db, cafe))!;
    const salonToken = (await ensurePortalToken(db, salon))!;

    const opened = await resolvePortalToken(db, cafeToken);
    expect(opened?.id).toBe(cafe);
    expect(opened?.businessName).toBe('Corner Cafe');

    const other = await resolvePortalToken(db, salonToken);
    expect(other?.id).toBe(salon);
    expect(other?.id).not.toBe(cafe);
  });

  it('opens nothing for a token that was never issued', async () => {
    await makeClient('Corner Cafe');
    // Correctly shaped, simply not ours.
    const stranger = 'a'.repeat(TOKEN_LENGTH);
    expect(isPublicToken(stranger)).toBe(true);
    expect(await resolvePortalToken(db, stranger)).toBeNull();
  });

  it('opens nothing for a client id, which is what the old links used', async () => {
    const id = await makeClient('Corner Cafe');
    await ensurePortalToken(db, id);
    expect(await resolvePortalToken(db, id)).toBeNull();
  });

  it('opens nothing for anything the wrong shape, and does not query at all', async () => {
    await makeClient('Corner Cafe');
    for (const bad of [
      '',
      '   ',
      'short',
      'A'.repeat(TOKEN_LENGTH), // uppercase is not in the alphabet
      'l'.repeat(TOKEN_LENGTH), // 'l' is excluded: it reads as 1
      `${'a'.repeat(TOKEN_LENGTH)}a`,
      '../../etc/passwd',
      "' OR 1=1 --",
      '%2e%2e%2f',
    ]) {
      expect(await resolvePortalToken(db, bad)).toBeNull();
    }
  });

  it('opens nothing once the business is archived', async () => {
    const id = await makeClient('Corner Cafe');
    const token = (await ensurePortalToken(db, id))!;
    expect(await resolvePortalToken(db, token)).not.toBeNull();

    await db.client.update({ where: { id }, data: { archivedAt: new Date() } });
    expect(await resolvePortalToken(db, token)).toBeNull();
  });

  it('opens nothing once the business is deleted', async () => {
    const id = await makeClient('Corner Cafe');
    const token = (await ensurePortalToken(db, id))!;
    await db.client.delete({ where: { id } });
    expect(await resolvePortalToken(db, token)).toBeNull();
  });
});

describe('taking a link back', () => {
  it('issues a different address', async () => {
    const id = await makeClient('Corner Cafe');
    const before = (await ensurePortalToken(db, id))!;
    const after = (await regeneratePortalToken(db, id))!;

    expect(after).not.toBe(before);
    expect(isPublicToken(after)).toBe(true);
  });

  it('stops the old address working immediately', async () => {
    const id = await makeClient('Corner Cafe');
    const before = (await ensurePortalToken(db, id))!;
    await regeneratePortalToken(db, id);

    expect(await resolvePortalToken(db, before)).toBeNull();
  });

  it('leaves the new address working, on the same business', async () => {
    const id = await makeClient('Corner Cafe');
    await ensurePortalToken(db, id);
    const after = (await regeneratePortalToken(db, id))!;

    const opened = await resolvePortalToken(db, after);
    expect(opened?.id).toBe(id);
  });

  it('touches nobody else’s link', async () => {
    const cafe = await makeClient('Corner Cafe');
    const salon = await makeClient('Glow Salon');
    const salonToken = (await ensurePortalToken(db, salon))!;
    await ensurePortalToken(db, cafe);

    await regeneratePortalToken(db, cafe);

    expect((await resolvePortalToken(db, salonToken))?.id).toBe(salon);
  });

  it('can be done again and again, each one retiring the last', async () => {
    const id = await makeClient('Corner Cafe');
    const seen: string[] = [(await ensurePortalToken(db, id))!];
    for (let i = 0; i < 3; i += 1) seen.push((await regeneratePortalToken(db, id))!);

    expect(new Set(seen).size).toBe(seen.length);
    for (const old of seen.slice(0, -1)) {
      expect(await resolvePortalToken(db, old)).toBeNull();
    }
    expect((await resolvePortalToken(db, seen[seen.length - 1]!))?.id).toBe(id);
  });

  it('does nothing for a client that is not there', async () => {
    expect(await ensurePortalToken(db, 'no-such-client')).toBeNull();
    expect(await regeneratePortalToken(db, 'no-such-client')).toBeNull();
  });
});

describe('what an opened link hands back', () => {
  it('carries no customer information and no operator internals', async () => {
    const id = await makeClient('Corner Cafe');
    const token = (await ensurePortalToken(db, id))!;
    const opened = await resolvePortalToken(db, token);

    expect(opened).not.toBeNull();
    // The owner's page needs the business, not the file it came out of.
    expect(Object.keys(opened!).sort()).toEqual(
      ['businessName', 'id', 'portalToken', 'vertical', 'verticalLabel'].sort(),
    );
  });
});
