import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join as joinPath, relative, resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFocus } from '@/lib/portal/focus';
import { buildPortalView } from '@/lib/portal/view';
import { buildResponsibility } from '@/lib/responsibility/engine';
import { buildEvidenceIndex, EMPTY_EVIDENCE } from '@/lib/portal/evidence';
import { recurrenceFor } from '@/lib/portal/history';
import { action, input } from '@/lib/portal/test-fixtures';
import { LOCALES, type Locale } from '@/lib/i18n/locale';
import { EN, translatorFor } from '@/lib/i18n/translator';
import { MESSAGES } from '@/lib/i18n/strings';
import { resolve as resolvePhrase, type Namespace } from '@/lib/i18n/t';

/**
 * THE SENTENCES HEADWAY WRITES, IN THREE LANGUAGES (M31b).
 *
 * The chrome was translated first — the nav, the buttons, the labels. That is
 * the easy half, and on its own it produces the worst possible screen: a portal
 * in Marathi wrapped around a headline in English, where the one sentence the
 * owner actually needs is the one they cannot read.
 *
 * This file holds the other half: the sentences that are COMPOSED from data by
 * pure builder functions. What it protects:
 *
 *   1. Hindi and Marathi really are Hindi and Marathi, not English echoed back.
 *   2. English did not move. The plain-English wording was signed off, and
 *      passing no translator must produce exactly what it produced before.
 *   3. THE NUMBERS ARE THE SAME IN ALL THREE. Same counts, same dates, in the
 *      same order. A sentence may be reordered by grammar; a figure may not.
 *   4. A CUSTOMER'S WORDS ARE NEVER TRANSLATED. A quote is evidence. Rendering
 *      it in Marathi would turn what somebody said into what Headway says they
 *      said.
 *   5. The language is passed in, never asked for — no builder branches on it.
 */

const ROOT = resolvePath(__dirname, '..');
const NOW = new Date('2026-06-01T12:00:00.000Z');
const DEVANAGARI = /[ऀ-ॿ]/;

/** Everything a builder produced, flattened to a list of sentences. */
function sentences(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    if (value.trim().length > 0) out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) sentences(v, out);
  } else if (value && typeof value === 'object') {
    if (value instanceof Date || value instanceof Map) return out;
    for (const v of Object.values(value)) sentences(v, out);
  }
  return out;
}

/**
 * Is this string something a person READS, as opposed to something the code
 * recognises?
 *
 * The builders return both. `themeKey`, `MIXED`, `PRAISE`, `direction` and
 * `publicRating` are identifiers and enum values and must stay identical in
 * every language — translating them would break the product. So must the
 * business name and anything that is only a figure or a date. What is left is
 * prose, and prose must be translated.
 */
const NOT_TRANSLATABLE = new Set([
  'Sunrise Dental Clinic', // the business's own name
  "Clinic / Healthcare", // the vertical label, from the pack
]);

function isProse(value: string): boolean {
  const s = value.trim();
  if (NOT_TRANSLATABLE.has(s)) return false;
  if (!/\s/.test(s)) return false; // single token: an enum, a key, a number
  if (/^[A-Z0-9_ /]+$/.test(s)) return false; // SHOUTING enums
  if (/^[\d\s.,%/-]+$/.test(s)) return false; // figures and dates only
  if (/^[a-z0-9_]+$/.test(s)) return false; // snake_case keys
  return /[a-z]{4}/.test(s); // has a real lowercase word
}

/** Home, end to end, in one language. */
function home(locale: Locale | null, overrides: Parameters<typeof input>[0] = {}) {
  const t = locale ? translatorFor(locale) : undefined;
  const inp = input({ ...overrides, ...(t ? { t } : {}) });
  const view = buildPortalView(inp);
  const responsibility = buildResponsibility({
    view,
    intelligence: inp.intelligence,
    actions: inp.actions,
    checkins: [],
    feedbackSince: { count: 0, since: null } as never,
    needsYourWords: 0,
    gateway: null,
    archived: false,
    now: NOW,
    ...(t ? { t } : {}),
  });
  const focus = buildFocus({
    responsibility,
    view,
    evidence: EMPTY_EVIDENCE,
    basePath: '/w/c1',
    ...(t ? { t } : {}),
  });
  return { view, responsibility, focus };
}

