import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join as joinPath, relative, resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BANNED_IN_OWNER_TEXT, GLOSSARY, PREFERRED_INSTEAD } from '@/lib/i18n/glossary';
import { MESSAGES } from '@/lib/i18n/strings';

/**
 * THE PLAIN-ENGLISH STANDARD, MADE CHECKABLE (M31).
 *
 * "Would a normal local businessman read this once and understand it?" is a
 * judgement, and judgements drift. What does not drift is a list of the
 * specific habits that failed that test, so this file holds the portal to
 * those — and holds it there after the next person edits a sentence.
 *
 * The worst habit, and the reason the pass happened: saying a plain thing the
 * long way round. "Customers are not unhappy about your food taste and quality"
 * spends six words avoiding "Customers like your food".
 *
 * COMMENTS ARE STRIPPED BEFORE SEARCHING. Several modules now document the
 * wording they moved away from, quoting the old sentence. Prose explaining why
 * a phrase was removed must not read as evidence that it is still there.
 */

const ROOT = resolvePath(__dirname, '..');

/**
 * The portal an owner actually reads. Operator console and marketing excluded,
 * and so is `src/lib/i18n` — the glossary's job is to LIST the banned words, so
 * scanning it would report the rulebook as the offender. The dictionary's own
 * English is checked separately, against MESSAGES.
 */
const OWNER_FACING_DIRS = [
  joinPath(ROOT, 'src', 'app', '(workspace)'),
  joinPath(ROOT, 'src', 'components', 'portal'),
  joinPath(ROOT, 'src', 'components', 'workspace'),
  joinPath(ROOT, 'src', 'lib', 'portal'),
];

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = joinPath(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Source with comments removed, so documentation is never mistaken for code. */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Only the words an owner can actually SEE.
 *
 * Identifiers are not owner-facing text, and renaming them was explicitly out
 * of scope: `issueTaxonomy` is a field name, not a sentence, and a rule that
 * cannot tell the two apart would demand the wrong change. So this pulls out
 * string and template literals plus JSX text, and drops `${...}` holes — what
 * is left is what gets rendered.
 */
function ownerTextOf(file: string): string {
  const code = codeOf(file)
    // Attribute values that are identifiers, not sentences. `name="sentiment"`
    // is the query-parameter an owner may have bookmarked, and renaming it was
    // explicitly out of scope — so it must not be reported as banned wording.
    // `aria-label` is deliberately NOT in this list: a screen reader reads it
    // aloud, which makes it owner-facing text like any other.
    .replace(
      /\b(?:name|value|id|key|type|href|htmlFor|className|role|rel|target|method|action|src|alt|charSet|encType|autoComplete|inputMode|data-[\w-]+|aria-(?:controls|labelledby|describedby|hidden))\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\})/g,
      ' ',
    );
  const chunks: string[] = [];

  for (const m of code.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) chunks.push(m[1] as string);
  for (const m of code.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) chunks.push(m[1] as string);
  for (const m of code.matchAll(/`((?:[^`\\]|\\.)*)`/gs)) {
    chunks.push((m[1] as string).replace(/\$\{[^}]*\}/g, ' '));
  }
  // JSX text between tags: >  Some words  <
  //
  // Deliberately strict. A loose `>([^<>{}]+)<` also matches ordinary code in
  // a .tsx file — `stars >= 1 && stars <= 5` and every generic like
  // `Record<K, V>` — which reported identifiers such as `SentimentBar` and
  // `search.sentiment` as banned wording. Requiring the run to start with a
  // letter and to contain only prose characters keeps it to actual text.
  for (const m of code.matchAll(/>\s*([A-Za-z][A-Za-z0-9 ,.'’!?%&·—–-]{3,})\s*</g)) {
    chunks.push(m[1] as string);
  }

  // Only chunks that read like a SENTENCE. An owner-facing string is prose:
  // at least two words separated by a space. Identifiers never are —
  // `SentimentBar`, `SENTIMENT_DOT` and `search.sentiment` all survive the
  // extraction above but are code, and this is what tells them apart. Chunks
  // carrying obvious code punctuation are dropped for the same reason.
  return chunks
    .map((c) => c.trim())
    .filter(
      (c) =>
        /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(c) &&
        !/[;{}]|=>|::|\breturn\b|\bconst\b|\btypeof\b/.test(c),
    )
    .join('\n');
}

const OWNER_FILES = OWNER_FACING_DIRS.flatMap(walk);

describe('the owner-facing portal avoids the banned habits', () => {
  it('reads a meaningful number of files', () => {
    expect(OWNER_FILES.length).toBeGreaterThan(20);
  });

  for (const phrase of BANNED_IN_OWNER_TEXT) {
    it(`never says “${phrase}”`, () => {
      const offenders: string[] = [];
      for (const file of OWNER_FILES) {
        const code = ownerTextOf(file);
        const at = code.toLowerCase().indexOf(phrase.toLowerCase());
        if (at === -1) continue;
        const line = code.slice(0, at).split('\n').length;
        offenders.push(`${relative(ROOT, file)}:${line}`);
      }
      expect(offenders, `“${phrase}” still appears`).toEqual([]);
    });
  }

  it('never says “pieces of feedback” — they are feedback entries', () => {
    // The phrase the owner meets most often on every screen.
    const offenders: string[] = [];
    for (const file of OWNER_FILES) {
      if (ownerTextOf(file).toLowerCase().includes('pieces of feedback')) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never tells an owner something “needs you”', () => {
    // "Nothing needs you right now" reads as though the software is a person
    // with feelings about it. It needs their attention, not them.
    const offenders: string[] = [];
    for (const file of OWNER_FILES) {
      if (/\bneeds you\b/i.test(ownerTextOf(file))) offenders.push(relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});

describe('the dictionary itself is written in plain English', () => {
  const english = Object.entries(MESSAGES).map(([key, phrase]) => [key, phrase.en] as const);

  it('has phrases to check', () => {
    expect(english.length).toBeGreaterThan(0);
  });

  it('uses none of the banned words', () => {
    const offenders: string[] = [];
    for (const [key, text] of english) {
      for (const phrase of BANNED_IN_OWNER_TEXT) {
        if (text.toLowerCase().includes(phrase.toLowerCase())) {
          offenders.push(`${key}: “${text}” contains “${phrase}”`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('uses the glossary’s word, not a synonym of it', () => {
    const offenders: string[] = [];
    for (const [key, text] of english) {
      for (const [avoid, prefer] of Object.entries(PREFERRED_INSTEAD)) {
        const re = new RegExp(`\\b${avoid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(text)) offenders.push(`${key}: “${avoid}” → use “${prefer}”`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps sentences short enough to read once', () => {
    // Not a hard style rule — a long sentence is a smell, not a crime. This
    // catches the paragraph that crept back in.
    const tooLong: string[] = [];
    for (const [key, text] of english) {
      for (const sentence of text.split(/(?<=[.?!])\s+/)) {
        const words = sentence.trim().split(/\s+/).filter(Boolean).length;
        if (words > 32) tooLong.push(`${key}: ${words} words`);
      }
    }
    expect(tooLong).toEqual([]);
  });
});

