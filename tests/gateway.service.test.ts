import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { archiveClient, createClient, updateClient } from '@/lib/clients/service';
import { listClientFeedback, RATING_ONLY_PREVIEW } from '@/lib/feedback/service';
import { analyseClientFeedback, getThemeSummary } from '@/lib/feedback/analysis';
import { draftClientReplies, triageClientFeedback } from '@/lib/feedback/replies';
import { ingestFeedback } from '@/lib/feedback/ingest';
import { loadIntelligence } from '@/lib/intelligence/service';
import { getPortalView, getReviewsView } from '@/lib/portal/service';
import { NO_CHANNEL_REASON } from '@/lib/reply/triage';
import {
  MAX_CUSTOMER_TEXT,
  NOTHING_MESSAGE,
  NOT_ACTIVE_MESSAGE,
  RATING_DUPLICATE_WINDOW_MS,
  TEXT_DUPLICATE_WINDOW_MS,
  TOO_LONG_MESSAGE,
  TOO_MANY_MESSAGE,
  _resetGatewayThrottles,
  ensureGateway,
  getGatewayView,
  getPublicBaseUrl,
  resolvePublicGateway,
  savePublicBaseUrl,
  savePublicReviewUrl,
  setGatewayEnabled,
  submitCustomerFeedback,
} from '@/lib/gateway/service';
import { isPublicToken } from '@/lib/gateway/token';
import { PAGE_LIMIT, ADDRESS_LIMIT } from '@/lib/gateway/throttle';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/**
 * THE CUSTOMER FEEDBACK GATEWAY, END TO END (M14).
 *
 * A real SQLite database, the real intake, the real reading, the real reply
 * sorting, the real intelligence and the real owner pages. Nothing is mocked,
 * because the point of this milestone is that one submission travels the
 * whole existing pipeline without a second one being built.
 */

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('gateway-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
  _resetGatewayThrottles();
});

afterAll(async () => {
  await db.$disconnect();
});

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ORIGIN = 'http://192.168.1.7:3000';

function later(ms: number): Date {
  return new Date(NOW.getTime() + ms);
}

async function makeClient(businessName: string, vertical = 'restaurant', extra: Record<string, unknown> = {}) {
  const result = await createClient(db, validClientInput({ businessName, vertical, ...extra }));
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.id;
}

async function tokenFor(clientId: string): Promise<string> {
  const gateway = await ensureGateway(db, clientId);
  if (!gateway) throw new Error('no gateway');
  return gateway.publicToken;
}

async function submit(
  token: string,
  input: { stars?: number | null; text?: string; nonce?: string | null; website?: string | null },
  options: { now?: Date; address?: string | null } = {},
) {
  return submitCustomerFeedback(
    db,
    token,
    { stars: input.stars ?? null, text: input.text ?? '', nonce: input.nonce ?? null, website: input.website ?? null },
    { now: options.now ?? NOW, address: options.address ?? null },
  );
}

async function submitOk(token: string, input: Parameters<typeof submit>[1], options?: Parameters<typeof submit>[2]) {
  const result = await submit(token, input, options);
  if (!result.ok) throw new Error(`submit failed: ${result.message}`);
  return result.data;
}

async function count(clientId: string): Promise<number> {
  return db.reviewItem.count({ where: { clientId } });
}

async function readAll(clientId: string): Promise<void> {
  const read = await analyseClientFeedback(db, clientId, { useAi: false, now: NOW });
  if (!read.ok) throw new Error(read.message);
  await triageClientFeedback(db, clientId, { now: NOW });
}

// ---------------------------------------------------------------------------

