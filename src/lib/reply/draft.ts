import type { Pack } from '@/lib/packs';
import type { NormalizedTheme } from '@/lib/analysis/normalize';
import { checkDraft, type SafetyProblem } from './safety';
import {
  draftLanguageFor,
  type EffectiveVoice,
  type LanguageMix,
} from './voice';
import type { ResponseClass } from './triage';

/**
 * REPLY DRAFTING (M7).
 *
 * Two writers, one contract.
 *
 *  - The TEMPLATE writer is deterministic. It composes a short reply from the
 *    business's own voice and the themes the analysis layer already found. It
 *    cannot invent anything, because it only ever assembles text it was given.
 *  - The AI writer produces something that reads more naturally. Its output is
 *    then checked by the same safety gate as everything else, and any failure
 *    means the template reply is used instead.
 *
 * So there is no state in which the operator gets nothing, and no state in
 * which an unchecked model output is stored. A missing key is not an error
 * path — it is simply the template writer doing the job.
 */

/**
 * Bump when drafting rules change enough that stored drafts should be redone.
 * A draft the operator edited or marked handled is never redone: their words
 * are theirs, whatever the version says.
 *
 * 2 - themes are named the way a person would say them, in the language being
 *     written, instead of by their internal category label.
 */
export const DRAFT_VERSION = 2;

export type DraftSource = 'AI' | 'TEMPLATE';

export type DraftContext = {
  pack: Pack;
  voice: EffectiveVoice;
  /** The stored, already-redacted review text. */
  text: string;
  stars: number | null;
  sentiment: string;
  themes: NormalizedTheme[];
  responseClass: ResponseClass;
  /** Detected language of the review, used when the voice says "match them". */
  detectedLanguage: string | null;
};

export type DraftOutcome = {
  text: string;
  source: DraftSource;
  language: LanguageMix;
  /** Plain-language notes: why this draft looks the way it does. */
  notes: string[];
  problems: SafetyProblem[];
  /**
   * True when even this draft breaks a rule that must never be published — in
   * practice, a word the business itself banned that the deterministic writer
   * needs. Callers must not store the text; the operator writes this one.
   */
  blocked: boolean;
  version: number;
};

// ---------------------------------------------------------------------------
// Deterministic writer
// ---------------------------------------------------------------------------

type Phrases = {
  greeting: string;
  thanksPraise: string;
  thanksComplaint: string;
  thanksMixed: string;
  thanksQuestion: string;
  thanksNeutral: string;
  gladAbout: (what: string) => string;
  sorryAbout: (what: string) => string;
  /** Used when the theme cannot be named naturally in this language. */
  gladGeneric: string;
  sorryGeneric: string;
  passOn: string;
  lookInto: string;
  getInTouch: string;
  answerQuestion: string;
  signOff: (business: string) => string;
};

/**
 * Wording for the deterministic writer, per language.
 *
 * This is the one place the template writer's own sentences live. It is keyed
 * by language, never by vertical — what makes a clinic reply sound like a
 * clinic is the voice and the theme labels, both of which come from the pack.
 */
