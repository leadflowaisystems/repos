import { describe, expect, it } from 'vitest';
import { getPackOrFallback, listPacks, _resetPackCache } from '@/lib/packs';
import {
  buildKitContent,
  checkPrintableUrl,
  checkReviewUrl,
  computeReadiness,
  renderTemplate,
} from './content';
import { generateQrSvg } from './qr';

_resetPackCache();

const URL_OK = 'https://example.com/review/sunrise';
/** What the card actually carries: this client's own RepOS feedback page. */
const FEEDBACK_URL = 'https://repos.example.com/feedback/gp7f8yv6f9zyauwhvxxysm';

function content(vertical: string, overrides: Record<string, unknown> = {}) {
  return buildKitContent({
    pack: getPackOrFallback(vertical),
    businessName: 'Sunrise Clinic',
    feedbackUrl: FEEDBACK_URL,
    publicReviewUrl: URL_OK,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------

describe('checkReviewUrl — safe, operator-supplied links only', () => {
  it('accepts a plain https link', () => {
    const r = checkReviewUrl(URL_OK);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url).toBe(URL_OK);
  });

  it('accepts http as well as https', () => {
    expect(checkReviewUrl('http://example.com/r').ok).toBe(true);
  });

  it('rejects a blank or missing link with a plain-language reason', () => {
    for (const value of ['', '   ', null, undefined]) {
      const r = checkReviewUrl(value);
      expect(r.ok, String(value)).toBe(false);
      if (!r.ok) expect(r.reason).toContain('No link');
    }
  });

  it('rejects text that is not a link', () => {
    const r = checkReviewUrl('just type your review here');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('https://');
  });

  it('refuses schemes that must never be printed onto a public card', () => {
    for (const value of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///C:/Users/Om/secrets.txt',
      'ftp://example.com/x',
    ]) {
      const r = checkReviewUrl(value);
      expect(r.ok, value).toBe(false);
      if (!r.ok) expect(r.reason).toContain('https://');
    }
  });

  it('is deterministic', () => {
    expect(JSON.stringify(checkReviewUrl(URL_OK))).toBe(
      JSON.stringify(checkReviewUrl(URL_OK)),
    );
  });
});

describe('renderTemplate', () => {
  it('substitutes known tokens', () => {
    expect(
      renderTemplate('Visit {{businessName}} at {{feedbackUrl}}', {
        businessName: 'Sunrise',
        feedbackUrl: FEEDBACK_URL,
      }),
    ).toBe(`Visit Sunrise at ${FEEDBACK_URL}`);
  });

  it('leaves unknown tokens untouched rather than blanking them', () => {
    expect(renderTemplate('Hi {{unknown}}', { businessName: 'x' })).toBe(
      'Hi {{unknown}}',
    );
  });
});

// ---------------------------------------------------------------------------

describe('readiness — nothing here depends on a public listing', () => {
  it('is READY with a business name and a feedback address', () => {
    const r = computeReadiness({ businessName: 'Sunrise Clinic', feedbackUrl: FEEDBACK_URL });
    expect(r.ready).toBe(true);
    expect(r.label).toBe('READY');
    expect(r.blockers).toEqual([]);
  });

  it('is READY for a business with no public review link at all', () => {
    // The whole point of M17: a business that opened yesterday, has no Google
    // listing and never will, can still print its cards this afternoon.
    const c = buildKitContent({
      pack: getPackOrFallback('restaurant'),
      businessName: 'Corner Cafe',
      feedbackUrl: FEEDBACK_URL,
      publicReviewUrl: null,
    });
    expect(c.feedbackUrl).toBe(FEEDBACK_URL);
    expect(c.publicReviewUrl).toBeNull();
    expect(
      computeReadiness({ businessName: 'Corner Cafe', feedbackUrl: FEEDBACK_URL }).ready,
    ).toBe(true);
  });

  it('blocks only when RepOS does not know its own address', () => {
    const r = computeReadiness({ businessName: 'Sunrise Clinic', feedbackUrl: null });
    expect(r.ready).toBe(false);
    expect(r.label).toBe('NEEDS ONE THING');
    expect(r.blockers).toHaveLength(1);
    expect(r.blockers[0]?.key).toBe('feedbackUrl');
    expect(r.blockers[0]?.hint).toContain('Settings');
  });

  it('counts multiple blockers', () => {
    const r = computeReadiness({ businessName: '  ', feedbackUrl: null });
    expect(r.blockers).toHaveLength(2);
    expect(r.label).toBe('NEEDS 2 THINGS');
  });

  it('treats an unsafe address as missing rather than usable', () => {
    const r = computeReadiness({
      businessName: 'Sunrise Clinic',
      feedbackUrl: 'javascript:alert(1)',
    });
    expect(r.ready).toBe(false);
  });
});

describe('the optional public review link', () => {
  it('refuses a RepOS address, which is the mistake an operator would make', () => {
    // An operator who works out that the QR should point at RepOS pastes the
    // feedback address here, and sends people who just left feedback back to
    // the same form.
    for (const own of [FEEDBACK_URL, 'https://repos.example.com/portal/abc123']) {
      const r = checkReviewUrl(own);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain('RepOS address');
    }
  });

  it('still allows those addresses onto the card itself', () => {
    // The card carries exactly that URL, so the printable check must accept it.
    expect(checkPrintableUrl(FEEDBACK_URL).ok).toBe(true);
  });
});

describe('kit content — supplied vs missing URL', () => {
  it('sends every message to the feedback page, never to the public one', () => {
    const c = content('clinic');
    expect(c.feedbackUrl).toBe(FEEDBACK_URL);
    for (const message of c.messages) {
      expect(message.body).not.toContain('{{');
      expect(message.body).toContain('Sunrise Clinic');
      expect(message.body).toContain(FEEDBACK_URL);
      expect(message.body).not.toContain(URL_OK);
    }
  });

  it('produces usable copy with no address yet, marking where it goes', () => {
    const c = content('clinic', { feedbackUrl: null });
    expect(c.feedbackUrl).toBeNull();
    expect(c.headline).toBeTruthy();
    expect(c.messages[0]?.body).toContain('[your feedback page address]');
    expect(c.messages[0]?.body).not.toContain('{{');
  });

  it('lets the operator override the printed name and headline', () => {
    const c = content('clinic', {
      displayName: 'Sunrise',
      headline: 'Tell us how we did',
    });
    expect(c.displayName).toBe('Sunrise');
    expect(c.headline).toBe('Tell us how we did');
    expect(c.messages[0]?.body).toContain('Sunrise');
  });

  it('falls back to the vertical default when an override is blank', () => {
    const withOverride = content('clinic', { headline: '   ' });
    const without = content('clinic');
    expect(withOverride.headline).toBe(without.headline);
  });

  it('is deterministic for identical input', () => {
    expect(JSON.stringify(content('salon'))).toBe(JSON.stringify(content('salon')));
  });

  it('carries the vertical no-incentive rules onto the kit', () => {
    const c = content('clinic');
    expect(c.rules.length).toBeGreaterThan(0);
    expect(c.rules.join(' ').toLowerCase()).toContain('never');
    expect(c.rules.join(' ').toLowerCase()).toMatch(/discount|gift|reward|free/);
  });

  it('contains no customer personal data anywhere', () => {
    const blob = JSON.stringify(content('clinic')).toLowerCase();
    expect(blob).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/); // no email addresses
    expect(blob).not.toMatch(/\b\d{10}\b/); // no bare phone numbers
    expect(blob).not.toContain('customername');
  });
});

