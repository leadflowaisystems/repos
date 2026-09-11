import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES, type Locale } from '@/lib/i18n/locale';
import { MESSAGES } from '@/lib/i18n/strings';
import { translatorFor } from '@/lib/i18n/translator';
import { sinceLabel } from '@/lib/retention/service';

/**
 * THE LAST TWO ENGLISH-ONLY WORDS IN THE WORKSPACE (M38).
 *
 * After M31 put the portal into three languages, two things on every Hindi or
 * Marathi screen were still English: the heading over "since you were last
 * here" on Home — six hand-written sentences in `sinceLabel` — and the
 * "Sign out" button in the header, a literal in a server component that had
 * no way to read the provider.
 *
 * Both now come from the dictionary. The English is unchanged to the letter
 * (`tests/m21.retention.test.ts` still asserts the old sentences), the Hindi
 * and Marathi carry the count where their grammar wants it, and the operator
 * console — not localized by design — keeps its English default for the
 * button without being handed a word.
 */

const ROOT = resolve(__dirname, '..');
const DEVANAGARI = /[ऀ-ॿ]/;

describe('the "since your last visit" heading', () => {
  const GAPS = [0, 1, 3, 9, 21, 90];

  it('reads the same English it always did', () => {
    expect(sinceLabel(0)).toBe('Since your visit earlier today');
    expect(sinceLabel(1)).toBe('Since yesterday');
    expect(sinceLabel(3)).toBe('Since your last visit, 3 days ago');
    expect(sinceLabel(9)).toBe('Since your last visit, a week ago');
    expect(sinceLabel(21)).toBe('Since your last visit, 3 weeks ago');
    expect(sinceLabel(90)).toBe('Since your last visit, 3 months ago');
    // Handing over the English translator changes nothing.
    for (const days of GAPS) expect(sinceLabel(days, translatorFor('en'))).toBe(sinceLabel(days));
  });

  it.each(['hi', 'mr'] as Locale[])('is written in %s, with the same figure, and no hole left open', (locale) => {
    const t = translatorFor(locale);
    for (const days of GAPS) {
      const line = sinceLabel(days, t);
      expect(line, `${locale} ${days}`).toMatch(DEVANAGARI);
      expect(line, `${locale} ${days}`).not.toBe(sinceLabel(days));
      expect(line, `${locale} ${days}`).not.toMatch(/\{count\}|\{days\}/);
      expect(line, `${locale} ${days}`).not.toMatch(/pulse\.since/);
    }
    // The number an owner reads is the number Headway computed, Latin digits,
    // in every language — three days, three weeks, three months.
    expect(sinceLabel(3, t)).toContain('3');
    expect(sinceLabel(21, t)).toContain('3');
    expect(sinceLabel(90, t)).toContain('3');
    // Today and yesterday carry no figure at all, in any language.
    expect(sinceLabel(0, t)).not.toMatch(/\d/);
    expect(sinceLabel(1, t)).not.toMatch(/\d/);
  });

  it('has every phrase in all three languages, with a singular and a plural where a count is dropped in', () => {
    const keys = [
      'pulse.since.heading.today',
      'pulse.since.heading.yesterday',
      'pulse.since.heading.days.one',
      'pulse.since.heading.days.other',
      'pulse.since.heading.week',
      'pulse.since.heading.weeks.one',
      'pulse.since.heading.weeks.other',
      'pulse.since.heading.months.one',
      'pulse.since.heading.months.other',
    ] as const;
    for (const key of keys) {
      const phrase = MESSAGES[key];
      expect(phrase.en, key).toBeTruthy();
      expect(phrase.hi, key).toMatch(DEVANAGARI);
      expect(phrase.mr, key).toMatch(DEVANAGARI);
      // Whole sentences: the Hindi and Marathi never start with the number.
      expect(phrase.hi, key).not.toMatch(/^\{count\}/);
      expect(phrase.mr, key).not.toMatch(/^\{count\}/);
    }
  });

  it('is handed the owner\'s language by the Home panel', () => {
    const source = readFileSync(join(ROOT, 'src', 'components', 'workspace', 'since-visit.tsx'), 'utf8');
    expect(source).toContain('sinceLabel(since.daysAgo, t)');
    expect(source).not.toMatch(/sinceLabel\(since\.daysAgo\)/);
  });
});

describe('the "Sign out" button', () => {
  it('has its word in all three languages', () => {
    const phrase = MESSAGES['nav.signOut'];
    expect(phrase.en).toBe('Sign out');
    expect(phrase.hi).toMatch(DEVANAGARI);
    expect(phrase.mr).toMatch(DEVANAGARI);
    for (const locale of LOCALES) {
      expect(translatorFor(locale)('nav.signOut')).toBe(phrase[locale] ?? phrase.en);
    }
  });

  it('is handed the word by the workspace, and keeps its English default for the operator console', () => {
    const button = readFileSync(join(ROOT, 'src', 'components', 'sign-out.tsx'), 'utf8');
    expect(button).toMatch(/label = 'Sign out'/);
    expect(button).toContain('{label}');
    // No literal left in the markup.
    expect(button).not.toMatch(/>\s*Sign out\s*</);

    const workspace = readFileSync(
      join(ROOT, 'src', 'app', '(workspace)', 'workspace', '[clientId]', 'layout.tsx'),
      'utf8',
    );
    expect(workspace).toContain(`<SignOutButton variant="inline" label={t('nav.signOut')} />`);

    // The operator console is not localized by design: it renders the button
    // without a label and reads the English default.
    const operator = readFileSync(join(ROOT, 'src', 'app', '(app)', 'layout.tsx'), 'utf8');
    expect(operator).toContain('<SignOutButton />');
    expect(operator).not.toContain('nav.signOut');
  });
});