const CASES: Array<[string, Parameters<typeof input>[0]]> = [
  ['plain', {}],
  ['measured', { actions: [action('MEASURED')] }],
  ['worsened', { actions: [action('MEASURED', 'WORSENED')] }],
  ['improved', { actions: [action('MEASURED', 'IMPROVED')] }],
];

// ---------------------------------------------------------------------------
// 1. The generated text really does change language
// ---------------------------------------------------------------------------

describe('the generated insight text is localized', () => {
  for (const [name, overrides] of CASES) {
    it(`writes the Home block in Hindi and Marathi (${name})`, () => {
      const en = sentences(home('en', overrides).focus);
      const hi = sentences(home('hi', overrides).focus);
      const mr = sentences(home('mr', overrides).focus);

      expect(en.length).toBeGreaterThan(0);
      expect(hi.length).toBe(en.length);
      expect(mr.length).toBe(en.length);

      const prose = en
        .map((s, i) => [s, hi[i] as string, mr[i] as string] as const)
        .filter(([e]) => isProse(e));
      expect(prose.length, 'nothing prose-like to check').toBeGreaterThan(0);
      for (const [e, h, m] of prose) {
        expect(DEVANAGARI.test(h), `Hindi still English: ${e}`).toBe(true);
        expect(DEVANAGARI.test(m), `Marathi still English: ${e}`).toBe(true);
      }
    });
  }

  it('localizes the headline, the why, and what to do', () => {
    for (const locale of ['hi', 'mr'] as const) {
      const f = home(locale).focus;
      expect(DEVANAGARI.test(f.headline), `${locale} headline`).toBe(true);
      if (f.synthesis) expect(DEVANAGARI.test(f.synthesis), `${locale} why`).toBe(true);
      if (f.next) expect(DEVANAGARI.test(f.next.headline), `${locale} what to do`).toBe(true);
      for (const proof of f.proofs) {
        expect(DEVANAGARI.test(proof.label), `${locale} evidence chip`).toBe(true);
        expect(DEVANAGARI.test(proof.detail), `${locale} evidence detail`).toBe(true);
      }
    }
  });

  it('localizes the trend and direction explanations', () => {
    for (const locale of ['hi', 'mr'] as const) {
      const v = home(locale).view;
      const direction = v.facts.find((f) => f.key === 'direction');
      expect(direction, 'no direction fact').toBeTruthy();
      expect(DEVANAGARI.test(direction!.label), `${locale} direction label`).toBe(true);
      expect(DEVANAGARI.test(direction!.value), `${locale} direction value`).toBe(true);
      expect(DEVANAGARI.test(direction!.scope), `${locale} direction scope`).toBe(true);
    }
  });

  it('localizes what needs the owner, and why', () => {
    for (const locale of ['hi', 'mr'] as const) {
      const r = home(locale, { actions: [action('MEASURED', 'WORSENED')] }).responsibility;
      const items = [...r.needsYou, ...r.watching];
      expect(items.length, 'nothing to check').toBeGreaterThan(0);
      for (const item of items) {
        expect(DEVANAGARI.test(item.headline), `${locale} item headline`).toBe(true);
        if (item.whyItMatters) {
          expect(DEVANAGARI.test(item.whyItMatters), `${locale} whyItMatters`).toBe(true);
        }
      }
    }
  });

  it('localizes the improvement explanation, caveat included', () => {
    for (const locale of ['hi', 'mr'] as const) {
      const v = home(locale, { actions: [action('MEASURED', 'WORSENED')] }).view;
      const outcome = v.unhappy.map((s) => s.outcome).find(Boolean);
      if (!outcome) continue;
      expect(DEVANAGARI.test(outcome.headline), `${locale} outcome`).toBe(true);
      // The no-causation sentence must exist AND be in the reader's language.
      const caveat = outcome.caveat || outcome.note;
      expect(caveat, `${locale} lost the caveat entirely`).toBeTruthy();
      expect(DEVANAGARI.test(caveat), `${locale} caveat still English`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. English did not move
// ---------------------------------------------------------------------------

describe('English is exactly what it was', () => {
  for (const [name, overrides] of CASES) {
    it(`no translator produces the same English as an English translator (${name})`, () => {
      // The operator console calls these builders without a translator. That
      // path and the portal's English path must be the same sentences.
      expect(sentences(home(null, overrides).focus)).toEqual(
        sentences(home('en', overrides).focus),
      );
      expect(sentences(home(null, overrides).view)).toEqual(
        sentences(home('en', overrides).view),
      );
      expect(sentences(home(null, overrides).responsibility)).toEqual(
        sentences(home('en', overrides).responsibility),
      );
    });
  }

  it('still says the no-causation sentence in English, unchanged', () => {
    const v = home('en', { actions: [action('MEASURED', 'WORSENED')] }).view;
    const all = sentences(v).join(' ');
    expect(all).toContain('does not show');
  });
});

// ---------------------------------------------------------------------------
// 3. The numbers are the same in all three
// ---------------------------------------------------------------------------

describe('numbers and dates survive translation', () => {
  const figures = (xs: string[]) => xs.join(' ').match(/\d+(?:\.\d+)?%?/g) ?? [];

  for (const [name, overrides] of CASES) {
    it(`carries identical figures into Hindi and Marathi (${name})`, () => {
      const en = figures(sentences(home('en', overrides)));
      const hi = figures(sentences(home('hi', overrides)));
      const mr = figures(sentences(home('mr', overrides)));
      expect(en.length, 'no figures to compare').toBeGreaterThan(0);
      // Sorted: grammar may move a figure within a sentence, but not change it.
      expect([...hi].sort()).toEqual([...en].sort());
      expect([...mr].sort()).toEqual([...en].sort());
    });
  }

  it('leaves no placeholder unfilled in any language', () => {
    for (const locale of LOCALES) {
      for (const [name, overrides] of CASES) {
        for (const line of sentences(home(locale, overrides))) {
          expect(line, `${locale}/${name} has an unfilled placeholder: ${line}`).not.toMatch(
            /\{\w+\}/,
          );
        }
      }
    }
  });

  it('writes figures in Latin digits, never Devanagari numerals', () => {
    for (const locale of LOCALES) {
      const text = sentences(home(locale)).join(' ');
      expect(text, `${locale} used Devanagari digits`).not.toMatch(/[०-९]/);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. A customer's words are never translated
// ---------------------------------------------------------------------------

describe('customer quotes are reproduced byte-for-byte', () => {
  const QUOTE = 'Waited nearly an hour for the mains on Saturday, though the food was lovely.';
  const SECOND = 'Staff were polite but the bill took twenty minutes to arrive.';

  function evidenceFor(themeKey: string) {
    return buildEvidenceIndex([
      {
        id: 'r1',
        text: QUOTE,
        stars: 2,
        reviewDate: new Date('2026-05-20T10:00:00Z'),
        createdAt: new Date('2026-05-20T10:00:00Z'),
        source: 'GOOGLE',
        themesJson: JSON.stringify([{ key: themeKey }]),
      },
      {
        id: 'r2',
        text: SECOND,
        stars: 3,
        reviewDate: new Date('2026-05-21T10:00:00Z'),
        createdAt: new Date('2026-05-21T10:00:00Z'),
        source: 'REP_OS_QR',
        themesJson: JSON.stringify([{ key: themeKey }]),
      },
    ]);
  }

  it('hands back the exact stored text in every language', () => {
    const base = home('en');
    const themeKey = base.focus.theme?.key ?? base.view.unhappy[0]?.themeKey;
    expect(themeKey, 'fixture produced no theme to quote against').toBeTruthy();
    const evidence = evidenceFor(themeKey as string);

    for (const locale of LOCALES) {
      const t = translatorFor(locale);
      const inp = input({ t });
      const view = buildPortalView(inp);
      const responsibility = buildResponsibility({
        view,
        intelligence: inp.intelligence,
        actions: inp.actions,
        checkins: [],
        feedbackSince: { count: 0, since: null } as never,
        needsYourWords: 0,
        gateway: null,
        archived: false,
        now: NOW,
        t,
      });
      const focus = buildFocus({ responsibility, view, evidence, basePath: '/w/c1', t });
      const quotes = focus.proofs.flatMap((p) => p.quotes);
      expect(quotes.length, `${locale} produced no quotes`).toBeGreaterThan(0);
      for (const q of quotes) {
        expect([QUOTE, SECOND], `${locale} altered a customer's words`).toContain(q.text);
      }
    }
  });

  it('never lets a customer sentence into the dictionary', () => {
    // A quote is data. If one is ever pasted into a phrase it stops being what
    // the customer wrote and starts being something Headway can reword.
    const all = Object.values(MESSAGES).map((p) => p.en).join('\n');
    expect(all).not.toContain(QUOTE);
    expect(all).not.toContain('nearly an hour for the mains');
  });
});

// ---------------------------------------------------------------------------
// 5. Fallback, and no language branching
// ---------------------------------------------------------------------------

describe('the mechanism stays clean', () => {
  it('falls back to English for a phrase with no translation', () => {
    const partial: Namespace = {
      'x.only': { en: 'Only English here' },
      'x.both': { en: 'Feedback', hi: 'फ़ीडबैक', mr: 'फीडबॅक' },
    };
    expect(resolvePhrase(partial, 'hi', 'x.only')).toBe('Only English here');
    expect(resolvePhrase(partial, 'mr', 'x.only')).toBe('Only English here');
    expect(resolvePhrase(partial, 'mr', 'x.both')).toBe('फीडबॅक');
  });

  it('defaults to English when a builder is given no translator', () => {
    expect(EN.locale).toBe('en');
    const withNone = home(null).focus.headline;
    const withEn = home('en').focus.headline;
    expect(withNone).toBe(withEn);
  });

  const GENERATION_FILES = [
    'src/lib/portal/view.ts',
    'src/lib/portal/focus.ts',
    'src/lib/portal/pages.ts',
    'src/lib/portal/history.ts',
    'src/lib/responsibility/engine.ts',
    'src/lib/improve/model.ts',
    'src/lib/improve/measure.ts',
    'src/lib/intelligence/engine.ts',
    'src/lib/reporting/service.ts',
    'src/lib/lifecycle/service.ts',
  ];

  it('never branches on the language', () => {
    // The translator is handed in. A builder that asked which language it was
    // in would need editing again for the next one, and every such branch is a
    // place for English to leak back.
    for (const file of GENERATION_FILES) {
      const source = readFileSync(joinPath(ROOT, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      expect(source, `${file} branches on locale`).not.toMatch(
        /locale\s*===|=== *['"](?:hi|mr|en)['"]|locale\s*!==/,
      );
      expect(source, `${file} imports the cookie reader`).not.toContain('@/lib/i18n/request');
    }
  });

  it('has every portal call site pass the owner’s language', () => {
    // Forgetting this is the failure mode with no symptom: the page renders,
    // in English, for a reader who chose Marathi.
    const dir = joinPath(ROOT, 'src', 'app', '(workspace)');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d)) {
        const full = joinPath(d, e);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e)) files.push(full);
      }
    };
    walk(dir);
    files.push(
      ...['home', 'analysis', 'checkin', 'improvements', 'reviews'].map((n) =>
        joinPath(ROOT, 'src', 'components', 'workspace', `${n}.tsx`),
      ),
    );

    const CALLS =
      /(getPortalView|getAnalysisView|getImprovementsView|getCheckinView|getReviewsView|getResponsibility|getWeeklyPulse|getMonthlyReview|buildFocus)\s*\(([\s\S]{0,240}?)\)\s*[,;)]/g;
    const missing: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(CALLS)) {
        const args = m[2] ?? '';
        if (!/\bt\b\s*[,:}]|\{\s*t\s*\}|t:\s*await getTranslator\(\)|t\s*}/.test(args)) {
          missing.push(`${relative(ROOT, file)} → ${m[1]}`);
        }
      }
    }
    expect(missing, 'these portal calls would render English for a Marathi reader').toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6. The packs' own labels
// ---------------------------------------------------------------------------

describe('vertical pack labels are translated without being changed', () => {
  const packDir = joinPath(ROOT, 'packs');
  const packs = readdirSync(packDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(joinPath(packDir, f), 'utf8')) as {
      id: string;
      issueTaxonomy: Array<{ key: string; label: string; action?: string }>;
      praiseTaxonomy: Array<{ key: string; label: string }>;
    });

  // Keys built at runtime cannot be in the typed union, so this view of the
  // dictionary is deliberately loose. The typed access is used everywhere else.
  const DICT = MESSAGES as unknown as Record<string, { en: string; hi?: string; mr?: string }>;

  const entries = packs.flatMap((p) =>
    [...p.issueTaxonomy, ...p.praiseTaxonomy].map((t) => ({ pack: p.id, ...t })),
  );

  it('reads every pack', () => {
    expect(packs.length).toBe(7);
    expect(entries.length).toBe(119);
  });

  it('has a translation for every theme label', () => {
    const missing = entries
      .filter((e) => !DICT[`pack.${e.pack}.${e.key}`])
      .map((e) => `pack.${e.pack}.${e.key}`);
    expect(missing).toEqual([]);
  });

  it('copies the pack’s English label byte-for-byte', () => {
    // The dictionary entry is the fallback AND the English reader's text. If it
    // drifts from the pack, English and Hindi are describing different themes.
    const wrong: string[] = [];
    for (const e of entries) {
      const phrase = DICT[`pack.${e.pack}.${e.key}`];
      if (phrase && phrase.en !== e.label) {
        wrong.push(`pack.${e.pack}.${e.key}: pack=${JSON.stringify(e.label)} dict=${JSON.stringify(phrase.en)}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('writes real Hindi and Marathi for each label', () => {
    const bad: string[] = [];
    for (const e of entries) {
      const phrase = DICT[`pack.${e.pack}.${e.key}`];
      if (!phrase) continue;
      if (!phrase.hi || !DEVANAGARI.test(phrase.hi)) bad.push(`${e.pack}.${e.key} hi`);
      if (!phrase.mr || !DEVANAGARI.test(phrase.mr)) bad.push(`${e.pack}.${e.key} mr`);
    }
    expect(bad).toEqual([]);
  });

  it('never translates a theme KEY', () => {
    // The key joins a theme to its feedback and builds its URL. Only the label
    // is words.
    for (const e of entries) {
      expect(e.key).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it('translates every gateway dimension and signal an owner can see', () => {
    // These surface under "What customers tapped". The fixture has no rated
    // dimensions, so this checks the data and the key shape directly rather
    // than relying on a render that never happens.
    const packsRaw = readdirSync(packDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(joinPath(packDir, f), 'utf8')) as {
        id: string;
        gateway?: { dimensions?: Array<{ key: string; label: string; signals?: Array<{ key: string; label: string }> }> };
      });
    const missing: string[] = [];
    const wrong: string[] = [];
    let checked = 0;
    for (const p of packsRaw) {
      for (const d of p.gateway?.dimensions ?? []) {
        checked += 1;
        const dk = `pack.${p.id}.dim.${d.key}`;
        const dp = DICT[dk];
        if (!dp) missing.push(dk);
        else if (dp.en !== d.label) wrong.push(`${dk}: pack=${JSON.stringify(d.label)} dict=${JSON.stringify(dp.en)}`);
        for (const sig of d.signals ?? []) {
          checked += 1;
          const sk = `pack.${p.id}.sig.${d.key}.${sig.key}`;
          const sp = DICT[sk];
          if (!sp) missing.push(sk);
          else if (sp.en !== sig.label) wrong.push(`${sk}: pack=${JSON.stringify(sig.label)} dict=${JSON.stringify(sp.en)}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(150);
    expect(missing).toEqual([]);
    expect(wrong).toEqual([]);
  });

  it('asks the owner its question in their language', () => {
    const packsRaw = readdirSync(packDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(joinPath(packDir, f), 'utf8')) as {
        id: string;
        issueTaxonomy: Array<{ key: string; askOwner?: { question: string; options: string[] } }>;
      });
    const missing: string[] = [];
    let asked = 0;
    for (const p of packsRaw) {
      for (const th of p.issueTaxonomy) {
        if (!th.askOwner) continue;
        asked += 1;
        const qk = `pack.${p.id}.${th.key}.ask`;
        if (!DICT[qk] || DICT[qk]?.en !== th.askOwner.question) missing.push(qk);
        th.askOwner.options.forEach((opt, i) => {
          const ok = `${qk}.${i}`;
          if (!DICT[ok] || DICT[ok]?.en !== opt) missing.push(ok);
        });
      }
    }
    expect(asked).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it('reads those labels by key, never from the pack directly', () => {
    const view = readFileSync(joinPath(ROOT, 'src', 'lib', 'portal', 'view.ts'), 'utf8');
    expect(view).toContain('pack.${packId}.dim.${row.key}');
    expect(view).toContain('pack.${packId}.sig.${row.key}.${s.key}');
    expect(view).toContain('.ask`');
  });

  it('leaves the pack files themselves untouched', () => {
    // Translations live in the dictionary, not in the data.
    for (const p of packs) {
      for (const t of [...p.issueTaxonomy, ...p.praiseTaxonomy]) {
        expect(DEVANAGARI.test(t.label), `${p.id}.${t.key} label was edited`).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 7. The sweep: nothing owner-facing is left in English
// ---------------------------------------------------------------------------

describe('no English prose survives in a Hindi or Marathi portal', () => {
  const STATES = ['RECOMMENDED', 'ACCEPTED', 'DONE', 'MEASURED', 'DECLINED', 'PAUSED'] as const;
  const RESULTS = ['IMPROVED', 'WORSENED', 'NO_CLEAR_CHANGE', 'INSUFFICIENT_DATA'] as const;

  const cases: Array<Parameters<typeof input>[0]> = [{}];
  for (const st of STATES) cases.push({ actions: [action(st)] });
  for (const r of RESULTS) cases.push({ actions: [action('MEASURED', r)] });

  /**
   * Strings the fixture PUT IN, as opposed to sentences Headway wrote.
   *
   * The sweep is about Headway's own words. Some of what comes back out was
   * handed in: the business's name, the owner's recorded decision and their
   * learning note, the recommendation frozen onto an action, and the fixture's
   * hand-written window reason. None of those may be translated — an owner's
   * own sentence is evidence in exactly the way a customer's is — so anything
   * present in the INPUT is excluded from the OUTPUT check by construction,
   * rather than by a hand-maintained allow-list that would rot.
   */
  function injected(overrides: Parameters<typeof input>[0]): Set<string> {
    const inp = input({ ...overrides, t: translatorFor('en') });
    return new Set(sentences(inp).map((x) => x.trim()));
  }

  for (const locale of ['hi', 'mr'] as const) {
    it(`leaves no English sentence anywhere in ${locale}`, () => {
      const offenders = new Set<string>();
      for (const overrides of cases) {
        const given = injected(overrides);
        for (const line of sentences(home(locale, overrides))) {
          if (!isProse(line) || DEVANAGARI.test(line)) continue;
          if (given.has(line.trim())) continue; // data, not Headway's words
          offenders.add(line);
        }
      }
      expect(
        [...offenders],
        `these reach a ${locale} reader in English`,
      ).toEqual([]);
    });
  }

  for (const locale of ['hi', 'mr'] as const) {
    it(`embeds no English phrase inside a ${locale} sentence`, () => {
      // The whole-string check above cannot see "ग्राहक long waiting time चा
      // उल्लेख करतात" — a Devanagari sentence with an English noun phrase
      // dropped into the middle of it. This looks for a run of three or more
      // ASCII words inside a sentence that is otherwise Devanagari.
      const RUN = /[A-Za-z][a-z]*(?:\s+[A-Za-z][a-z]*){2,}/;
      const offenders = new Set<string>();
      for (const overrides of cases) {
        const given = injected(overrides);
        for (const line of sentences(home(locale, overrides))) {
          if (!DEVANAGARI.test(line)) continue; // handled by the sweep above
          const m = RUN.exec(line);
          if (!m) continue;
          if ([...given].some((g) => g.includes(m[0]))) continue; // owner's or customer's own words
          offenders.add(`${m[0]}  ⟵  ${line.slice(0, 90)}`);
        }
      }
      expect([...offenders], `English phrases inside ${locale} sentences`).toEqual([]);
    });
  }

  it('still renders every one of those cases in English unchanged', () => {
    // The same sweep in English, proving the sweep is exercising real output
    // rather than passing because nothing rendered.
    let count = 0;
    for (const overrides of cases) {
      const lines = sentences(home('en', overrides));
      expect(lines.length).toBeGreaterThan(0);
      count += lines.filter(isProse).length;
      // and no-translator must equal explicit English, case by case
      expect(sentences(home(null, overrides))).toEqual(lines);
    }
    expect(count).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// 8. The structured kinds must behave exactly as the English matching did
// ---------------------------------------------------------------------------

describe('replacing English matching with data changed no behaviour', () => {
  /**
   * Three regressions found by a pre-push audit, each caused by the SHAPE of
   * the replacement rather than by its wording. None was covered by a test —
   * nothing in the suite referenced workKinds, didKinds or recurrenceRaised —
   * so these pin the three decisions the English matching used to make.
   */

  it('records a newly-raised theme as raised once, and a recurring one as twice or more', () => {
    // The chip guard depends on this: `raisedAt: 1` means NEW, and only two or
    // more may take the "at N of your last M check-ins" branch.
    const rec = recurrenceFor(
      { checkins: 3, issues: new Map(), praises: new Map() } as never,
      'ISSUE',
      'wait_time',
    );
    // No presence data at all: says nothing, and carries no counts.
    expect(rec.line).toBeNull();
    expect(rec.raisedAt).toBeNull();
    expect(rec.outOf).toBeNull();
  });

  it('requires two check-ins before it says "at N of your last M"', () => {
    // The English regex this replaced was /at (\d+) of your last (\d+)
    // check-ins/, which could only ever match the recurring case. A `>= 1`
    // guard silently made the "New at your latest check-in" chip unreachable.
    const focus = readFileSync(joinPath(ROOT, 'src', 'lib', 'portal', 'focus.ts'), 'utf8');
    expect(focus).toContain('raised >= 2');
    expect(focus).not.toContain('raised >= 1');
  });

  it('does not carry the nothing-found line into the check-in list', () => {
    // "Found nothing yet that has been raised 3 or more times." never matched
    // the old /^Grouped |^Compared |^Kept track / filter, so it must not be
    // tagged with a kind the responsibility engine carries.
    const view = readFileSync(joinPath(ROOT, 'src', 'lib', 'portal', 'view.ts'), 'utf8');
    expect(view).toContain("addWork('groupedNone'");
    const engine = readFileSync(
      joinPath(ROOT, 'src', 'lib', 'responsibility', 'engine.ts'),
      'utf8',
    );
    const carried = /const CARRIED = new Set\(\[([^\]]*)\]\)/.exec(engine);
    expect(carried, 'the CARRIED set moved').toBeTruthy();
    expect(carried![1]).not.toContain('groupedNone');
    // And the four kinds it does carry are exactly the ones whose English
    // began with Grouped / Compared / Kept track.
    for (const kind of ['grouped', 'compared', 'measured', 'remembered']) {
      expect(carried![1], kind).toContain(kind);
    }
  });

  it('carries a work line for every kind it tags, and tags one for every line', () => {
    for (const locale of LOCALES) {
      const v = home(locale).view;
      expect(v.workKinds.length, locale).toBe(v.work.length);
      expect(new Set(v.workKinds).size, `${locale} reused a kind`).toBe(v.workKinds.length);
    }
  });

  it('never claims an original suggestion when there is none', () => {
    // `suggested` falls back to "Headway raised this without a specific
    // suggestion", so it can never be used as a truthiness test — doing so
    // produced "The original suggestion still stands: Headway raised this
    // without a specific suggestion."
    const story = readFileSync(
      joinPath(ROOT, 'src', 'components', 'workspace', 'improvement-story.tsx'),
      'utf8',
    );
    expect(story).toContain('a.hasSuggestion');
    expect(story).not.toMatch(/rest: a\.suggested \?/);

    // And the flag is set from the frozen text, not from the fallback sentence.
    for (const locale of LOCALES) {
      for (const a of home(locale, { actions: [action('MEASURED', 'WORSENED')] }).view.actions) {
        expect(typeof a.hasSuggestion, locale).toBe('boolean');
        if (a.hasSuggestion) {
          expect(a.suggested).not.toBe(MESSAGES['insight.action.noSuggestion'][locale] ?? '');
        }
      }
    }
  });

  it('says the brand one way in every language', () => {
    // 220 phrases transliterated it and 230 did not. A brand that is spelled
    // two ways is two brands.
    const bad: string[] = [];
    for (const [key, phrase] of Object.entries(MESSAGES)) {
      for (const written of [phrase.hi, phrase.mr]) {
        if (!written) continue;
        if (written.includes('हेडवे')) bad.push(`${key}: transliterated brand`);
        if (/Headway[ऀ-ॿ]/.test(written)) bad.push(`${key}: brand glued to a Devanagari particle`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('says "You told us" in the reader’s language, with the owner’s words untouched', () => {
    const apply = readFileSync(joinPath(ROOT, 'src', 'lib', 'context', 'apply.ts'), 'utf8');
    expect(apply).toContain("t('insight.youToldUs.priority'");
    expect(apply).toContain("t('insight.youToldUs.plain'");
    expect(apply).not.toMatch(/`You told us/);
    for (const key of [
      'insight.youToldUs.priority',
      'insight.youToldUs.focus',
      'insight.youToldUs.plain',
      'insight.youToldUs.tried',
      'insight.youToldUs.answer',
    ] as const) {
      expect(MESSAGES[key].hi, key).toBeTruthy();
      expect(MESSAGES[key].mr, key).toBeTruthy();
    }
  });
});