// ---------------------------------------------------------------------------
// The universal-architecture proof.
// ---------------------------------------------------------------------------

describe('one workflow, every vertical', () => {
  const ALL = listPacks();

  it('ships more than three verticals', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(7);
  });

  it('builds a complete kit for EVERY pack through the same function', () => {
    for (const pack of ALL) {
      const c = buildKitContent({
        pack,
        businessName: `Test ${pack.label}`,
        feedbackUrl: FEEDBACK_URL,
      });

      expect(c.headline, pack.id).toBeTruthy();
      expect(c.subhead, pack.id).toBeTruthy();
      expect(c.qrCaption, pack.id).toBeTruthy();
      expect(c.assetLabel, pack.id).toBeTruthy();
      expect(c.placement, pack.id).toBeTruthy();
      expect(c.staffScript.english, pack.id).toBeTruthy();
      expect(c.staffScript.marathi, pack.id).toBeTruthy();
      expect(c.messages.length, pack.id).toBeGreaterThanOrEqual(1);
      expect(c.rules.length, pack.id).toBeGreaterThan(0);
      expect(c.feedbackUrl, pack.id).toBe(FEEDBACK_URL);
    }
  });

  it('gives clinic, salon and restaurant genuinely different copy', () => {
    const clinic = content('clinic');
    const salon = content('salon');
    const restaurant = content('restaurant');

    // Headlines must differ from each other.
    const headlines = [clinic.headline, salon.headline, restaurant.headline];
    expect(new Set(headlines).size).toBe(3);

    // And the printed piece is named in that trade's own language.
    expect(clinic.assetLabel).toBe('counter card');
    expect(restaurant.assetLabel).toBe('table card');

    // Restaurant copy must not read like healthcare copy, and vice versa.
    expect(restaurant.headline.toLowerCase()).toContain('food');
    expect(clinic.headline.toLowerCase()).toContain('visit');
    expect(salon.headline.toLowerCase()).toContain('turned out');
    expect(clinic.headline.toLowerCase()).not.toContain('food');
    expect(restaurant.headline.toLowerCase()).not.toContain('visit');
  });

  it('adapts placement and moment per vertical', () => {
    expect(content('restaurant').placement.toLowerCase()).toContain('table');
    expect(content('salon').placement.toLowerCase()).toContain('billing counter');
    expect(content('wedding_vendor').placement.toLowerCase()).toContain('delivery');
    expect(content('gym').placement.toLowerCase()).toContain('front desk');
  });

  it('produces a distinct copyable message for every vertical', () => {
    const bodies = ALL.map(
      (pack) =>
        buildKitContent({ pack, businessName: 'Test', feedbackUrl: FEEDBACK_URL })
          .messages[0]?.body ?? '',
    );
    expect(new Set(bodies).size).toBe(ALL.length);
  });

  it('still produces a usable kit for a pack with no kit block at all', () => {
    const pack = getPackOrFallback('clinic');
    const legacy = { ...pack, kit: undefined };
    const c = buildKitContent({
      pack: legacy,
      businessName: 'Legacy Business',
      feedbackUrl: FEEDBACK_URL,
    });

    // Falls back through contentTemplates, then to a neutral default.
    expect(c.headline).toBeTruthy();
    expect(c.subhead).toBeTruthy();
    expect(c.assetLabel).toBe('counter card');
    expect(c.messages).toHaveLength(1);
    expect(c.messages[0]?.body).toContain('Legacy Business');
    expect(c.messages[0]?.body).toContain(FEEDBACK_URL);
  });
});

