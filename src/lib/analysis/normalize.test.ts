import { describe, expect, it } from 'vitest';
import { getPackOrFallback, listPacks, _resetPackCache } from '@/lib/packs';
import {
  ANALYSIS_VERSION,
  normalizeFeedback,
  sentimentLabel,
  languageLabel,
} from './normalize';

_resetPackCache();

const clinic = getPackOrFallback('clinic');
const salon = getPackOrFallback('salon');
const restaurant = getPackOrFallback('restaurant');

function run(
  text: string,
  stars: number | null = null,
  pack = clinic,
  ai: Parameters<typeof normalizeFeedback>[0]['ai'] = null,
) {
  return normalizeFeedback({ text, stars, pack, ai });
}

// ---------------------------------------------------------------------------

describe('language', () => {
  it('detects English, Hindi, Marathi and mixed feedback', () => {
    expect(run('The doctor explained everything clearly').language).toBe('en');
    expect(run('बहुत अच्छा अनुभव था और स्टाफ अच्छा है').language).toBe('hi');
    expect(run('डॉक्टर छान आहेत आणि सेवा चांगली आहे').language).toBe('mr');
    expect(run('Staff bahut accha hai lekin waiting zyada').language).toBe('mixed');
  });

  it('returns analysis only and never rewrites the feedback', () => {
    const text = 'डॉक्टर छान आहेत पण खूप उशीर झाला';
    const result = run(text);
    // The result carries no copy of the text at all, so the stored original
    // stays the single source of truth and is never translated away.
    expect(Object.keys(result)).not.toContain('text');
    expect(JSON.stringify(result)).not.toContain(text);
    expect(result.themes.length).toBeGreaterThan(0);
    expect(result.language).toBe('mr');
  });

  it('labels languages in plain words', () => {
    expect(languageLabel('mr')).toBe('Marathi');
    expect(languageLabel('mixed')).toBe('Mixed / Hinglish');
    expect(languageLabel(null)).toBe('Unknown');
  });
});

// ---------------------------------------------------------------------------

describe('sentiment is never decided by the rating alone', () => {
  it('a high rating with a complaint is Mixed, not Positive', () => {
    const result = run('4 stars but the staff were rude and dismissive', 4);
    expect(result.sentiment).toBe('MIXED');
    expect(result.themes.some((t) => t.kind === 'ISSUE')).toBe(true);
  });

  it('praise and a complaint together is Mixed whatever the stars say', () => {
    const result = run(
      'The doctor explained everything clearly but I waited 45 minutes',
      5,
    );
    expect(result.sentiment).toBe('MIXED');
  });

  it('a low rating with only praise is Mixed, because they disagree', () => {
    const result = run('The doctor was very kind and caring', 1);
    expect(result.sentiment).toBe('MIXED');
    expect(result.reasons.join(' ')).toContain('different directions');
  });

  it('is Positive when the wording and the rating agree', () => {
    const result = run('Very clean clinic and the doctor explained everything', 5);
    expect(result.sentiment).toBe('POSITIVE');
    expect(result.reasons.join(' ')).toContain('agrees');
  });

  it('is Negative when the wording and the rating agree', () => {
    const result = run('Waited over an hour and reception was rude', 1);
    expect(result.sentiment).toBe('NEGATIVE');
  });

  it('uses the wording alone when there is no rating', () => {
    expect(run('Waited far too long at reception').sentiment).toBe('NEGATIVE');
    expect(run('Doctor explained everything and it was very clean').sentiment).toBe(
      'POSITIVE',
    );
  });

  it('falls back to the rating only when the wording says nothing', () => {
    const result = run('Went on Tuesday', 5);
    expect(result.sentiment).toBe('POSITIVE');
    expect(result.reasons.join(' ')).toContain('Only the star rating');
    expect(result.confidence).toBe('LOW');
  });

  it('is Neutral when there is neither a rating nor recognisable wording', () => {
    const result = run('Went on Tuesday');
    expect(result.sentiment).toBe('NEUTRAL');
    expect(result.confidence).toBe('LOW');
  });

  it('treats a middle rating with no detail as Mixed', () => {
    expect(run('Went on Tuesday', 3).sentiment).toBe('MIXED');
  });

  it('always explains itself in plain language', () => {
    const result = run('Doctor was kind but the wait was long', 4);
    expect(result.reasons.length).toBeGreaterThan(0);
    const joined = result.reasons.join(' ').toLowerCase();
    for (const jargon of ['model', 'token', 'classifier', 'inference', 'provider']) {
      expect(joined, jargon).not.toContain(jargon);
    }
  });
});