const PHRASES: Record<LanguageMix, Phrases> = {
  ENGLISH: {
    greeting: 'Thank you for taking the time to share this.',
    thanksPraise: 'Thank you for the kind words.',
    thanksComplaint: 'Thank you for telling us.',
    thanksMixed: 'Thank you for the honest feedback.',
    thanksQuestion: 'Thank you for getting in touch.',
    thanksNeutral: 'Thank you for the feedback.',
    gladAbout: (what) => `It is good to hear that ${what}.`,
    sorryAbout: (what) => `We are sorry about ${what}.`,
    gladGeneric: 'It is good to hear you had a good experience.',
    sorryGeneric: 'We are sorry it did not go the way it should have.',
    passOn: 'We will pass this on to the team.',
    lookInto: 'We are looking into it.',
    getInTouch:
      'Please get in touch with us directly and mention your visit, so we can look at what happened.',
    answerQuestion:
      'Please contact us directly and we will answer this properly for you.',
    signOff: (business) => `— Team ${business}`,
  },
  HINDI: {
    greeting: 'अपना अनुभव साझा करने के लिए धन्यवाद.',
    thanksPraise: 'आपके अच्छे शब्दों के लिए धन्यवाद.',
    thanksComplaint: 'बताने के लिए धन्यवाद.',
    thanksMixed: 'ईमानदार प्रतिक्रिया के लिए धन्यवाद.',
    thanksQuestion: 'संपर्क करने के लिए धन्यवाद.',
    thanksNeutral: 'प्रतिक्रिया के लिए धन्यवाद.',
    // Hindi has no per-theme phrasing in the packs yet, so these frames are
    // only ever used with the generic lines below.
    gladAbout: (what) => `यह सुनकर अच्छा लगा कि ${what}.`,
    sorryAbout: (what) => `${what} के लिए हमें खेद है.`,
    gladGeneric: 'यह सुनकर अच्छा लगा कि आपका अनुभव अच्छा रहा.',
    sorryGeneric: 'जो हुआ उसके लिए हमें खेद है.',
    passOn: 'हम यह बात टीम तक ज़रूर पहुँचाएँगे.',
    lookInto: 'हम इसे देख रहे हैं.',
    getInTouch:
      'कृपया हमसे सीधे संपर्क करें और अपनी विज़िट का ज़िक्र करें, ताकि हम देख सकें कि क्या हुआ.',
    answerQuestion:
      'कृपया हमसे सीधे संपर्क करें, हम आपको सही जानकारी दे देंगे.',
    signOff: (business) => `— ${business} टीम`,
  },
  HINGLISH: {
    greeting: 'Feedback share karne ke liye dhanyawaad.',
    thanksPraise: 'Aapke acche shabdon ke liye dhanyawaad.',
    thanksComplaint: 'Batane ke liye dhanyawaad.',
    thanksMixed: 'Honest feedback ke liye dhanyawaad.',
    thanksQuestion: 'Sampark karne ke liye dhanyawaad.',
    thanksNeutral: 'Feedback ke liye dhanyawaad.',
    gladAbout: (what) => `Achha laga ki ${what}.`,
    sorryAbout: (what) => `${what} ke liye humein khed hai.`,
    gladGeneric: 'Achha laga ki aapka experience theek raha.',
    sorryGeneric: 'Jo hua uske liye humein khed hai.',
    passOn: 'Hum yeh baat team tak pahuncha denge.',
    lookInto: 'Hum ise dekh rahe hain.',
    getInTouch:
      'Kripya humse seedha sampark karein aur apni visit ka zikr karein, taaki hum dekh sakein kya hua.',
    answerQuestion:
      'Kripya humse seedha sampark karein, hum aapko sahi jaankari de denge.',
    signOff: (business) => `— Team ${business}`,
  },
  MARATHI: {
    greeting: 'तुमचा अनुभव सांगितल्याबद्दल धन्यवाद.',
    thanksPraise: 'तुमच्या चांगल्या शब्दांबद्दल धन्यवाद.',
    thanksComplaint: 'सांगितल्याबद्दल धन्यवाद.',
    thanksMixed: 'प्रामाणिक अभिप्रायाबद्दल धन्यवाद.',
    thanksQuestion: 'संपर्क साधल्याबद्दल धन्यवाद.',
    thanksNeutral: 'अभिप्रायाबद्दल धन्यवाद.',
    gladAbout: (what) => `${what} हे ऐकून बरे वाटले.`,
    sorryAbout: (what) => `${what} आम्हाला खेद आहे.`,
    gladGeneric: 'तुमचा अनुभव चांगला राहिला हे ऐकून बरे वाटले.',
    sorryGeneric: 'जे झाले त्याबद्दल आम्हाला मनापासून खेद आहे.',
    passOn: 'आम्ही हे टीमपर्यंत नक्की पोहोचवू.',
    lookInto: 'आम्ही याकडे लक्ष देत आहोत.',
    getInTouch:
      'कृपया आमच्याशी थेट संपर्क साधा आणि तुमच्या भेटीचा उल्लेख करा, म्हणजे नेमके काय झाले ते आम्ही पाहू शकू.',
    answerQuestion:
      'कृपया आमच्याशी थेट संपर्क साधा, आम्ही तुम्हाला योग्य माहिती देऊ.',
    signOff: (business) => `— ${business} टीम`,
  },
  // "Match the customer" is resolved to a concrete language before we get here;
  // this entry only exists so the record is total.
  MIXED: {
    greeting: 'Thank you for taking the time to share this.',
    thanksPraise: 'Thank you for the kind words.',
    thanksComplaint: 'Thank you for telling us.',
    thanksMixed: 'Thank you for the honest feedback.',
    thanksQuestion: 'Thank you for getting in touch.',
    thanksNeutral: 'Thank you for the feedback.',
    gladAbout: (what) => `It is good to hear that ${what}.`,
    sorryAbout: (what) => `We are sorry about ${what}.`,
    gladGeneric: 'It is good to hear you had a good experience.',
    sorryGeneric: 'We are sorry it did not go the way it should have.',
    passOn: 'We will pass this on to the team.',
    lookInto: 'We are looking into it.',
    getInTouch:
      'Please get in touch with us directly and mention your visit, so we can look at what happened.',
    answerQuestion:
      'Please contact us directly and we will answer this properly for you.',
    signOff: (business) => `— Team ${business}`,
  },
};

