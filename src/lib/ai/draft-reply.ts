import { replyPhraseFor, type DraftContext } from '@/lib/reply/draft';
import {
  EMOJI_GUIDANCE,
  FORMALITY_GUIDANCE,
  LANGUAGE_GUIDANCE,
  draftLanguageFor,
} from '@/lib/reply/voice';
import { runCompletion } from './index';
import { extractJson } from './types';

/**
 * Reply drafting via the provider abstraction.
 *
 * This is the second job an LLM is genuinely good at: turning a known set of
 * facts into a sentence that sounds like a person wrote it. It is given the
 * facts — the business's voice, the themes already found, the customer's own
 * words — and asked only to phrase them.
 *
 * It is never trusted. Whatever comes back goes through src/lib/reply/safety.ts
 * before anything is stored, and a failure there means the deterministic reply
 * is used instead. See COMPLIANCE.md.
 *
 * The review text passed here was redacted at intake, so no customer PII ever
 * reaches a provider.
 */

const SYSTEM_PROMPT = `You write short public replies on behalf of a local Indian small business responding to customer feedback. You are writing AS the business owner, not as an assistant.

HARD RULES — breaking any one of these makes the reply unusable:
1. Never offer, hint at or mention any discount, free item, voucher, gift or reward.
2. Never ask for a review, a rating, a star, or for a review to be changed, improved, removed or updated.
3. Never promise a refund, compensation, or that anyone has been or will be dismissed.
4. Never claim an operational change ("we have hired more staff", "from next week") — you do not know what the business has actually done.
5. Never state a number, price, time frame or date that is not already in the customer's own words.
6. Never make a medical or health claim, and never confirm anyone's treatment, diagnosis, prescription, test results or condition. Keep anything health-related general and professional.
7. Never admit legal liability or negligence.
8. Never include a phone number, email address, postal address, personal name or web link.
9. Never mention AI, automation, analysis, sentiment, themes, or the tool you are running inside.
10. Never quote the review back at length.

STYLE:
- 2 to 4 short sentences. Shorter is better.
- Acknowledge the specific thing the customer actually mentioned.
- Sound like a real person at that business. No corporate filler, no "we value your feedback", no "we sincerely apologise for the inconvenience caused".
- Apologise once at most, plainly, and only if something went wrong.
- If something needs fixing, invite them to get in touch directly. Do not say how, and do not give contact details.
- Do not open with the business name.

Return ONLY JSON: {"reply":"..."}`;

/**
 * The themes, described the way a person would say them rather than by their
 * internal category name. The model is handed the phrasing, not the taxonomy.
 */
function themeLines(context: DraftContext): string {
  if (context.themes.length === 0) return '(nothing specific)';
  return context.themes
    .map((theme) => {
      const phrase = replyPhraseFor(context.pack, theme);
      return theme.sentiment === 'POSITIVE'
        ? `- they were happy that ${phrase}`
        : `- they were unhappy about ${phrase}`;
    })
    .join('\n');
}

const CLASS_BRIEF: Record<string, string> = {
  PRAISE: 'This is praise. Thank them for the specific thing they mentioned.',
  COMPLAINT:
    'This is a complaint. Acknowledge the specific problem, apologise once, and invite them to get in touch so it can be looked at.',
  MIXED:
    'This is mixed. Acknowledge the good part briefly, then the problem, without being defensive.',
  QUESTION:
    'The customer asked something. Do not guess the answer. Thank them and invite them to get in touch directly so it can be answered properly.',
  NEUTRAL: 'This is a general comment. Keep the reply brief and warm.',
};

function buildUserPrompt(context: DraftContext): string {
  const voice = context.voice;
  const language = draftLanguageFor(voice, context.detectedLanguage);

  const lines = [
    `BUSINESS: ${voice.businessName}`,
    `BUSINESS TYPE: ${voice.verticalLabel}`,
    '',
    'HOW THIS BUSINESS SOUNDS:',
    `- Tone: ${FORMALITY_GUIDANCE[voice.formality]}`,
    `- Language: ${LANGUAGE_GUIDANCE[language]}`,
    `- Emoji: ${EMOJI_GUIDANCE[voice.emojiPolicy]}`,
  ];

  if (voice.preferredWords.length > 0) {
    lines.push(`- Words this business tends to use: ${voice.preferredWords.join(', ')}`);
  }
  if (voice.bannedWords.length > 0) {
    lines.push(`- NEVER use these words: ${voice.bannedWords.join(', ')}`);
  }
  if (voice.neverPromise.length > 0) {
    lines.push(`- NEVER say any of this: ${voice.neverPromise.join('; ')}`);
  }
  if (voice.sensitiveTopics.length > 0) {
    lines.push(`- Stay general about: ${voice.sensitiveTopics.join('; ')}`);
  }
  if (voice.signOff) {
    lines.push(`- End with this sign-off on its own line: ${voice.signOff.replace(/\{\{businessName\}\}/g, voice.businessName)}`);
  }
  if (voice.exampleReplies.length > 0) {
    lines.push('', 'REPLIES THIS BUSINESS HAS WRITTEN BEFORE (match this feel, do not copy):');
    lines.push(...voice.exampleReplies.slice(0, 3).map((r) => `- ${r}`));
  }
  if (voice.policyNotes.length > 0) {
    lines.push(
      '',
      'BUSINESS POLICY YOU MAY RELY ON (do not go beyond it):',
      ...voice.policyNotes.map((n) => `- ${n}`),
    );
  }

  lines.push(
    '',
    'WHAT THIS REVIEW IS:',
    `- ${CLASS_BRIEF[context.responseClass] ?? CLASS_BRIEF.NEUTRAL}`,
    `- Overall: ${context.sentiment.toLowerCase()}`,
    context.stars !== null ? `- Rating given: ${context.stars} out of 5` : '- No rating given',
    '',
    'WHAT THEY MENTIONED:',
    themeLines(context),
    '',
    'THE REVIEW:',
    context.text.replace(/\s+/g, ' ').trim(),
  );

  return lines.join('\n');
}

export type DraftAttempt =
  | { ok: true; text: string; model: string | null }
  | { ok: false; reason: string };

/** One reply. Returns a reason rather than throwing, so callers can fall back. */
export async function draftReplyWithAi(context: DraftContext): Promise<DraftAttempt> {
  const run = await runCompletion({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(context),
    json: true,
    // A little warmth, but not enough to wander off the facts it was given.
    temperature: 0.4,
    maxOutputTokens: 500,
  });

  if (!run.ok) {
    return { ok: false, reason: [run.reason, ...run.attempts].join(' ').trim() };
  }

  const parsed = extractJson(run.text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'the response was not in the expected form' };
  }

  const value = (parsed as { reply?: unknown }).reply;
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { ok: false, reason: 'the response contained no reply' };
  }

  return { ok: true, text: value.trim(), model: run.model };
}