// ---------------------------------------------------------------------------

describe('themes', () => {
  it('extracts several themes from one review', () => {
    const result = run(
      'The doctor explained everything clearly but I waited 45 minutes at reception',
    );
    const keys = result.themes.map((t) => t.key);
    expect(keys).toContain('doctor_care');
    expect(keys).toContain('wait_time');
    expect(result.themes.length).toBeGreaterThanOrEqual(2);
  });

  it('gives each theme its own sentiment', () => {
    const result = run(
      'The doctor explained everything clearly but I waited 45 minutes at reception',
    );
    const doctor = result.themes.find((t) => t.key === 'doctor_care');
    const wait = result.themes.find((t) => t.key === 'wait_time');

    expect(doctor).toMatchObject({ kind: 'PRAISE', sentiment: 'POSITIVE' });
    expect(wait).toMatchObject({ kind: 'ISSUE', sentiment: 'NEGATIVE' });
  });

  it('keeps praise and complaints as separate signals', () => {
    const result = run('Staff were friendly and helpful but the billing was wrong');
    expect(result.praiseTags.length).toBeGreaterThan(0);
    expect(result.issueTags.length).toBeGreaterThan(0);
    expect(result.praiseTags.some((k) => result.issueTags.includes(k))).toBe(false);
  });

  it('does not force a theme onto a review that has none', () => {
    const result = run('Went there on Tuesday afternoon');
    expect(result.themes).toEqual([]);
    expect(result.confidence).toBe('LOW');
  });

  it('carries the severity declared by the vertical pack', () => {
    const result = run('Waited far too long at reception');
    expect(result.themes.find((t) => t.key === 'wait_time')?.severity).toBe('high');
  });

  it('is deterministic for the same input', () => {
    const text = 'Doctor explained everything but reception was rude';
    expect(JSON.stringify(run(text, 3))).toBe(JSON.stringify(run(text, 3)));
  });
});

// ---------------------------------------------------------------------------