// ---------------------------------------------------------------------------

describe('QR generation — local, offline, operator-supplied only', () => {
  it('renders an SVG for a valid link', async () => {
    const r = await generateQrSvg(URL_OK);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.svg.startsWith('<svg')).toBe(true);
    expect(r.svg).toContain('</svg>');
    expect(r.url).toBe(URL_OK);
  });

  it('refuses to encode a missing link', async () => {
    const r = await generateQrSvg(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('No link');
  });

  it('refuses to encode an unsafe scheme', async () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,x']) {
      const r = await generateQrSvg(value);
      expect(r.ok, value).toBe(false);
    }
  });

  it('is deterministic — the same URL always yields the same SVG', async () => {
    const a = await generateQrSvg(URL_OK);
    const b = await generateQrSvg(URL_OK);
    expect(a).toEqual(b);
  });

  it('encodes different URLs differently', async () => {
    const a = await generateQrSvg(URL_OK);
    const b = await generateQrSvg('https://example.com/review/other');
    expect(a.ok && b.ok && a.svg !== b.svg).toBe(true);
  });

  it('works for every vertical, since the QR only ever holds the URL', async () => {
    for (const pack of listPacks()) {
      const c = buildKitContent({
        pack,
        businessName: 'Test',
        feedbackUrl: FEEDBACK_URL,
      });
      const r = await generateQrSvg(c.feedbackUrl);
      expect(r.ok, pack.id).toBe(true);
    }
  });
});
