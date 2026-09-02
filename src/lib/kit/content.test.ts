import { describe, expect, it } from 'vitest';
import { getPackOrFallback, listPacks, _resetPackCache } from '@/lib/packs';
import {
  buildKitContent,
  checkReviewUrl,
  computeReadiness,
  renderTemplate,
} from './content';
import { generateQrSvg } from './qr';

_resetPackCache();

const URL_OK = 'https://example.com/review/sunrise';

function content(vertical: string, overrides: Record<string, unknown> = {}) {
  return buildKitContent({
    pack: getPackOrFallback(vertical),
    businessName: 'Sunrise Clinic',
    reviewUrl: URL_OK,
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
      renderTemplate('Visit {{businessName}} at {{reviewUrl}}', {
        businessName: 'Sunrise',
        reviewUrl: URL_OK,
      }),
    ).toBe(`Visit Sunrise at ${URL_OK}`);
  });

  it('leaves unknown tokens untouched rather than blanking them', () => {
    expect(renderTemplate('Hi {{unknown}}', { businessName: 'x' })).toBe(
      'Hi {{unknown}}',
    );
  });
});

// ---------------------------------------------------------------------------

describe('readiness', () => {
  it('is READY when the business name and link are both present', () => {
    const r = computeReadiness({ businessName: 'Sunrise Clinic', reviewUrl: URL_OK });
    expect(r.ready).toBe(true);
    expect(r.label).toBe('READY');
    expect(r.blockers).toEqual([]);
  });

  it('says NEEDS ONE THING when only the link is missing', () => {
    const r = computeReadiness({ businessName: 'Sunrise Clinic', reviewUrl: null });
    expect(r.ready).toBe(false);
    expect(r.label).toBe('NEEDS ONE THING');
    expect(r.blockers).toHaveLength(1);
    expect(r.blockers[0]?.key).toBe('reviewUrl');
    expect(r.headline).toContain('add the public review link');
  });

  it('explains exactly what the operator has to supply', () => {
    const r = computeReadiness({ businessName: 'Sunrise Clinic', reviewUrl: '' });
    expect(r.blockers[0]?.hint).toContain('copy the "write a review" link');
    expect(r.blockers[0]?.hint).toContain('never looks it up for you');
  });

  it('counts multiple blockers', () => {
    const r = computeReadiness({ businessName: '  ', reviewUrl: null });
    expect(r.blockers).toHaveLength(2);
    expect(r.label).toBe('NEEDS 2 THINGS');
  });

  it('treats an unsafe link as missing rather than usable', () => {
    const r = computeReadiness({
      businessName: 'Sunrise Clinic',
      reviewUrl: 'javascript:alert(1)',
    });
    expect(r.ready).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('kit content — supplied vs missing URL', () => {
  it('encodes the supplied URL and resolves every token', () => {
    const c = content('clinic');
    expect(c.reviewUrl).toBe(URL_OK);
    for (const message of c.messages) {
      expect(message.body).not.toContain('{{');
      expect(message.body).toContain('Sunrise Clinic');
    }
    expect(c.messages[0]?.body).toContain(URL_OK);
  });

  it('produces usable copy with no URL, marking where the link goes', () => {
    const c = content('clinic', { reviewUrl: null });
    expect(c.reviewUrl).toBeNull();
    expect(c.headline).toBeTruthy();
    expect(c.messages[0]?.body).toContain('[add your public review link]');
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
        reviewUrl: URL_OK,
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
      expect(c.reviewUrl, pack.id).toBe(URL_OK);
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
        buildKitContent({ pack, businessName: 'Test', reviewUrl: URL_OK })
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
      reviewUrl: URL_OK,
    });

    // Falls back through contentTemplates, then to a neutral default.
    expect(c.headline).toBeTruthy();
    expect(c.subhead).toBeTruthy();
    expect(c.assetLabel).toBe('counter card');
    expect(c.messages).toHaveLength(1);
    expect(c.messages[0]?.body).toContain('Legacy Business');
    expect(c.messages[0]?.body).toContain(URL_OK);
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
        reviewUrl: URL_OK,
      });
      const r = await generateQrSvg(c.reviewUrl);
      expect(r.ok, pack.id).toBe(true);
    }
  });
});