describe('the glossary holds together', () => {
  it('gives every term all three languages', () => {
    for (const entry of GLOSSARY) {
      expect(entry.en.trim(), 'empty English').not.toBe('');
      expect(entry.hi.trim(), `${entry.en} has no Hindi`).not.toBe('');
      expect(entry.mr.trim(), `${entry.en} has no Marathi`).not.toBe('');
    }
  });

  it('names each English term once, so one idea has one word', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const entry of GLOSSARY) {
      const key = entry.en.toLowerCase();
      if (seen.has(key)) duplicates.push(entry.en);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it('does not recommend a word it also bans', () => {
    for (const prefer of Object.values(PREFERRED_INSTEAD)) {
      for (const banned of BANNED_IN_OWNER_TEXT) {
        expect(prefer.toLowerCase(), `${prefer} is both preferred and banned`).not.toBe(
          banned.toLowerCase(),
        );
      }
    }
  });

  it('separates private feedback from a public review, in every language', () => {
    // The distinction the whole product rests on. If these ever collapse into
    // one word an owner will think Headway is publishing their feedback.
    const feedback = GLOSSARY.find((g) => g.en === 'feedback');
    const review = GLOSSARY.find((g) => g.en === 'review');
    expect(feedback).toBeTruthy();
    expect(review).toBeTruthy();
    expect(feedback?.hi).not.toBe(review?.hi);
    expect(feedback?.mr).not.toBe(review?.mr);
  });
});