/**
 * How to name one theme inside a sentence a customer will read.
 *
 * The pack's `replyPhrase` is the wording a person would actually use. The
 * fallback exists only for a pack written before M7: it strips the "A / B"
 * alternation out of a category label so at least no slash reaches a customer.
 */
export function replyPhraseFor(
  pack: Pack,
  theme: NormalizedTheme,
  language: LanguageMix = 'ENGLISH',
): string | null {
  const taxonomy = theme.kind === 'ISSUE' ? pack.issueTaxonomy : pack.praiseTaxonomy;
  const entry = taxonomy.find((t) => t.key === theme.key);
  if (!entry) return null;

  const phrase =
    language === 'MARATHI'
      ? entry.replyPhraseMarathi
      : language === 'HINGLISH'
        ? entry.replyPhraseHinglish
        : entry.replyPhrase;

  const trimmed = phrase?.trim();
  if (trimmed) return trimmed;

  // English can fall back to a cleaned-up label; the other languages cannot,
  // because an English category name inside a Marathi sentence reads worse
  // than a general sentence that names nothing.
  if (language !== 'ENGLISH') return null;
  return (theme.label.split('/')[0] ?? theme.label).trim().toLowerCase();
}

/**
 * The one theme worth naming.
 *
 * A reply that lists everything reads like a summary, not a reply. Issues are
 * ordered by severity so the most serious thing is the thing acknowledged.
 */
function leadTheme(themes: NormalizedTheme[]): NormalizedTheme | null {
  const weight = { high: 0, medium: 1, low: 2 } as const;
  return (
    [...themes].sort((a, b) => weight[a.severity] - weight[b.severity])[0] ?? null
  );
}

/**
 * Capitalises the first letter of a sentence.
 *
 * The Hinglish frame puts the theme phrase first ("lambe intezaar ke liye
 * humein khed hai"), and a stored phrase is written to sit mid-sentence.
 * Scripts without case, like Devanagari, are unaffected.
 */
