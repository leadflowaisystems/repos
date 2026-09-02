/**
 * Deterministic language hinting for pasted feedback.
 *
 * RepOS must handle English, Hindi/Hinglish, Marathi and mixed text. This is a
 * marker-frequency heuristic, not a classifier: it exists so the report can say
 * honestly which languages the feedback arrived in, and so the AI drafting
 * prompt can be told to mirror that mix.
 */

export type LanguageCode = 'en' | 'hi' | 'mr' | 'mixed' | 'unknown';

const DEVANAGARI_RE = /[ऀ-ॿ]/;
const LATIN_RE = /[A-Za-z]/;

/** Words that appear in Marathi but essentially never in Hindi. */
const MARATHI_MARKERS = [
  'आहे','नाही','आणि','मला','खूप','छान','केले','होते','त्यांनी','आम्ही','तुम्ही',
  'झाले','पण','कारण','सर्व','चांगले','वाईट','अनुभव','सेवा','वेळ','पुन्हा','धन्यवाद',
];

/** Words that appear in Hindi but essentially never in Marathi. */
const HINDI_MARKERS = [
  'है','नहीं','और','मुझे','बहुत','अच्छा','किया','था','थे','उन्होंने','हम','आप',
  'हुआ','लेकिन','क्योंकि','सब','अच्छे','बुरा','अनुभव','सेवा','समय','फिर','धन्यवाद',
];

/** Romanised Hindi/Marathi markers — the Hinglish signal. */
const ROMANISED_MARKERS = [
  'nahi','nahin','hai','hain','tha','bahut','bohot','kaafi','accha','acha',
  'achha','bura','kharab','bekar','mast','thoda','bilkul','sahi','galat','paisa',
  'paise','jaldi','der','kya','kyun','aur','lekin','magar','matlab','yaar','bhai',
  'karke','kiya','diya','milta','wala','waala','saaf','safai','ganda',
  'ahe','nahi','khup','chaan','changle','vait','ani','mala','tumhi','amhi','zale',
];

function countMarkers(haystack: string, markers: string[]): number {
  let n = 0;
  for (const m of markers) {
    if (haystack.includes(m)) n += 1;
  }
  return n;
}

function countRomanisedMarkers(text: string): number {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const set = new Set(words);
  let n = 0;
  for (const m of ROMANISED_MARKERS) {
    if (set.has(m)) n += 1;
  }
  return n;
}

/** Best-effort language hint for a single piece of feedback. */
export function detectLanguage(input: string): LanguageCode {
  const text = input.trim();
  if (text.length === 0) return 'unknown';

  const hasDevanagari = DEVANAGARI_RE.test(text);
  const hasLatin = LATIN_RE.test(text);
  const romanised = countRomanisedMarkers(text);

  if (hasDevanagari) {
    const mr = countMarkers(text, MARATHI_MARKERS);
    const hi = countMarkers(text, HINDI_MARKERS);
    // Devanagari plus a meaningful amount of Latin script is genuinely mixed.
    const latinWords = (text.match(/[A-Za-z]{3,}/g) ?? []).length;
    if (latinWords >= 3) return 'mixed';
    if (mr > hi) return 'mr';
    if (hi > mr) return 'hi';
    return 'mixed';
  }

  // Two or more markers before calling it Hinglish. A single ambiguous token is
  // not enough — otherwise ordinary English sentences read as mixed.
  if (hasLatin && romanised >= 2) return 'mixed';
  if (hasLatin) return 'en';
  return 'unknown';
}

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: 'English',
  hi: 'Hindi',
  mr: 'Marathi',
  mixed: 'Mixed / Hinglish',
  unknown: 'Unknown',
};

/**
 * Distribution of languages across a set of feedback items, used to describe
 * the mix honestly in the report.
 */
export function languageMixSummary(
  codes: LanguageCode[],
): Array<{ code: LanguageCode; label: string; count: number }> {
  const counts = new Map<LanguageCode, number>();
  for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts.entries()]
    .map(([code, count]) => ({ code, label: LANGUAGE_LABELS[code], count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
