import { readFileSync, readdirSync } from 'node:fs';
import { join as joinPath, resolve as resolvePath } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_HTML_LANG,
  LOCALE_LABELS,
  isLocale,
  toLocale,
} from '@/lib/i18n/locale';
import { MESSAGES, type MessageKey } from '@/lib/i18n/strings';
import {
  flattenFor,
  interpolate,
  makeFlatTranslator,
  makeTranslator,
  resolve as resolvePhrase,
  type Namespace,
} from '@/lib/i18n/t';

/**
 * THE PORTAL SPEAKS THREE LANGUAGES (M31).
 *
 * An owner who reads Marathi was, until now, doing translation work every time
 * they opened a report about their own shop. These tests hold three promises:
 *
 *   1. NOTHING CHANGES UNLESS SOMEBODY ASKS. English is the default and stays
 *      the default. No header sniffing, no guessing from a phone's settings.
 *   2. A MISSING TRANSLATION IS NEVER A BROKEN SCREEN. It is an English one.
 *   3. THE NUMBERS ARE THE SAME IN ALL THREE. A count an owner reads must be
 *      the count Headway computed, whatever language it is wrapped in.
 *
 * And one thing that must NOT be here: a provider call. Translating an
 * interface is a job with one right answer per phrase, decided once by a person
 * — not something to spend tokens re-deciding on every render.
 */

const ROOT = resolvePath(__dirname, '..');
const STRINGS_DIR = joinPath(ROOT, 'src', 'lib', 'i18n', 'strings');

const namespaceFiles = readdirSync(STRINGS_DIR).filter(
  (f) => f.endsWith('.ts') && f !== 'index.ts',
);

// ---------------------------------------------------------------------------
// 1. English is the default, and stays it
// ---------------------------------------------------------------------------

describe('English is the default', () => {
  it('names English as the default language', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('offers exactly English, Hindi and Marathi', () => {
    expect([...LOCALES]).toEqual(['en', 'hi', 'mr']);
  });

  it('answers English for anything it does not recognise', () => {
    // A hand-edited cookie, a value from an older release, junk, nothing.
    for (const junk of ['', 'fr', 'EN', 'en-GB', 'xx', null, undefined, 7, {}, []]) {
      expect(toLocale(junk), String(junk)).toBe('en');
    }
  });

  it('recognises only the three it actually speaks', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('hi')).toBe(true);
    expect(isLocale('mr')).toBe(true);
    expect(isLocale('bn')).toBe(false);
    expect(isLocale('en-IN')).toBe(false);
  });

  it('never reads the browser’s Accept-Language anywhere', () => {
    // The portal must not change language under somebody who never asked it
    // to. The only input is the cookie the owner set in Account.
    //
    // Comments are stripped first: the modules here DOCUMENT that they ignore
    // Accept-Language, and prose promising not to do a thing must not read as
    // evidence of doing it.
    const code = readdirSync(joinPath(ROOT, 'src', 'lib', 'i18n'))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => readFileSync(joinPath(ROOT, 'src', 'lib', 'i18n', f), 'utf8'))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(code.toLowerCase()).not.toContain('accept-language');
    expect(code).not.toContain('navigator.language');
    // The only request input the layer takes is the cookie.
    expect(code).not.toContain('headers()');
  });

  it('reads the language from the cookie and nothing else', () => {
    const request = readFileSync(joinPath(ROOT, 'src', 'lib', 'i18n', 'request.ts'), 'utf8');
    expect(request).toContain('LOCALE_COOKIE');
    expect(request).toContain('cookies()');
  });
});

// ---------------------------------------------------------------------------
// 2. The Account selector offers all three, each in its own script
// ---------------------------------------------------------------------------