describe('every client has a feedback page', () => {
  it('creates a stable, unguessable token the first time it is needed', async () => {
    const id = await makeClient('Corner Cafe');
    const first = await ensureGateway(db, id);
    const second = await ensureGateway(db, id);
    expect(first?.publicToken).toBeDefined();
    expect(first?.publicToken).toBe(second?.publicToken);
    expect(isPublicToken(first?.publicToken)).toBe(true);
    expect(first?.publicToken).not.toBe(id);
    expect(first?.publicToken).not.toContain(id);
    expect(first?.enabled).toBe(true);
  });

  it('keeps the token through ordinary client edits', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    const updated = await updateClient(db, id, validClientInput({ businessName: 'Corner Cafe Kothrud', vertical: 'restaurant' }));
    expect(updated.ok).toBe(true);
    expect(await tokenFor(id)).toBe(token);
    const resolved = await resolvePublicGateway(db, token);
    expect(resolved?.businessName).toBe('Corner Cafe Kothrud');
  });

  it('gives two clients two different tokens', async () => {
    const a = await makeClient('Corner Cafe');
    const b = await makeClient('Sunrise Dental', 'clinic');
    expect(await tokenFor(a)).not.toBe(await tokenFor(b));
  });

  it('starts the public review link from what the operator already gave the client', async () => {
    const id = await makeClient('Corner Cafe', 'restaurant', { reviewLinkUrl: 'https://g.page/r/abc/review' });
    const gateway = await ensureGateway(db, id);
    expect(gateway?.publicReviewUrl).toBe('https://g.page/r/abc/review');
    const bare = await makeClient('Plain Cafe');
    expect((await ensureGateway(db, bare))?.publicReviewUrl).toBe('');
  });

  it('returns nothing for a client that does not exist', async () => {
    expect(await ensureGateway(db, 'nope')).toBeNull();
    expect(await getGatewayView(db, 'nope', { requestOrigin: ORIGIN })).toBeNull();
  });
});

describe('the operator view', () => {
  it('has the link, the QR and the card wording ready with no setup', async () => {
    const id = await makeClient('Corner Cafe');
    const view = await getGatewayView(db, id, { requestOrigin: ORIGIN });
    expect(view).not.toBeNull();
    if (!view) return;
    expect(view.enabled).toBe(true);
    expect(view.feedbackUrl).toBe(`${ORIGIN}/feedback/${view.token}`);
    expect(view.qr?.svg).toContain('<svg');
    expect(view.qr?.pngDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(view.qr?.url).toBe(view.feedbackUrl);
    expect(view.copy.printHeadline.length).toBeGreaterThan(0);
    expect(view.baseUrlSource).toBe('REQUEST');
    expect(view.baseUrlLoopback).toBe(false);
    expect(view.received).toEqual({ total: 0, unread: 0, latestAt: null });
  });

  it('warns when the address only works on this computer', async () => {
    const id = await makeClient('Corner Cafe');
    const view = await getGatewayView(db, id, { requestOrigin: 'http://localhost:3000' });
    expect(view?.baseUrlLoopback).toBe(true);
  });

  it('uses the saved public address for every client once one is set', async () => {
    const a = await makeClient('Corner Cafe');
    const b = await makeClient('Sunrise Dental', 'clinic');
    expect(await getPublicBaseUrl(db)).toBeNull();

    const saved = await savePublicBaseUrl(db, 'https://repos.example/');
    expect(saved.ok).toBe(true);
    expect(await getPublicBaseUrl(db)).toBe('https://repos.example');

    for (const id of [a, b]) {
      const view = await getGatewayView(db, id, { requestOrigin: ORIGIN });
      expect(view?.baseUrlSource).toBe('SETTING');
      expect(view?.feedbackUrl.startsWith('https://repos.example/feedback/')).toBe(true);
    }

    const bad = await savePublicBaseUrl(db, 'repos.example/feedback');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.publicBaseUrl).toBeDefined();

    const cleared = await savePublicBaseUrl(db, '');
    expect(cleared.ok).toBe(true);
    expect(await getPublicBaseUrl(db)).toBeNull();
  });

  it('counts what came in through the page and how much is still unread', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await submitOk(token, { stars: 5, text: 'Great biryani' });
    await submitOk(token, { stars: 2, text: 'Very slow service tonight' }, { now: later(60_000) });
    let view = await getGatewayView(db, id, { requestOrigin: ORIGIN });
    expect(view?.received.total).toBe(2);
    expect(view?.received.unread).toBe(2);
    expect(view?.received.latestAt?.getTime()).toBe(later(60_000).getTime());

    await readAll(id);
    view = await getGatewayView(db, id, { requestOrigin: ORIGIN });
    expect(view?.received.unread).toBe(0);
  });
});