function sentenceCase(line: string): string {
  const trimmed = line.trim();
  if (trimmed.length === 0) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function renderTokens(template: string, businessName: string): string {
  return template.replace(/\{\{businessName\}\}/g, businessName).trim();
}

function packTemplate(pack: Pack, key: string): string | null {
  const body = pack.contentTemplates.find((t) => t.key === key)?.body;
  return body && body.trim().length > 0 ? body : null;
}

/**
 * The pack's own negative reply, found by key convention rather than by
 * vertical. Every pack names it `reply_negative_<something>`; the suffix
 * differs because each trade's most common complaint differs. Matching the
 * prefix keeps this universal — no `if clinic` anywhere.
 */
function packNegativeTemplate(pack: Pack): string | null {
  const entry = pack.contentTemplates.find((t) => t.key.startsWith('reply_negative'));
  return entry && entry.body.trim().length > 0 ? entry.body : null;
}

/**
 * Composes a reply from parts. Nothing here can invent a fact: every fragment
 * is either a fixed sentence or a theme label the analysis layer produced.
 */
export function templateDraft(context: DraftContext): DraftOutcome {
  const language = draftLanguageFor(context.voice, context.detectedLanguage);
  const p = PHRASES[language];
  const notes: string[] = [];
  const business = context.voice.businessName;

  const praises = context.themes.filter((t) => t.kind === 'PRAISE');
  const issues = context.themes.filter((t) => t.kind === 'ISSUE');

  // Name the single most important thing, in the language being written. When
  // the pack has no wording for that language, acknowledge the point without
  // naming it: a general sentence beats a jarring one.
  const leadPraise = leadTheme(praises);
  const leadIssue = leadTheme(issues);
  const praisePhrase = leadPraise
    ? replyPhraseFor(context.pack, leadPraise, language)
    : null;
  const issuePhrase = leadIssue ? replyPhraseFor(context.pack, leadIssue, language) : null;
  const gladLine = sentenceCase(
    praisePhrase ? p.gladAbout(praisePhrase) : p.gladGeneric,
  );
  const sorryLine = sentenceCase(
    issuePhrase ? p.sorryAbout(issuePhrase) : p.sorryGeneric,
  );

  // English keeps the business's own greeting and sign-off when it has one.
  // Other languages use the written-in-that-language versions, because a
  // half-translated reply reads worse than a consistent one.
  const useVoiceLines = language === 'ENGLISH';
  const greeting = useVoiceLines
    ? renderTokens(context.voice.greeting || p.greeting, business)
    : p.greeting;
  const signOff = useVoiceLines
    ? renderTokens(context.voice.signOff || p.signOff(business), business)
    : p.signOff(business);

  // One opener only. The business's own greeting is already a thank-you in
  // every pack, so adding the class-specific one on top reads as filler.
  const hasGreeting = greeting.trim().length > 0;
  const lines: string[] = [];
  const opener = (classThanks: string) => (hasGreeting ? [] : [classThanks]);

  switch (context.responseClass) {
    case 'PRAISE': {
      if (praises.length === 0) {
        // Nothing specific was said, so use the pack's own thank-you rather
        // than inventing a detail to be grateful for.
        const template = packTemplate(context.pack, 'reply_positive');
        if (template && useVoiceLines) {
          notes.push('Used this business type’s standard thank-you.');
          return finish(renderTokens(template, business), 'TEMPLATE', language, notes, context);
        }
        lines.push(...opener(p.thanksPraise), p.passOn);
      } else {
        lines.push(...opener(p.thanksPraise), gladLine, p.passOn);
      }
      break;
    }

    case 'COMPLAINT': {
      if (issues.length === 0) {
        const template = packNegativeTemplate(context.pack);
        if (template && useVoiceLines) {
          notes.push('Used this business type’s standard reply to a complaint.');
          return finish(renderTokens(template, business), 'TEMPLATE', language, notes, context);
        }
        lines.push(...opener(p.thanksComplaint), p.lookInto, p.getInTouch);
      } else {
        lines.push(
          ...opener(p.thanksComplaint),
          sorryLine,
          p.getInTouch,
        );
      }
      break;
    }

    case 'MIXED': {
      lines.push(...opener(p.thanksMixed));
      if (praises.length > 0) lines.push(gladLine);
      if (issues.length > 0) lines.push(sorryLine);
      lines.push(issues.length > 0 ? p.getInTouch : p.passOn);
      break;
    }

    case 'QUESTION': {
      lines.push(...opener(p.thanksQuestion), p.answerQuestion);
      break;
    }

    default: {
      lines.push(...opener(p.thanksNeutral), p.passOn);
      break;
    }
  }

  const body = [greeting, ...lines].filter((line) => line.trim().length > 0);

  notes.push('Written by Headway from your saved wording — edit it to sound more like you.');
  return finish(
    `${body.join(' ')}\n\n${signOff}`.trim(),
    'TEMPLATE',
    language,
    notes,
    context,
  );
}

function finish(
  text: string,
  source: DraftSource,
  language: LanguageMix,
  notes: string[],
  context: DraftContext,
): DraftOutcome {
  const result = checkDraft(text, {
    voice: context.voice,
    sourceText: context.text,
    allowedContext: context.voice.policyNotes,
  });

  return {
    text,
    source,
    language,
    notes,
    problems: result.problems,
    blocked: !result.storable,
    version: DRAFT_VERSION,
  };
}

// ---------------------------------------------------------------------------
// The public entry point
// ---------------------------------------------------------------------------

export type AiDrafter = (context: DraftContext) => Promise<
  | { ok: true; text: string; model: string | null }
  | { ok: false; reason: string }
>;

/**
 * Produces the suggested reply for one item.
 *
 * Order: try the AI writer when one is available, check it, use it if it is
 * clean, otherwise fall back to the deterministic writer and say so. The
 * deterministic result is computed either way, so a fallback costs nothing.
 */
export async function draftReply(
  context: DraftContext,
  options: { useAi: boolean; drafter?: AiDrafter },
): Promise<DraftOutcome> {
  const template = templateDraft(context);

  if (!options.useAi || !options.drafter) {
    return template;
  }

  let attempt: Awaited<ReturnType<AiDrafter>>;
  try {
    attempt = await options.drafter(context);
  } catch (error) {
    return {
      ...template,
      notes: [
        ...template.notes,
        error instanceof Error
          ? `The writing assistant could not be reached (${error.message}). This is Headway’s own wording.`
          : 'The writing assistant could not be reached. This is Headway’s own wording.',
      ],
    };
  }

  if (!attempt.ok) {
    return {
      ...template,
      notes: [
        ...template.notes,
        `The writing assistant was unavailable, so this is Headway’s own wording. (${attempt.reason})`,
      ],
    };
  }

  const candidate = attempt.text.trim();
  const check = checkDraft(candidate, {
    voice: context.voice,
    sourceText: context.text,
    allowedContext: context.voice.policyNotes,
  });

  if (!check.ok) {
    // Anything at all wrong with the assisted draft and it is discarded. There
    // is no partial acceptance and no attempt to patch it up.
    return {
      ...template,
      notes: [
        ...template.notes,
        `A suggested wording was discarded because it ${check.problems
          .map((p) => p.message.replace(/^The reply /, '').replace(/\.$/, ''))
          .join('; ')}.`,
      ],
    };
  }

  return {
    text: candidate,
    source: 'AI',
    language: draftLanguageFor(context.voice, context.detectedLanguage),
    notes: ['Drafted with the writing assistant, using your saved voice.'],
    problems: [],
    blocked: false,
    version: DRAFT_VERSION,
  };
}