describe('the Account language selector', () => {
  const form = readFileSync(
    joinPath(ROOT, 'src', 'components', 'forms', 'language-form.tsx'),
    'utf8',
  );
  const accountPage = readFileSync(
    joinPath(ROOT, 'src', 'app', '(workspace)', 'workspace', '[clientId]', 'account', 'page.tsx'),
    'utf8',
  );

  it('names each language in its own script', () => {
    // Somebody looking for Marathi has not found their language yet. They are
    // looking for "मराठी", not for "Marathi".
    expect(LOCALE_LABELS.en).toBe('English');
    expect(LOCALE_LABELS.hi).toBe('हिन्दी');
    expect(LOCALE_LABELS.mr).toBe('मराठी');
  });

  it('lives on the Account page', () => {
    expect(accountPage).toContain('LanguageForm');
    expect(accountPage).toContain("t('account.language.title')");
  });

  it('renders one button per language, all three on screen at once', () => {
    // Not a <select>: on a phone that hides two of the three behind a tap.
    expect(form).toContain('LOCALES.map');
    expect(form).toContain('type="submit"');
    expect(form).toContain('name="locale"');
    expect(form).not.toContain('<select');
  });

  it('marks the language currently in use', () => {
    expect(form).toContain('aria-current');
  });

  it('has a phrase for every part of the selector in all three languages', () => {
    for (const key of [
      'account.language.title',
      'account.language.help',
      'account.language.scope',
      'account.language.current',
      'account.language.choose',
    ] as MessageKey[]) {
      const phrase = MESSAGES[key];
      expect(phrase, key).toBeTruthy();
      expect(phrase.hi, `${key} has no Hindi`).toBeTruthy();
      expect(phrase.mr, `${key} has no Marathi`).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// 3 & 4. Choosing Hindi or Marathi actually changes the words
// ---------------------------------------------------------------------------

describe('choosing a language changes the words', () => {
  const translated = (Object.keys(MESSAGES) as MessageKey[]).filter(
    (k) => MESSAGES[k].hi && MESSAGES[k].mr,
  );

  it('has something to translate at all', () => {
    expect(translated.length).toBeGreaterThan(0);
  });

  it('returns Hindi for a Hindi reader', () => {
    const t = makeTranslator(MESSAGES, 'hi');
    for (const key of translated) {
      expect(t(key), key).toBe(MESSAGES[key].hi);
    }
  });

  it('returns Marathi for a Marathi reader', () => {
    const t = makeTranslator(MESSAGES, 'mr');
    for (const key of translated) {
      expect(t(key), key).toBe(MESSAGES[key].mr);
    }
  });

  it('actually writes Hindi and Marathi in Devanagari, not English twice over', () => {
    // A "translation" that is the English string copied across is the failure
    // mode this whole file exists to catch.
    const devanagari = /[ऀ-ॿ]/;
    let checked = 0;
    for (const key of translated) {
      const phrase = MESSAGES[key];
      // Skip phrases that are legitimately identical in all three — a number,
      // a placeholder-only string, or the brand on its own. "Headway" is a
      // name: it is written the same way in every language, on the printed
      // card and in the wordmark, and translating it would make it a different
      // brand. With the brand removed there has to be a real word left before
      // a translation can be demanded.
      const translatable = phrase.en.replace(/Headway/g, '').trim();
      if (!/[a-z]{4}/i.test(translatable)) continue;
      checked += 1;
      expect(devanagari.test(phrase.hi as string), `${key} Hindi is not Devanagari`).toBe(true);
      expect(devanagari.test(phrase.mr as string), `${key} Marathi is not Devanagari`).toBe(true);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('sets the document language so screen readers pronounce it correctly', () => {
    expect(LOCALE_HTML_LANG).toEqual({ en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' });
    const layout = readFileSync(
      joinPath(ROOT, 'src', 'app', '(workspace)', 'layout.tsx'),
      'utf8',
    );
    expect(layout).toContain('LOCALE_HTML_LANG[locale]');
  });
});

// ---------------------------------------------------------------------------
// 5 & 6. The choice sticks, and can be undone
// ---------------------------------------------------------------------------

describe('the choice persists, and English can be chosen again', () => {
  it('remembers the choice for a year', () => {
    expect(LOCALE_COOKIE).toBe('headway_locale');
    expect(LOCALE_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 365);
  });

  it('writes the cookie so it survives closing the browser', async () => {
    const set = vi.fn();
    vi.doMock('next/headers', () => ({ cookies: async () => ({ set, get: () => undefined }) }));
    vi.doMock('@/lib/auth/authorize', () => ({
      currentActor: async () => ({ userId: 'u1', isPlatformAdmin: false }),
    }));
    vi.doMock('next/cache', () => ({ revalidatePath: () => {} }));
    vi.doMock('@/lib/db', () => ({ prisma: {} }));

    const { setLocaleAction } = await import('@/lib/actions/locale');

    const form = new FormData();
    form.set('locale', 'mr');
    form.set('clientId', 'c1');
    const result = await setLocaleAction({ ok: false, message: '', errors: {} }, form);

    expect(result.ok).toBe(true);
    expect(set).toHaveBeenCalledWith(
      LOCALE_COOKIE,
      'mr',
      expect.objectContaining({
        path: '/',
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: 'lax',
        httpOnly: true,
      }),
    );
    vi.doUnmock('next/headers');
    vi.resetModules();
  });

  it('accepts English again, and refuses to store junk', async () => {
    const set = vi.fn();
    vi.doMock('next/headers', () => ({ cookies: async () => ({ set, get: () => undefined }) }));
    vi.doMock('@/lib/auth/authorize', () => ({
      currentActor: async () => ({ userId: 'u1', isPlatformAdmin: false }),
    }));
    vi.doMock('next/cache', () => ({ revalidatePath: () => {} }));
    vi.doMock('@/lib/db', () => ({ prisma: {} }));

    const { setLocaleAction } = await import('@/lib/actions/locale');

    const back = new FormData();
    back.set('locale', 'en');
    await setLocaleAction({ ok: false, message: '', errors: {} }, back);
    expect(set).toHaveBeenLastCalledWith(LOCALE_COOKIE, 'en', expect.anything());

    const junk = new FormData();
    junk.set('locale', 'klingon');
    await setLocaleAction({ ok: false, message: '', errors: {} }, junk);
    // Not stored as "klingon": an unknown language means English.
    expect(set).toHaveBeenLastCalledWith(LOCALE_COOKIE, 'en', expect.anything());

    vi.doUnmock('next/headers');
    vi.resetModules();
  });
});

// ---------------------------------------------------------------------------
// 7. A missing translation is an English screen, never a broken one
// ---------------------------------------------------------------------------

describe('missing translations fall back to English', () => {
  const partial: Namespace = {
    'x.both': { en: 'Feedback', hi: 'फ़ीडबैक', mr: 'फीडबॅक' },
    'x.englishOnly': { en: 'Only English here' },
    'x.hindiOnly': { en: 'English source', hi: 'सिर्फ़ हिन्दी' },
  };

  it('uses English when the language has no phrase', () => {
    expect(resolvePhrase(partial, 'hi', 'x.englishOnly')).toBe('Only English here');
    expect(resolvePhrase(partial, 'mr', 'x.englishOnly')).toBe('Only English here');
    expect(resolvePhrase(partial, 'mr', 'x.hindiOnly')).toBe('English source');
  });

  it('uses the translation when there is one', () => {
    expect(resolvePhrase(partial, 'hi', 'x.both')).toBe('फ़ीडबैक');
    expect(resolvePhrase(partial, 'mr', 'x.both')).toBe('फीडबॅक');
    expect(resolvePhrase(partial, 'en', 'x.both')).toBe('Feedback');
  });

  it('falls back inside the flattened copy sent to the browser too', () => {
    const flat = flattenFor(partial, 'mr');
    expect(flat['x.englishOnly']).toBe('Only English here');
    expect(flat['x.both']).toBe('फीडबॅक');
  });

  it('sends only one language to the browser', () => {
    // An owner reading English must not be made to download Hindi and Marathi.
    const flat = flattenFor(MESSAGES, 'en');
    for (const value of Object.values(flat)) {
      expect(typeof value).toBe('string');
    }
    expect(Object.keys(flat).length).toBe(Object.keys(MESSAGES).length);
  });

  it('never shows a raw key for a phrase that exists', () => {
    for (const locale of LOCALES) {
      const t = makeTranslator(MESSAGES, locale);
      for (const key of Object.keys(MESSAGES)) {
        expect(t(key), `${key} in ${locale}`).not.toBe(key === t(key) ? key : '');
        expect(t(key).length, `${key} in ${locale} is empty`).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 9. The numbers are the same in every language
// ---------------------------------------------------------------------------

describe('numbers and data are untouched by language', () => {
  it('inserts a number exactly as given — no grouping, no Devanagari digits', () => {
    expect(interpolate('{count} of {total}', { count: 35, total: 90 })).toBe('35 of 90');
    expect(interpolate('{n}', { n: 1234567 })).toBe('1234567');
  });

  it('fills the same numbers into all three languages', () => {
    const dict: Namespace = {
      'x.count': {
        en: '{count} of {total} feedback entries mention {thing}.',
        hi: '{total} में से {count} फ़ीडबैक में {thing} का ज़िक्र है।',
        mr: '{total} पैकी {count} फीडबॅकमध्ये {thing} चा उल्लेख आहे.',
      },
    };
    const vars = { count: 35, total: 90, thing: 'slow service' };
    for (const locale of LOCALES) {
      const out = resolvePhrase(dict, locale, 'x.count', vars);
      expect(out, locale).toContain('35');
      expect(out, locale).toContain('90');
    }
  });

  it('leaves an unfilled placeholder visible rather than blanking it', () => {
    // A visible {total} is a bug somebody reports. A silently missing number
    // is a bug that ships.
    expect(interpolate('{count} of {total}', { count: 3 })).toBe('3 of {total}');
  });

  it('splits plurals the same way in all three languages', () => {
    const dict: Namespace = {
      'x.day.one': { en: '{count} day', hi: '{count} दिन', mr: '{count} दिवस' },
      'x.day.other': { en: '{count} days', hi: '{count} दिन', mr: '{count} दिवस' },
    };
    for (const locale of LOCALES) {
      const t = makeTranslator(dict, locale);
      expect(t.plural('x.day', 1), locale).toContain('1');
      expect(t.plural('x.day', 5), locale).toContain('5');
      // Zero takes the plural in all three.
      expect(t.plural('x.day', 0), locale).toBe(t.plural('x.day', 5).replace('5', '0'));
    }
  });
});

// ---------------------------------------------------------------------------
// 10 & 11. Nothing internal moved, and no tokens are spent on this
// ---------------------------------------------------------------------------

describe('the translation layer stays out of everything else', () => {
  it('makes no AI call, anywhere in the i18n layer', () => {
    const dir = joinPath(ROOT, 'src', 'lib', 'i18n');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = joinPath(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts')) files.push(full);
      }
    };
    walk(dir);
    files.push(joinPath(ROOT, 'src', 'lib', 'actions', 'locale.ts'));
    files.push(joinPath(ROOT, 'src', 'components', 'forms', 'language-form.tsx'));
    files.push(joinPath(ROOT, 'src', 'components', 'portal', 'locale-provider.tsx'));

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, `${file} imports AI`).not.toMatch(/from '@\/lib\/ai/);
      expect(source, `${file} calls a provider`).not.toContain('runCompletion');
      expect(source, `${file} reaches the network`).not.toContain('fetch(');
      expect(source, `${file} names a model`).not.toContain('groq');
    }
  });

  it('touches no database table, column or policy', () => {
    // The language is a cookie. Choosing Marathi must not be able to write to
    // a business's data, so there is nothing here that could.
    const action = readFileSync(joinPath(ROOT, 'src', 'lib', 'actions', 'locale.ts'), 'utf8');
    expect(action).not.toMatch(/prisma\.\w+\.(update|create|upsert|delete)/);
    const schema = readFileSync(joinPath(ROOT, 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).not.toContain('portalLocale');
    expect(schema).not.toContain('preferredLanguage');
  });

  it('adds no route and renames nothing', () => {
    const routes = readdirSync(
      joinPath(ROOT, 'src', 'app', '(workspace)', 'workspace', '[clientId]'),
      { withFileTypes: true },
    )
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    // The same eight sections as before this pass. Language is a setting on
    // Account, not a new page, and not a path segment.
    expect(routes).toEqual([
      'account',
      'analysis',
      'checkin',
      'improvements',
      'kit',
      'pulse',
      'review',
      'reviews',
      'team',
    ]);
  });

  it('leaves the AI architecture exactly as M30 left it', () => {
    const budget = readFileSync(joinPath(ROOT, 'src', 'lib', 'ai', 'budget.ts'), 'utf8');
    expect(budget).toContain('AI_DAILY_TOKEN_BUDGET = 50_000');
    const groq = readFileSync(joinPath(ROOT, 'src', 'lib', 'ai', 'groq.ts'), 'utf8');
    expect(groq).toContain("DEFAULT_MODEL = 'openai/gpt-oss-120b'");
    const route = readFileSync(joinPath(ROOT, 'src', 'lib', 'ai', 'route.ts'), 'utf8');
    expect(route).toContain('MIN_TEXT_FOR_AI');
  });
});

// ---------------------------------------------------------------------------
// The dictionary itself has to hold together
// ---------------------------------------------------------------------------

describe('the dictionary is internally sound', () => {
  it('defines every key exactly once across all namespace files', () => {
    // The namespaces are spread into one object. A key defined in two files
    // would silently lose one of its definitions, and the loser would be
    // whichever file happens to be spread first.
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const file of namespaceFiles) {
      const source = readFileSync(joinPath(STRINGS_DIR, file), 'utf8');
      for (const match of source.matchAll(/^\s{2}'([\w.-]+)':\s*\{/gm)) {
        const key = match[1] as string;
        const first = seen.get(key);
        if (first) duplicates.push(`${key} in both ${first} and ${file}`);
        else seen.set(key, file);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('gives every phrase a non-empty English source', () => {
    for (const [key, phrase] of Object.entries(MESSAGES)) {
      expect(phrase.en, `${key} has no English`).toBeTruthy();
      expect(phrase.en.trim(), `${key} English is blank`).not.toBe('');
    }
  });

  it('uses the same placeholders in all three languages', () => {
    // A Hindi phrase that forgot {count} would quietly drop a number an owner
    // is entitled to see.
    const names = (s: string) =>
      [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();
    for (const [key, phrase] of Object.entries(MESSAGES)) {
      const en = names(phrase.en);
      if (phrase.hi) expect(names(phrase.hi), `${key} Hindi placeholders`).toEqual(en);
      if (phrase.mr) expect(names(phrase.mr), `${key} Marathi placeholders`).toEqual(en);
    }
  });

  it('keeps every key inside a declared namespace', () => {
    const prefixes = namespaceFiles.map((f) => f.replace(/\.ts$/, ''));
    for (const key of Object.keys(MESSAGES)) {
      const prefix = key.split('.')[0] as string;
      expect(prefixes, `${key} is not in a known namespace`).toContain(prefix);
    }
  });

  it('pairs every plural key with its partner', () => {
    const keys = Object.keys(MESSAGES);
    for (const key of keys) {
      if (key.endsWith('.one')) {
        expect(keys, `${key} has no .other`).toContain(`${key.slice(0, -4)}.other`);
      }
      if (key.endsWith('.other')) {
        expect(keys, `${key} has no .one`).toContain(`${key.slice(0, -6)}.one`);
      }
    }
  });

  it('translates for the browser without a dictionary crossing the wire', () => {
    const flat = flattenFor(MESSAGES, 'hi');
    const t = makeFlatTranslator(flat, 'hi');
    for (const key of Object.keys(MESSAGES).slice(0, 50)) {
      expect(typeof t(key)).toBe('string');
    }
  });
});
