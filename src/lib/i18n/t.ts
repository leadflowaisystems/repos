import { DEFAULT_LOCALE, type Locale } from './locale';

/**
 * THE TRANSLATOR.
 *
 * Small on purpose. This is a dictionary lookup with placeholder filling and a
 * fallback — no library, no bundle split, no loader, no network, and above all
 * no model. Translating the interface is a job with exactly one right answer
 * per phrase, decided once by a person and then repeated forever; asking an LLM
 * to redo it on every render would spend tokens to make the portal LESS
 * predictable. Headway's rule that AI is an enhancement and never a dependency
 * applies to its own words too.
 */

/**
 * One phrase in the three languages.
 *
 * Only English is required, and that is the fallback made structural: a key
 * that has not been translated yet is a normal, valid state of this object, so
 * the portal can never be broken by a missing translation — only rendered in
 * English at that spot. Every other design (empty strings, a key shown raw, a
 * throw) fails worse.
 */
export type Phrase = {
  en: string;
  hi?: string;
  mr?: string;
};

export type Namespace = Record<string, Phrase>;

/** Values filled into `{placeholders}`. */
export type Vars = Record<string, string | number>;

/**
 * Fills `{name}` placeholders.
 *
 * Numbers are inserted exactly as they are — no grouping, no locale digits.
 * Hindi and Marathi are read here with Latin digits, and more importantly a
 * number an owner reads must be the number Headway computed. Reformatting is a
 * way for a count to appear to change between languages, and no count may
 * appear to change between languages.
 *
 * An unknown placeholder is left standing rather than blanked, because
 * "{count} of {total}" going out with a visible {total} is a bug that gets
 * noticed and fixed, while a silently missing number is a bug that ships.
 */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

/**
 * The phrase for this key in this language, falling back to English.
 *
 * Two fallbacks, in order:
 *   1. the language is missing this phrase  -> English;
 *   2. the key is missing altogether        -> the key itself.
 *
 * The second cannot happen through normal use: `makeT` is typed to the keys
 * that actually exist, so a typo is a compile error rather than a surprise on
 * an owner's screen. It is kept for the one case types cannot cover — a key
 * assembled at runtime — where showing the key is at least loud.
 */
export function resolve(
  messages: Namespace,
  locale: Locale,
  key: string,
  vars?: Vars,
): string {
  const phrase = messages[key];
  if (!phrase) return key;
  const written = locale === DEFAULT_LOCALE ? phrase.en : phrase[locale];
  return interpolate(written ?? phrase.en, vars);
}

/**
 * The dictionary flattened to one language, ready to cross to the browser.
 *
 * Client components cannot read a cookie, so the workspace shell hands them
 * their words instead. Flattening first means an owner reading English is not
 * made to download Hindi and Marathi as well, and that the fallback has already
 * been applied on the server — the browser receives finished strings and needs
 * no dictionary logic at all.
 */
export function flattenFor(messages: Namespace, locale: Locale): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, phrase] of Object.entries(messages)) {
    const written = locale === DEFAULT_LOCALE ? phrase.en : phrase[locale];
    out[key] = written ?? phrase.en;
  }
  return out;
}

/** A translator over already-flattened strings. Used in the browser. */
export function makeFlatTranslator(
  flat: Record<string, string>,
  locale: Locale,
): Translator {
  const t = ((key: string, vars?: Vars) =>
    interpolate(flat[key] ?? key, vars)) as Translator;
  t.locale = locale;
  t.soft = (key: string) => (flat[key] !== undefined ? flat[key] : null);
  t.plural = (base: string, count: number, vars?: Vars) => {
    const key = `${base}.${count === 1 ? 'one' : 'other'}`;
    return interpolate(flat[key] ?? key, { count, ...vars });
  };
  return t;
}

/**
 * Parameterised by the keys that exist, so a typo is a compile error rather
 * than a stray `home.focus.headline` on an owner's screen. The portal always
 * uses `Translator<MessageKey>`; the bare `Translator` is only for the generic
 * machinery below, which has no dictionary to check against.
 */
export type Translator<K extends string = string> = {
  (key: K, vars?: Vars): string;
  /** The language this translator was built for. */
  locale: Locale;
  /**
   * A phrase if the dictionary has one, otherwise null.
   *
   * For labels that come from DATA rather than from code — a vertical's theme
   * labels live in packs/*.json, so their keys are only known at runtime and
   * cannot be in the typed key union. The caller supplies the pack's own
   * English as the fallback, which is why a missing translation here shows the
   * English label rather than a key.
   */
  soft: (key: string) => string | null;
  /**
   * Picks `<base>.one` or `<base>.other` by count.
   *
   * English, Hindi and Marathi all split the same way — one versus everything
   * else, with zero taking the plural — so one rule covers all three. The count
   * is passed through as `{count}` so the phrase does not have to repeat it.
   */
  plural: (base: string, count: number, vars?: Vars) => string;
};

/** Builds a translator bound to one dictionary and one language. */
export function makeTranslator(messages: Namespace, locale: Locale): Translator {
  const t = ((key: string, vars?: Vars) =>
    resolve(messages, locale, key, vars)) as Translator;
  t.locale = locale;
  t.soft = (key: string) => (messages[key] ? resolve(messages, locale, key) : null);
  t.plural = (base: string, count: number, vars?: Vars) =>
    resolve(messages, locale, `${base}.${count === 1 ? 'one' : 'other'}`, {
      count,
      ...vars,
    });
  return t;
}