describe('the customer journeys', () => {
  it('A. positive feedback is stored, read and understood', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    const out = await submitOk(token, { stars: 5, text: 'Food was excellent and the staff were friendly.' });
    expect(out.stored).toBe(true);
    expect(out.itemId).not.toBeNull();

    await readAll(id);
    const [row] = await listClientFeedback(db, id);
    expect(row?.source).toBe('REP_OS_QR');
    expect(row?.sourceLabel).toBe('Feedback QR');
    expect(row?.stars).toBe(5);
    expect(row?.reviewDate?.getTime()).toBe(NOW.getTime());
    expect(row?.analysed).toBe(true);
    expect(row?.sentiment).toBe('POSITIVE');
    expect(row?.themes.some((t) => t.kind === 'PRAISE')).toBe(true);
  });

  it('B. negative feedback is stored as it was written, and read as a complaint', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await submitOk(token, { stars: 1, text: 'Waited 40 minutes for the food. Service was very slow.' });
    await readAll(id);
    const [row] = await listClientFeedback(db, id);
    expect(row?.text).toContain('Service was very slow');
    expect(row?.sentiment).toBe('NEGATIVE');
    expect(row?.themes.map((t) => t.key)).toContain('service_speed');
  });

  it('C. mixed feedback is read as mixed', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await submitOk(token, { stars: 3, text: 'Food was excellent but the service was very slow.' });
    await readAll(id);
    const [row] = await listClientFeedback(db, id);
    expect(row?.sentiment).toBe('MIXED');
  });

  it('D. a rating on its own is enough, and no words are invented for it', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    const out = await submitOk(token, { stars: 4, text: '' });
    expect(out.stored).toBe(true);

    await readAll(id);
    const [row] = await listClientFeedback(db, id);
    expect(row?.text).toBe('');
    expect(row?.preview).toBe(RATING_ONLY_PREVIEW);
    expect(row?.stars).toBe(4);
    expect(row?.sentiment).toBe('POSITIVE');
    expect(row?.reasons.join(' ')).toContain('Only the star rating');
    expect(row?.themes).toEqual([]);
  });

  it('E. words on their own are enough', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    const out = await submitOk(token, { stars: null, text: 'The place was spotless and the coffee was great.' });
    expect(out.stored).toBe(true);
    await readAll(id);
    const [row] = await listClientFeedback(db, id);
    expect(row?.stars).toBeNull();
    expect(row?.sentiment).toBe('POSITIVE');
  });

  it('F. Hindi, Marathi and Hinglish arrive intact and are read', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await submitOk(token, { stars: 2, text: 'खाना अच्छा था लेकिन सर्विस बहुत धीमी थी' });
    await submitOk(token, { stars: 5, text: 'जेवण खूप छान होते' }, { now: later(1000) });
    await submitOk(token, { stars: 4, text: 'Khana bahut accha tha, staff bhi friendly' }, { now: later(2000) });
    await readAll(id);
    const rows = await listClientFeedback(db, id);
    expect(rows).toHaveLength(3);
    expect(rows.some((r) => r.text.includes('सर्विस'))).toBe(true);
    expect(rows.some((r) => r.text.includes('जेवण'))).toBe(true);
    const languages = new Set(rows.map((r) => r.language));
    expect(languages.has('hi') || languages.has('mixed')).toBe(true);
    expect(languages.has('mr') || languages.has('mixed')).toBe(true);
    expect(rows.every((r) => r.analysed)).toBe(true);
  });

  it('G. an empty submission is refused, kindly', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    for (const text of ['', '   ', '...', '!!!']) {
      const result = await submit(token, { stars: null, text });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe(NOTHING_MESSAGE);
    }
    expect(await count(id)).toBe(0);
  });

  it('H. very long text is refused at the limit, and accepted just under it', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    const tooLong = await submit(token, { stars: 3, text: 'a'.repeat(MAX_CUSTOMER_TEXT + 1) });
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.message).toBe(TOO_LONG_MESSAGE);

    const justRight = await submit(token, { stars: 3, text: 'b'.repeat(MAX_CUSTOMER_TEXT) });
    expect(justRight.ok).toBe(true);
    expect(await count(id)).toBe(1);
  });

  it('Q. nothing about the person is asked for, and anything they volunteer is removed', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await submitOk(token, {
      stars: 2,
      text: 'Call me on 98765 43210 or rahul@example.com — the order no 4471 was cold.',
    });
    const row = await db.reviewItem.findFirstOrThrow({ where: { clientId: id } });
    expect(row.text).not.toContain('98765');
    expect(row.text).not.toContain('example.com');
    expect(row.text).not.toContain('4471');
    expect(row.text).toContain('was cold');
    expect(row.redacted).toBe(true);

    // The row and the gateway carry no identity column of any kind.
    const gateway = await db.feedbackGateway.findUniqueOrThrow({ where: { clientId: id } });
    for (const column of [...Object.keys(row), ...Object.keys(gateway)]) {
      expect(column, column).not.toMatch(/name|phone|email|address|ip|device|customer/i);
    }
  });
});

