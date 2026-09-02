import type { Pack } from '@/lib/packs';

/**
 * VOICE RESOLUTION (M7).
 *
 * A reply has to sound like the business, not like a tool. Everything that
 * decides how it sounds comes from two places, in this order:
 *
 *   1. what the operator typed on the client's profile, and
 *   2. the vertical pack, for anything they left blank.
 *
 * That is the same contract M3 established for the feedback kit: a blank field
 * means "follow the pack", so improving a pack reaches every client already
 * onboarded. There are no per-vertical branches here or anywhere above this —
 * a salon and a clinic differ only by the JSON they resolve to.
 */

export type Formality = 'FORMAL' | 'NEUTRAL' | 'FRIENDLY' | 'CASUAL';
export type LanguageMix = 'ENGLISH' | 'HINDI' | 'HINGLISH' | 'MARATHI' | 'MIXED';
export type EmojiPolicy = 'NONE' | 'MINIMAL' | 'MODERATE';

export type VoiceProfileInput = {
  formality?: string | null;
  languageMix?: string | null;
  greeting?: string | null;
  signOff?: string | null;
  preferredWords?: string | null;
  bannedWords?: string | null;
  emojiPolicy?: string | null;
  exampleReplies?: string | null;
} | null;

export type PolicyInput = {
  refundPolicy?: string | null;
  appointmentPolicy?: string | null;
  cancellationPolicy?: string | null;
  neverPromise?: string | null;
  sensitiveTopics?: string | null;
} | null;

export type EffectiveVoice = {
  businessName: string;
  vertical: string;
  verticalLabel: string;
  formality: Formality;
  languageMix: LanguageMix;
  greeting: string;
  signOff: string;
  /** Words the business likes. Never forced into a reply — offered, not required. */
  preferredWords: string[];
  /** Words that must not appear. Pack + client, merged. Enforced after drafting. */
  bannedWords: string[];
  emojiPolicy: EmojiPolicy;
  exampleReplies: string[];
  /** Hard "do not say" lines from the business policy. */
  neverPromise: string[];
  sensitiveTopics: string[];
  /** Policy text the reply may lean on, e.g. how refunds actually work here. */
  policyNotes: string[];
};

const FORMALITIES: Formality[] = ['FORMAL', 'NEUTRAL', 'FRIENDLY', 'CASUAL'];
const LANGUAGE_MIXES: LanguageMix[] = [
  'ENGLISH',
  'HINDI',
  'HINGLISH',
  'MARATHI',
  'MIXED',
];
const EMOJI_POLICIES: EmojiPolicy[] = ['NONE', 'MINIMAL', 'MODERATE'];

function pickEnum<T extends string>(
  raw: string | null | undefined,
  allowed: T[],
  fallback: T,
): T {
  const value = (raw ?? '').trim().toUpperCase();
  return (allowed as string[]).includes(value) ? (value as T) : fallback;
}

/** Newline- or comma-separated operator input, cleaned into a list. */
export function splitList(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = (value ?? '').trim();
    if (trimmed.length > 0) return trimmed;
  }
  return '';
}

export function resolveVoice(
  pack: Pack,
  client: { businessName: string; vertical: string },
  profile: VoiceProfileInput,
  policy: PolicyInput,
): EffectiveVoice {
  const preset = pack.voicePreset;

  const clientBanned = splitList(profile?.bannedWords);
  const clientPreferred = splitList(profile?.preferredWords);
  const clientExamples = splitList(profile?.exampleReplies);

  return {
    businessName: client.businessName,
    vertical: client.vertical,
    verticalLabel: pack.label,
    formality: pickEnum(profile?.formality, FORMALITIES, preset.formality),
    languageMix: pickEnum(profile?.languageMix, LANGUAGE_MIXES, preset.languageMix),
    greeting: firstNonEmpty(profile?.greeting, preset.greeting),
    signOff: firstNonEmpty(profile?.signOff, preset.signOff),
    // Preferred words: the client's list wins when present, else the pack's.
    preferredWords: clientPreferred.length > 0 ? clientPreferred : preset.preferredWords,
    // Banned words are the ONE list that merges rather than overriding. A pack
    // bans "cure" and "guaranteed" for medical reasons; a client must not be
    // able to unban those by typing their own list.
    bannedWords: [...new Set([...preset.bannedWords, ...clientBanned])],
    emojiPolicy: pickEnum(profile?.emojiPolicy, EMOJI_POLICIES, preset.emojiPolicy),
    exampleReplies: clientExamples.length > 0 ? clientExamples : preset.exampleReplies,
    neverPromise: splitList(policy?.neverPromise),
    sensitiveTopics: splitList(policy?.sensitiveTopics),
    policyNotes: [
      policy?.refundPolicy?.trim() ? `Refunds: ${policy.refundPolicy.trim()}` : '',
      policy?.appointmentPolicy?.trim()
        ? `Appointments: ${policy.appointmentPolicy.trim()}`
        : '',
      policy?.cancellationPolicy?.trim()
        ? `Cancellations: ${policy.cancellationPolicy.trim()}`
        : '',
    ].filter((note) => note.length > 0),
  };
}

/** How the reply should read, in words a prompt (and a person) can follow. */
export const FORMALITY_GUIDANCE: Record<Formality, string> = {
  FORMAL: 'Respectful and professional. Full sentences. No slang.',
  NEUTRAL: 'Plain and businesslike. Neither stiff nor chatty.',
  FRIENDLY: 'Warm and human, still professional. Short sentences.',
  CASUAL: 'Relaxed and conversational, like a person typing quickly but politely.',
};

export const LANGUAGE_GUIDANCE: Record<LanguageMix, string> = {
  ENGLISH: 'Write in simple English.',
  HINDI: 'Write in Hindi, in Devanagari script.',
  HINGLISH:
    'Write in romanised Hinglish — everyday spoken Hindi written in Latin script, mixed with English. Do not use Devanagari.',
  MARATHI: 'Write in Marathi, in Devanagari script.',
  MIXED:
    'Match the language the customer wrote in. If they mixed languages, mix them the same way.',
};

export const EMOJI_GUIDANCE: Record<EmojiPolicy, string> = {
  NONE: 'Use no emoji at all.',
  MINIMAL: 'At most one emoji, and only if it genuinely fits.',
  MODERATE: 'One or two emoji are fine where they feel natural.',
};

/**
 * The language a reply should be written in for one review.
 *
 * MIXED means "follow the customer", which is why the detected language of the
 * review is needed here. Everything else is the business's standing choice.
 */
export function draftLanguageFor(
  voice: EffectiveVoice,
  detected: string | null,
): LanguageMix {
  if (voice.languageMix !== 'MIXED') return voice.languageMix;
  switch (detected) {
    case 'mr':
      return 'MARATHI';
    case 'hi':
      return 'HINDI';
    case 'mixed':
      return 'HINGLISH';
    default:
      return 'ENGLISH';
  }
}