describe('taxonomy comes from the vertical pack, not from code', () => {
  it('reads a restaurant review with restaurant themes', () => {
    const result = run(
      'The food was excellent but the service was very slow',
      null,
      restaurant,
    );
    const keys = result.themes.map((t) => t.key);
    expect(keys).toContain('food_taste');
    expect(keys).toContain('service_speed');
    expect(result.sentiment).toBe('MIXED');

    const food = result.themes.find((t) => t.key === 'food_taste');
    const speed = result.themes.find((t) => t.key === 'service_speed');
    expect(food?.sentiment).toBe('POSITIVE');
    expect(speed?.sentiment).toBe('NEGATIVE');
  });

  it('reads a salon review with salon themes', () => {
    const result = run(
      'Lovely haircut and the stylist listened, but they charged more than quoted',
      null,
      salon,
    );
    const keys = result.themes.map((t) => t.key);
    expect(keys).toContain('pricing_transparency');
    expect(result.sentiment).toBe('MIXED');
  });

  it('never returns a theme that is not in the pack', () => {
    for (const pack of listPacks()) {
      const result = normalizeFeedback({
        text: 'Waited a long time, staff were rude, but it was very clean',
        stars: 3,
        pack,
      });
      const valid = new Set([
        ...pack.issueTaxonomy.map((t) => t.key),
        ...pack.praiseTaxonomy.map((t) => t.key),
      ]);
      for (const theme of result.themes) {
        expect(valid.has(theme.key), `${pack.id}/${theme.key}`).toBe(true);
      }
    }
  });

  it('recognises praise phrased with a plain adjective', () => {
    // "the doctor was good" is how most people actually write it. The bare
    // noun is deliberately absent from the taxonomy, so the phrase has to
    // carry the praise.
    const doctor = run('Waiting was long but the doctor was good', 3, clinic);
    expect(doctor.themes.map((t) => t.key)).toContain('doctor_care');
    expect(doctor.themes.map((t) => t.key)).toContain('wait_time');
    expect(doctor.sentiment).toBe('MIXED');

    const stylist = run('Great haircut, the stylist was excellent', 5, salon);
    expect(stylist.themes.map((t) => t.key)).toContain('stylist_skill');

    const service = run('Service was great and the food was tasty', 5, restaurant);
    expect(service.themes.map((t) => t.key)).toContain('service_quality');
  });

  it('still refuses to read a bare noun as praise', () => {
    // The phrase hints must not smuggle the neutral noun back in.
    const rude = run('The doctor was rude and the staff was rude', 1, clinic);
    for (const theme of rude.themes) {
      expect(theme.sentiment, theme.key).toBe('NEGATIVE');
    }
    expect(rude.sentiment).toBe('NEGATIVE');
  });

  it('runs the same engine across every shipped vertical', () => {
    for (const pack of listPacks()) {
      const result = normalizeFeedback({
        text: 'Very good experience overall, staff were helpful',
        stars: 5,
        pack,
      });
      expect(result.version, pack.id).toBe(ANALYSIS_VERSION);
      expect(['POSITIVE', 'NEGATIVE', 'MIXED', 'NEUTRAL'], pack.id).toContain(
        result.sentiment,
      );
      expect(result.reasons.length, pack.id).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------

describe('a hint has to mean the thing on its own', () => {
  it('does not turn a happy review into a complaint', () => {
    // Every noun here also names an issue bucket: haircut, appointment,
    // stylist. None of them is a complaint by itself.
    const result = run(
      'Absolutely loved my haircut, the stylist listened to exactly what I wanted. ' +
        'I have already booked my next appointment.',
      5,
      salon,
    );
    expect(result.sentiment).toBe('POSITIVE');
    for (const theme of result.themes) {
      expect(theme.sentiment, theme.key).toBe('POSITIVE');
    }
  });

  it('does not read a compliment as a billing complaint', () => {
    const result = run('Great value for money and the staff are lovely', 5, restaurant);
    expect(result.sentiment).toBe('POSITIVE');
    expect(result.issueTags).toEqual([]);
  });

  it('holds in Marathi too', () => {
    // "The doctor is nice and the staff helped a lot" - no complaint anywhere.
    const happy = run('डॉक्टर छान आहेत आणि स्टाफने खूप मदत केली', 5, clinic);
    expect(happy.issueTags).toEqual([]);
    expect(happy.sentiment).toBe('POSITIVE');

    // "The doctor is nice but it took a lot of time" - still a wait complaint.
    const mixed = run('डॉक्टर छान आहेत पण खूप वेळ लागला', 3, clinic);
    expect(mixed.themes.map((t) => t.key)).toContain('wait_time');
    expect(mixed.sentiment).toBe('MIXED');
  });

  it('still catches the complaint when the noun carries one', () => {
    const result = run('Charged me more than quoted and the bill was wrong', 1, salon);
    expect(result.sentiment).toBe('NEGATIVE');
    expect(result.themes.map((t) => t.key)).toContain('pricing_transparency');
  });
});

// ---------------------------------------------------------------------------

describe('negation is read across the whole clause', () => {
  it('does not count "nobody explained" as a good explanation', () => {
    const result = run(
      'Waited 40 minutes past my appointment. Nobody at the desk explained why.',
      1,
      salon,
    );
    expect(result.praiseTags).toEqual([]);
    expect(result.themes.map((t) => t.key)).toContain('wait_time');
    expect(result.sentiment).toBe('NEGATIVE');
  });

  it('does not count "never rushed" as a rushed consultation', () => {
    const result = run('The doctor never rushed me and explained everything', 5, clinic);
    expect(result.issueTags).not.toContain('consultation_rush');
    expect(result.themes.map((t) => t.key)).toContain('doctor_care');
  });

  it('stops the negator at the clause boundary', () => {
    // "never rushed" must not suppress the praise after "and".
    const result = run('They never rushed us, and the clinic was very clean', 5, clinic);
    expect(result.themes.map((t) => t.key)).toContain('clean_facility');
  });

  it('leaves "not only" alone, because it introduces praise', () => {
    const result = run('Not only was the staff friendly, the clinic was spotless', 5, clinic);
    expect(result.praiseTags.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe('AI suggestions are contained, never trusted blindly', () => {
  it('uses AI tags when supplied and marks the method', () => {
    const result = run('Something vague', null, clinic, {
      issueTags: ['wait_time'],
      praiseTags: ['staff_friendly'],
      sentiment: 'MIXED',
    });
    expect(result.method).toBe('AI');
    expect(result.issueTags).toEqual(['wait_time']);
    expect(result.praiseTags).toEqual(['staff_friendly']);
    expect(result.sentiment).toBe('MIXED');
  });

  it('falls back to the built-in reader when no AI result is supplied', () => {
    const result = run('Waited far too long at reception', null, clinic, null);
    expect(result.method).toBe('KEYWORD');
    expect(result.issueTags).toContain('wait_time');
  });

  it('composes the overall sentiment itself rather than trusting the model', () => {
    // The model claims positive, but it also reported a complaint theme.
    const result = run('Anything', 5, clinic, {
      issueTags: ['wait_time'],
      praiseTags: [],
      sentiment: 'POSITIVE',
    });
    expect(result.sentiment).toBe('MIXED');
  });

  it('ignores an AI sentiment that arrives as null', () => {
    const result = run('Waited far too long', null, clinic, {
      issueTags: [],
      praiseTags: [],
      sentiment: null,
    });
    expect(result.sentiment).toBe('NEGATIVE');
  });

  it('produces a complete result even when AI returns nothing useful', () => {
    const result = run('Doctor explained everything clearly', 5, clinic, {
      issueTags: [],
      praiseTags: [],
      sentiment: null,
    });
    expect(result.sentiment).toBe('POSITIVE');
    expect(result.version).toBe(ANALYSIS_VERSION);
    expect(result.language).toBe('en');
  });
});

// ---------------------------------------------------------------------------

describe('confidence is graded honestly', () => {
  it('is LOW when nothing specific was recognised', () => {
    expect(run('Went on Tuesday').confidence).toBe('LOW');
  });

  it('is HIGH when several signals agree', () => {
    const result = run('Very clean and the doctor explained everything clearly', 5);
    expect(result.confidence).toBe('HIGH');
  });

  it('never claims a numeric probability', () => {
    const result = run('Waited far too long at reception', 1);
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.confidence);
  });
});

describe('missing data is handled without inventing anything', () => {
  it('handles a missing rating', () => {
    const result = run('Reception was rude');
    expect(result.sentiment).toBe('NEGATIVE');
  });

  it('handles empty text without throwing', () => {
    const result = run('');
    expect(result.themes).toEqual([]);
    expect(result.sentiment).toBe('NEUTRAL');
    expect(result.language).toBe('unknown');
  });

  it('labels an unanalysed sentiment in plain words', () => {
    expect(sentimentLabel('UNKNOWN')).toBe('Not analysed');
    expect(sentimentLabel('MIXED')).toBe('Mixed');
    expect(sentimentLabel('nonsense')).toBe('Not analysed');
  });
});