describe('duplicates, without knowing who anyone is', () => {
  it('I. the same words twice in a few minutes land once', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    const first = await submitOk(token, { stars: 4, text: 'Good food, slow service.' });
    const again = await submitOk(token, { stars: 4, text: 'good food slow service' }, { now: later(60_000) });
    expect(first.stored).toBe(true);
    expect(again.stored).toBe(false);
    expect(await count(id)).toBe(1);
  });

  it('the same words weeks apart are two customers', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await submitOk(token, { stars: 5, text: 'good' });
    const second = await submitOk(token, { stars: 5, text: 'good' }, { now: later(TEXT_DUPLICATE_WINDOW_MS + 1000) });
    expect(second.stored).toBe(true);
    expect(await count(id)).toBe(2);
  });

  it('"good" from ten different customers over a day is ten pieces of feedback', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    for (let i = 0; i < 10; i += 1) {
      await submitOk(token, { stars: 5, text: 'good' }, { now: later(i * 2 * TEXT_DUPLICATE_WINDOW_MS) });
    }
    expect(await count(id)).toBe(10);
  });

  it('a rating alone twice within seconds is one tap; a minute later it is another customer', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await submitOk(token, { stars: 5 });
    const again = await submitOk(token, { stars: 5 }, { now: later(RATING_DUPLICATE_WINDOW_MS - 1000) });
    expect(again.stored).toBe(false);
    const next = await submitOk(token, { stars: 5 }, { now: later(RATING_DUPLICATE_WINDOW_MS + 30_000) });
    expect(next.stored).toBe(true);
    const different = await submitOk(token, { stars: 3 }, { now: later(1000) });
    expect(different.stored).toBe(true);
    expect(await count(id)).toBe(3);
  });

  it('the same form posted twice lands once, whatever changed between the taps', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await submitOk(token, { stars: 4, text: 'Nice place', nonce: 'form-1' });
    const again = await submitOk(token, { stars: 4, text: 'Nice place!!', nonce: 'form-1' });
    expect(again.stored).toBe(false);
    const fresh = await submitOk(token, { stars: 4, text: 'Nice place!!', nonce: 'form-2' });
    expect(fresh.stored).toBe(false); // identical wording inside the window
    expect(await count(id)).toBe(1);
  });

  it('a filled honeypot or a wall of links is thanked and thrown away', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    const bot = await submitOk(token, { stars: 5, text: 'Great', website: 'http://spam.example' });
    expect(bot.stored).toBe(false);
    const links = await submitOk(token, {
      stars: 5,
      text: 'Buy now http://a.example and http://b.example best deals',
    });
    expect(links.stored).toBe(false);
    expect(await count(id)).toBe(0);
  });

  it('a different customer is never mistaken for a duplicate of a pasted public review', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    const pasted = await ingestFeedback(
      db,
      id,
      { text: 'Excellent food', stars: 5, occurredAt: NOW, source: 'PUBLIC_REVIEW' },
      { now: NOW, dedupe: { mode: 'EXACT_FOREVER' } },
    );
    expect(pasted.ok).toBe(true);
    const direct = await submitOk(token, { stars: 5, text: 'Excellent food' }, { now: later(1000) });
    expect(direct.stored).toBe(true);
    expect(await count(id)).toBe(2);
  });
});

describe('ceilings on a public page', () => {
  it('stops a flood on one page, and lets it through again after the window', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    for (let i = 0; i < PAGE_LIMIT.limit; i += 1) {
      const result = await submit(token, { stars: 5, text: `Note ${i}` }, { now: later(i * 1000) });
      expect(result.ok, `submission ${i}`).toBe(true);
    }
    const refused = await submit(token, { stars: 5, text: 'One more' }, { now: later(PAGE_LIMIT.limit * 1000) });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toBe(TOO_MANY_MESSAGE);

    const afterWindow = await submit(token, { stars: 5, text: 'Much later' }, { now: later(PAGE_LIMIT.windowMs + PAGE_LIMIT.limit * 1000 + 1) });
    expect(afterWindow.ok).toBe(true);
  });

  it('stops one address flooding, without touching the others', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    for (let i = 0; i < ADDRESS_LIMIT.limit; i += 1) {
      const result = await submit(token, { stars: 4, text: `From here ${i}` }, { now: later(i * 1000), address: '10.0.0.9' });
      expect(result.ok, `submission ${i}`).toBe(true);
    }
    const refused = await submit(token, { stars: 4, text: 'Again' }, { now: later(20_000), address: '10.0.0.9' });
    expect(refused.ok).toBe(false);
    const other = await submit(token, { stars: 4, text: 'Someone else' }, { now: later(20_000), address: '10.0.0.10' });
    expect(other.ok).toBe(true);
  });

  it('never writes a network address anywhere', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await submitOk(token, { stars: 4, text: 'Quick and friendly' }, { address: '203.0.113.5' });
    const dump = JSON.stringify(await db.reviewItem.findMany({ where: { clientId: id } }));
    expect(dump).not.toContain('203.0.113.5');
    const settings = JSON.stringify(await db.appSetting.findMany());
    expect(settings).not.toContain('203.0.113.5');
  });
});

describe('client isolation', () => {
  it("J. Corner Cafe's QR cannot create Sunrise Dental feedback", async () => {
    const cafe = await makeClient('Corner Cafe');
    const dental = await makeClient('Sunrise Dental', 'clinic');
    const cafeToken = await tokenFor(cafe);
    const dentalToken = await tokenFor(dental);

    await submitOk(cafeToken, { stars: 2, text: 'Slow service' });
    expect(await count(cafe)).toBe(1);
    expect(await count(dental)).toBe(0);

    await submitOk(dentalToken, { stars: 5, text: 'The doctor explained everything' });
    expect(await count(cafe)).toBe(1);
    expect(await count(dental)).toBe(1);
    const dentalRows = await db.reviewItem.findMany({ where: { clientId: dental } });
    expect(dentalRows.every((r) => r.clientId === dental)).toBe(true);
  });

  it("Sunrise's token never shows Corner Cafe's name, link or QR", async () => {
    const cafe = await makeClient('Corner Cafe');
    const dental = await makeClient('Sunrise Dental', 'clinic');
    await savePublicReviewUrl(db, cafe, 'https://g.page/r/cafe/review');
    await savePublicReviewUrl(db, dental, 'https://g.page/r/dental/review');

    const cafeToken = await tokenFor(cafe);
    const dentalToken = await tokenFor(dental);
    const cafePublic = await resolvePublicGateway(db, cafeToken);
    const dentalPublic = await resolvePublicGateway(db, dentalToken);

    expect(cafePublic?.businessName).toBe('Corner Cafe');
    expect(dentalPublic?.businessName).toBe('Sunrise Dental');
    expect(dentalPublic?.publicReviewUrl).toBe('https://g.page/r/dental/review');
    expect(JSON.stringify(dentalPublic)).not.toContain('cafe');
    expect(JSON.stringify(cafePublic)).not.toContain('dental');

    const cafeView = await getGatewayView(db, cafe, { requestOrigin: ORIGIN });
    const dentalView = await getGatewayView(db, dental, { requestOrigin: ORIGIN });
    expect(cafeView?.feedbackUrl).toContain(cafeToken);
    expect(cafeView?.feedbackUrl).not.toContain(dentalToken);
    expect(dentalView?.feedbackUrl).toContain(dentalToken);
    expect(dentalView?.qr?.url).not.toContain(cafeToken);
    expect(cafeView?.publicReviewUrl).not.toBe(dentalView?.publicReviewUrl);
  });

  it('K. an unknown token resolves to nothing and stores nothing', async () => {
    const id = await makeClient('Corner Cafe');
    for (const token of ['nope', '', id, 'abcdefghjkmnpqrstuvwxy', 'ABCDEFGHJKMNPQRSTUVWXY']) {
      expect(await resolvePublicGateway(db, token)).toBeNull();
      const result = await submit(token, { stars: 5, text: 'Hello' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe(NOT_ACTIVE_MESSAGE);
    }
    expect(await count(id)).toBe(0);
  });

  it('L. an archived client accepts nothing, and a paused page accepts nothing', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await submitOk(token, { stars: 5, text: 'Before' });

    const paused = await setGatewayEnabled(db, id, false);
    expect(paused.ok).toBe(true);
    expect(await resolvePublicGateway(db, token)).toBeNull();
    expect((await submit(token, { stars: 5, text: 'While paused' })).ok).toBe(false);
    await setGatewayEnabled(db, id, true);
    expect(await resolvePublicGateway(db, token)).not.toBeNull();

    await archiveClient(db, id, NOW);
    expect(await resolvePublicGateway(db, token)).toBeNull();
    const result = await submit(token, { stars: 5, text: 'After archive' });
    expect(result.ok).toBe(false);
    expect(await count(id)).toBe(1);

    const view = await getGatewayView(db, id, { requestOrigin: ORIGIN });
    expect(view?.archived).toBe(true);
  });
});

describe('the optional public review path', () => {
  it('M. without a link, the thank-you page simply ends', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    const resolved = await resolvePublicGateway(db, token);
    expect(resolved?.publicReviewUrl).toBeNull();
    expect(resolved?.publicReviewLabel).toBeNull();
  });

  it('N. with a link, every customer is offered exactly that link', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    const saved = await savePublicReviewUrl(db, id, 'https://g.page/r/abc/review');
    expect(saved.ok).toBe(true);
    const resolved = await resolvePublicGateway(db, token);
    expect(resolved?.publicReviewUrl).toBe('https://g.page/r/abc/review');
    expect(resolved?.publicReviewLabel).toBe('Leave a Google review');

    const other = await savePublicReviewUrl(db, id, 'https://www.justdial.com/x/write-review');
    expect(other.ok).toBe(true);
    expect((await resolvePublicGateway(db, token))?.publicReviewLabel).toBe('Leave a public review');

    const bad = await savePublicReviewUrl(db, id, 'javascript:alert(1)');
    expect(bad.ok).toBe(false);
    const cleared = await savePublicReviewUrl(db, id, '');
    expect(cleared.ok).toBe(true);
    expect((await resolvePublicGateway(db, token))?.publicReviewUrl).toBeNull();
  });

  it('O/P. the link is the same after negative and after positive feedback — nothing is inspected', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await savePublicReviewUrl(db, id, 'https://g.page/r/abc/review');

    const negative = await submitOk(token, { stars: 1, text: 'Terrible, cold food and rude staff.' });
    const afterNegative = await resolvePublicGateway(db, token);
    const positive = await submitOk(token, { stars: 5, text: 'Wonderful evening, lovely staff.' }, { now: later(1000) });
    const afterPositive = await resolvePublicGateway(db, token);

    expect(afterNegative?.publicReviewUrl).toBe('https://g.page/r/abc/review');
    expect(afterPositive?.publicReviewUrl).toBe('https://g.page/r/abc/review');
    expect(afterNegative).toEqual(afterPositive);

    // What the submission hands back carries nothing a thank-you page could gate on.
    for (const outcome of [negative, positive]) {
      // `clientId` is for the server — it starts the reading — and never
      // reaches the redirect, which the compliance suite checks separately.
      expect(Object.keys(outcome).sort()).toEqual(['clientId', 'itemId', 'stored', 'token']);
    }
  });
});

describe('one pipeline: the same feedback the operator pastes', () => {
  it('reaches the theme summary, the intelligence and the owner pages', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    for (let i = 0; i < 6; i += 1) {
      await submitOk(token, { stars: 2, text: `Waited far too long for the food, service was slow (visit ${i})` }, { now: later(i * 1000) });
    }
    for (let i = 0; i < 4; i += 1) {
      await submitOk(token, { stars: 5, text: `The biryani was excellent, really tasty (visit ${i})` }, { now: later(60_000 + i * 1000) });
    }
    await readAll(id);

    const themes = await getThemeSummary(db, id, 'restaurant');
    expect(themes.analysedCount).toBe(10);
    expect(themes.issues.find((t) => t.key === 'service_speed')?.count).toBe(6);

    const intel = await loadIntelligence(db, { id, businessName: 'Corner Cafe', vertical: 'restaurant' }, NOW);
    expect(intel.totalFeedback).toBe(10);
    expect(intel.intelligence.attention?.themeKey).toBe('service_speed');

    const portal = await getPortalView(db, id, { now: NOW });
    expect(portal?.view.first?.themeKey).toBe('service_speed');
    expect(portal?.view.first?.evidenceCount).toBe(6);

    const reviews = await getReviewsView(
      db,
      id,
      { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null },
      { now: NOW },
    );
    expect(reviews?.total).toBe(10);
    expect(reviews?.items.every((i) => i.sourceLabel === 'Feedback QR')).toBe(true);
    expect(reviews?.sourceOptions.map((s) => s.label)).toContain('Feedback QR');
  });

  it('never waits for a reply nobody can send, but still flags what a person must see', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await submitOk(token, { stars: 1, text: 'Service was very slow and the food arrived cold.' });
    await submitOk(token, { stars: 1, text: 'I got food poisoning after eating here.' }, { now: later(1000) });
    await readAll(id);

    const rows = await listClientFeedback(db, id);
    const complaint = rows.find((r) => r.text.includes('very slow'));
    const harm = rows.find((r) => r.text.includes('poisoning'));
    expect(complaint?.responseAction).toBe('NO_RESPONSE_NEEDED');
    expect(complaint?.priorityRank).toBe(0);
    expect(complaint?.priorityReasons).toEqual([NO_CHANNEL_REASON]);
    expect(harm?.responseAction).toBe('NEEDS_HUMAN');

    const drafted = await draftClientReplies(db, id, { useAi: false, now: NOW });
    expect(drafted.ok).toBe(true);
    if (drafted.ok) expect(drafted.data.drafted).toBe(0);
    expect(rows.every((r) => r.draftText === null)).toBe(true);

    const reviews = await getReviewsView(
      db,
      id,
      { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null },
      { now: NOW },
    );
    expect(reviews?.items.find((i) => i.text.includes('very slow'))?.replyState).toBeNull();
    expect(reviews?.replyWorth).toBe(1);
  });

  it('shows a rating-only submission on the owner pages without inventing words', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await submitOk(token, { stars: 4 });
    await readAll(id);
    const reviews = await getReviewsView(
      db,
      id,
      { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null },
      { now: NOW },
    );
    expect(reviews?.items).toHaveLength(1);
    expect(reviews?.items[0]?.text).toBe('');
    expect(reviews?.items[0]?.stars).toBe(4);
    expect(reviews?.averageRating).toBe(4);
  });

  it('a pasted review with the same wording as an earlier QR submission is skipped as before', async () => {
    const id = await makeClient('Corner Cafe');
    const token = await tokenFor(id);
    await submitOk(token, { stars: 5, text: 'Lovely place, will come again' });
    const pasted = await ingestFeedback(
      db,
      id,
      { text: 'Lovely place, will come again', stars: 5, occurredAt: NOW, source: 'PUBLIC_REVIEW' },
      { now: later(1000), dedupe: { mode: 'EXACT_FOREVER' } },
    );
    expect(pasted.ok && pasted.data.duplicate).toBe(true);
    expect(await count(id)).toBe(1);
  });
});
