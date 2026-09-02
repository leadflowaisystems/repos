import { checkDraft, type SafetyProblem } from '@/lib/reply/safety';
import type { EffectiveVoice, LanguageMix } from '@/lib/reply/voice';
import {
  insightNumbers,
  type InsightAction,
  type InsightTheme,
  type OwnerInsight,
} from './insight';

/**
 * OWNER COMMUNICATION (M8).
 *
 * Turns the insight object into text the operator can copy and send. Nothing
 * here decides anything: every fact in every message comes from the insight,
 * and the insight came from stored rows.
 *
 * A deliberate distinction runs through this file:
 *
 *   a REVIEW REPLY is public, customer-facing, short, and never analytical;
 *   an OWNER UPDATE is private, owner-facing, analytical, and carries numbers.
 *
 * They are composed by different code for that reason. The review reply lives
 * in src/lib/reply/ and is untouched by this milestone.
 *
 * RepOS sends none of these. Every one ends at a Copy button.
 */

/** Bump when the wording or structure changes enough to matter. */
export const COMMS_VERSION = 1;

export const COMMS_TYPES = [
  'OWNER_UPDATE',
  'ACTION_MESSAGE',
  'FOLLOW_UP',
  'REVIEW_REPLY',
] as const;

export type CommsType = (typeof COMMS_TYPES)[number];

export const COMMS_LABELS: Record<CommsType, string> = {
  OWNER_UPDATE: 'Owner update',
  ACTION_MESSAGE: 'Recommended next step',
  FOLLOW_UP: 'Follow-up nudge',
  REVIEW_REPLY: 'Reply to a review',
};

export const COMMS_DESCRIPTIONS: Record<CommsType, string> = {
  OWNER_UPDATE: 'What their customers are saying, and what to do about it.',
  ACTION_MESSAGE: 'The one change worth making, on its own.',
  FOLLOW_UP: 'A short nudge asking whether they got to it.',
  REVIEW_REPLY: 'Written per review, on the Feedback page.',
};

export type ComposedMessage = {
  type: CommsType;
  /** Operator-facing card title. Never part of the copied text. */
  title: string;
  /** Clean plain text, ready to paste anywhere. */
  body: string;
  language: LanguageMix;
  /** Why it says what it says, and what it could not say. Operator-facing. */
  notes: string[];
  problems: SafetyProblem[];
  /** True when the message must not be offered at all. */
  blocked: boolean;
  version: number;
};

// ---------------------------------------------------------------------------
// Wording, per language
// ---------------------------------------------------------------------------

/**
 * Sentence frames for owner-facing messages.
 *
 * Keyed by language, never by vertical — what makes a clinic update sound like
 * a clinic is the voice and the pack's own advice, not a branch in here.
 *
 * Theme names stay as they are written in the pack. Translating a hundred and
 * nineteen category names badly would read worse than a localised sentence
 * around an English label, which is how these businesses already write.
 */
type OwnerPhrases = {
  updateOpening: (business: string) => string;
  lovesHeading: string;
  dislikesHeading: string;
  mainIssueHeading: string;
  mentions: (n: number) => string;
  changedHeading: string;
  recommendHeading: string;
  basedOn: (n: number) => string;
  nothingYet: string;
  tooEarly: (n: number) => string;
  noIssuesYet: string;
  noPraiseYet: string;
  willCheck: (theme: string) => string;
  actionOpening: (business: string) => string;
  actionBecause: (theme: string, n: number) => string;
  followUpOpening: (business: string) => string;
  followUpAsk: string;
  alreadyRecorded: (what: string) => string;
  /** The improvement loop (M11), in the three states worth telling an owner. */
  agreedHeading: string;
  changeMadeHeading: string;
  sinceChangeHeading: string;
  beforeAfter: (before: string, after: string) => string;
  awaitingEvidence: (theme: string) => string;
};

const PHRASES: Record<LanguageMix, OwnerPhrases> = {
  ENGLISH: {
    updateOpening: (b) => `Quick customer update for ${b}:`,
    lovesHeading: 'Customers are happiest with:',
    dislikesHeading: 'Customers are unhappy about:',
    mainIssueHeading: 'The main issue is:',
    mentions: (n) =>
      `mentioned ${n} ${n === 1 ? 'time' : 'times'} across all the feedback so far`,
    changedHeading: 'What changed between your last two check-ins:',
    recommendHeading: 'Recommended next step:',
    basedOn: (n) => `Based on ${n} ${n === 1 ? 'review' : 'reviews'} we have read.`,
    nothingYet:
      'We have not read enough customer feedback yet to tell you anything useful. As soon as there is enough, this update will have real numbers in it.',
    tooEarly: (n) =>
      `So far we have read ${n} ${n === 1 ? 'review' : 'reviews'} — too few to draw conclusions from yet. Here is what we are seeing anyway, with that caveat.`,
    noIssuesYet: 'Nothing is coming up often enough to call it a problem yet.',
    noPraiseYet: 'Nothing specific has been praised often enough to name yet.',
    willCheck: (t) =>
      `We will check the next batch of feedback to see whether ${t.toLowerCase()} comes up less often.`,
    actionOpening: (b) => `Recommended next step for ${b}:`,
    actionBecause: (t, n) =>
      `This is based on ${n} ${n === 1 ? 'customer' : 'customers'} mentioning ${t.toLowerCase()}.`,
    followUpOpening: (b) => `Quick follow-up on ${b}:`,
    followUpAsk: 'Have you had a chance to look at this?',
    alreadyRecorded: (w) => `Last recorded on your side: ${w}`,
    agreedHeading: 'What you agreed to do:',
    changeMadeHeading: 'The change you have made:',
    sinceChangeHeading: 'What the feedback has done since:',
    beforeAfter: (b, a) => `Before: ${b}. Since the change: ${a}.`,
    awaitingEvidence: (t) =>
      `We do not have enough new feedback yet to say whether ${t.toLowerCase()} has changed. We will check again as more comes in.`,
  },

  HINDI: {
    updateOpening: (b) => `${b} के लिए ग्राहकों का संक्षिप्त अपडेट:`,
    lovesHeading: 'ग्राहक इनसे सबसे ज़्यादा खुश हैं:',
    dislikesHeading: 'ग्राहक इनसे नाखुश हैं:',
    mainIssueHeading: 'सबसे बड़ी समस्या:',
    mentions: (n) => `अब तक की सारी प्रतिक्रिया में ${n} बार बताया गया`,
    changedHeading: 'आपकी पिछली दो जाँचों के बीच क्या बदला:',
    recommendHeading: 'सुझाया गया अगला कदम:',
    basedOn: (n) => `हमने पढ़ी गई ${n} समीक्षाओं के आधार पर.`,
    nothingYet:
      'अभी इतनी प्रतिक्रिया नहीं पढ़ी गई है कि कुछ उपयोगी बताया जा सके. जैसे ही पर्याप्त होगी, इस अपडेट में असली आंकड़े होंगे.',
    tooEarly: (n) =>
      `अब तक ${n} समीक्षाएँ पढ़ी गई हैं — निष्कर्ष निकालने के लिए बहुत कम. फिर भी अब तक जो दिख रहा है, वह यह है.`,
    noIssuesYet: 'अभी कोई बात इतनी बार नहीं आई कि उसे समस्या कहा जाए.',
    noPraiseYet: 'अभी किसी एक बात की इतनी तारीफ़ नहीं हुई कि उसका नाम लिया जाए.',
    willCheck: (t) =>
      `अगली प्रतिक्रिया में हम देखेंगे कि ${t} की शिकायत कम होती है या नहीं.`,
    actionOpening: (b) => `${b} के लिए सुझाया गया अगला कदम:`,
    actionBecause: (t, n) => `यह ${n} ग्राहकों द्वारा ${t} बताए जाने पर आधारित है.`,
    followUpOpening: (b) => `${b} के बारे में एक छोटा सा फ़ॉलो-अप:`,
    followUpAsk: 'क्या आपको इसे देखने का मौका मिला?',
    alreadyRecorded: (w) => `आपकी तरफ़ से आख़िरी दर्ज बात: ${w}`,
    agreedHeading: 'आपने जो करने पर सहमति दी:',
    changeMadeHeading: 'आपने जो बदलाव किया:',
    sinceChangeHeading: 'उसके बाद प्रतिक्रिया में क्या हुआ:',
    beforeAfter: (b, a) => `पहले: ${b}. बदलाव के बाद: ${a}.`,
    awaitingEvidence: (t) =>
      `${t} में बदलाव हुआ या नहीं, यह बताने के लिए अभी पर्याप्त नई प्रतिक्रिया नहीं है. और आने पर हम फिर देखेंगे.`,
  },

  HINGLISH: {
    updateOpening: (b) => `${b} ke liye customer update:`,
    lovesHeading: 'Customers sabse zyada khush hain:',
    dislikesHeading: 'Customers in cheezon se khush nahi hain:',
    mainIssueHeading: 'Sabse badi dikkat:',
    mentions: (n) => `ab tak ki saari feedback mein ${n} baar bataya gaya`,
    changedHeading: 'Aapke pichhle do check-ins ke beech kya badla:',
    recommendHeading: 'Suggested next step:',
    basedOn: (n) => `Humne padhi hui ${n} reviews ke aadhaar par.`,
    nothingYet:
      'Abhi itni feedback nahi padhi gayi ki kuch useful bata sakein. Jaise hi kaafi ho jayegi, is update mein asli numbers honge.',
    tooEarly: (n) =>
      `Ab tak ${n} reviews padhi hain — conclusion nikalne ke liye bahut kam. Phir bhi jo dikh raha hai, woh yeh hai.`,
    noIssuesYet: 'Abhi koi baat itni baar nahi aayi ki use problem kaha jaye.',
    noPraiseYet: 'Abhi kisi ek cheez ki itni tareef nahi hui ki uska naam liya jaye.',
    willCheck: (t) =>
      `Agli feedback mein hum dekhenge ki ${t} ki shikayat kam hoti hai ya nahi.`,
    actionOpening: (b) => `${b} ke liye suggested next step:`,
    actionBecause: (t, n) => `Yeh ${n} customers ke ${t} batane par aadharit hai.`,
    followUpOpening: (b) => `${b} par ek chhota follow-up:`,
    followUpAsk: 'Aapko ise dekhne ka mauka mila?',
    alreadyRecorded: (w) => `Aapki taraf se aakhri record ki gayi baat: ${w}`,
    agreedHeading: 'Aapne jo karne ke liye haan kaha:',
    changeMadeHeading: 'Aapne jo change kiya:',
    sinceChangeHeading: 'Uske baad feedback mein kya hua:',
    beforeAfter: (b, a) => `Pehle: ${b}. Change ke baad: ${a}.`,
    awaitingEvidence: (t) =>
      `${t} mein change hua ya nahi, yeh batane ke liye abhi kaafi nayi feedback nahi hai. Aur aane par hum phir dekhenge.`,
  },

  MARATHI: {
    updateOpening: (b) => `${b} साठी ग्राहकांचा थोडक्यात अपडेट:`,
    lovesHeading: 'ग्राहक यांबद्दल सर्वात जास्त खूश आहेत:',
    dislikesHeading: 'ग्राहक यांबद्दल नाराज आहेत:',
    mainIssueHeading: 'सर्वात मोठी अडचण:',
    mentions: (n) => `आतापर्यंतच्या सर्व अभिप्रायात ${n} वेळा सांगितले गेले`,
    changedHeading: 'तुमच्या मागील दोन तपासण्यांदरम्यान काय बदलले:',
    recommendHeading: 'सुचवलेले पुढचे पाऊल:',
    basedOn: (n) => `आम्ही वाचलेल्या ${n} अभिप्रायांवर आधारित.`,
    nothingYet:
      'अजून इतका अभिप्राय वाचला गेलेला नाही की काही उपयुक्त सांगता येईल. पुरेसा जमल्यावर या अपडेटमध्ये खरे आकडे असतील.',
    tooEarly: (n) =>
      `आतापर्यंत ${n} अभिप्राय वाचले आहेत — निष्कर्ष काढण्यासाठी फार कमी. तरीही जे दिसते आहे ते हे.`,
    noIssuesYet: 'अजून कोणतीही गोष्ट इतक्या वेळा आलेली नाही की तिला अडचण म्हणावे.',
    noPraiseYet: 'अजून एखाद्या गोष्टीचे इतके कौतुक झालेले नाही की तिचे नाव घ्यावे.',
    willCheck: (t) =>
      `पुढच्या अभिप्रायात ${t} ची तक्रार कमी होते का ते आम्ही पाहू.`,
    actionOpening: (b) => `${b} साठी सुचवलेले पुढचे पाऊल:`,
    actionBecause: (t, n) => `हे ${n} ग्राहकांनी ${t} सांगितल्यावर आधारित आहे.`,
    followUpOpening: (b) => `${b} बद्दल एक छोटा पाठपुरावा:`,
    followUpAsk: 'तुम्हाला हे पाहायला वेळ मिळाला का?',
    alreadyRecorded: (w) => `तुमच्याकडून शेवटची नोंद: ${w}`,
    agreedHeading: 'तुम्ही जे करायचे ठरवले:',
    changeMadeHeading: 'तुम्ही केलेला बदल:',
    sinceChangeHeading: 'त्यानंतर अभिप्रायात काय झाले:',
    beforeAfter: (b, a) => `आधी: ${b}. बदलानंतर: ${a}.`,
    awaitingEvidence: (t) =>
      `${t} मध्ये बदल झाला की नाही हे सांगण्यासाठी अजून पुरेसा नवीन अभिप्राय नाही. अजून आल्यावर आम्ही पुन्हा पाहू.`,
  },

  // "Match the customer" has no meaning for a message to the owner, so it
  // resolves to English before composing. This entry keeps the record total.
  MIXED: {
    updateOpening: (b) => `Quick customer update for ${b}:`,
    lovesHeading: 'Customers are happiest with:',
    dislikesHeading: 'Customers are unhappy about:',
    mainIssueHeading: 'The main issue is:',
    mentions: (n) => `mentioned ${n} ${n === 1 ? 'time' : 'times'}`,
    changedHeading: 'What changed between your last two check-ins:',
    recommendHeading: 'Recommended next step:',
    basedOn: (n) => `Based on ${n} ${n === 1 ? 'review' : 'reviews'} we have read.`,
    nothingYet:
      'We have not read enough customer feedback yet to tell you anything useful.',
    tooEarly: (n) => `So far we have read ${n} reviews — too few to draw conclusions from.`,
    noIssuesYet: 'Nothing is coming up often enough to call it a problem yet.',
    noPraiseYet: 'Nothing specific has been praised often enough to name yet.',
    willCheck: (t) =>
      `We will check the next batch of feedback to see whether ${t.toLowerCase()} comes up less often.`,
    actionOpening: (b) => `Recommended next step for ${b}:`,
    actionBecause: (t, n) => `This is based on ${n} customers mentioning ${t.toLowerCase()}.`,
    followUpOpening: (b) => `Quick follow-up on ${b}:`,
    followUpAsk: 'Have you had a chance to look at this?',
    alreadyRecorded: (w) => `Last recorded on your side: ${w}`,
    agreedHeading: 'What you agreed to do:',
    changeMadeHeading: 'The change you have made:',
    sinceChangeHeading: 'What the feedback has done since:',
    beforeAfter: (b, a) => `Before: ${b}. Since the change: ${a}.`,
    awaitingEvidence: (t) =>
      `We do not have enough new feedback yet to say whether ${t.toLowerCase()} has changed.`,
  },
};

/**
 * The language an owner message is written in.
 *
 * "Match the customer" is a rule about replying to a review; it means nothing
 * for a message to the business owner, so it resolves to English.
 */
export function ownerLanguage(voice: EffectiveVoice): LanguageMix {
  return voice.languageMix === 'MIXED' ? 'ENGLISH' : voice.languageMix;
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

const BULLET = '•';
const MAX_LISTED = 3;

/** Themes worth naming, most mentioned first. Below the floor, nothing. */
function named(themes: InsightTheme[]): InsightTheme[] {
  return themes.filter((theme) => theme.qualifies).slice(0, MAX_LISTED);
}

function bulletLine(label: string, detail?: string): string {
  return detail ? `${BULLET} ${label} — ${detail}` : `${BULLET} ${label}`;
}

function join(blocks: Array<string | null>): string {
  return blocks
    .filter((block): block is string => typeof block === 'string' && block.length > 0)
    .join('\n\n')
    .trim();
}

function finish(
  type: CommsType,
  title: string,
  body: string,
  language: LanguageMix,
  notes: string[],
  insight: OwnerInsight,
  voice: EffectiveVoice,
): ComposedMessage {
  const result = checkDraft(body, {
    voice,
    // An owner message answers to the stored data, not to one customer's words.
    sourceText: '',
    allowedContext: voice.policyNotes,
    allowedNumbers: insightNumbers(insight),
    maxWords: 320,
  });

  return {
    type,
    title,
    body,
    language,
    notes,
    problems: result.problems,
    blocked: !result.storable,
    version: COMMS_VERSION,
  };
}

/**
 * The owner update.
 *
 * Structure is fixed; content is not. A section that the data cannot support
 * is left out entirely rather than filled with a hedge, and an owner with too
 * little feedback is told exactly that instead of being handed a confident
 * paragraph built on nothing.
 */
/**
 * The improvement loop, as far as the evidence allows (M11).
 *
 * Three states, three very different sentences:
 *
 *   ACCEPTED - what you said you would do. No claim of any kind.
 *   DONE     - what you did, and an honest "not enough feedback yet".
 *   MEASURED - what the feedback did afterwards, in the measurement engine's
 *              own wording, which says "since the change" and never "because".
 *
 * There is no branch that produces an outcome sentence before measurement, so
 * an owner cannot be told a change worked on the strength of it having
 * happened.
 */
function actionBlock(
  action: InsightAction | null,
  p: OwnerPhrases,
): { block: string | null; note: string | null } {
  if (!action) return { block: null, note: null };

  if (action.status === 'ACCEPTED') {
    return {
      block: [p.agreedHeading, bulletLine(action.decision)].join('\n'),
      note: 'The agreed change is mentioned. Nothing claims it has happened yet.',
    };
  }

  if (action.status === 'DONE' || !action.result) {
    return {
      block: [
        p.changeMadeHeading,
        bulletLine(action.decision),
        '',
        p.awaitingEvidence(action.themeLabel),
      ].join('\n'),
      note: 'The change is mentioned as made. No result is claimed, because none has been measured.',
    };
  }

  return {
    block: [
      p.sinceChangeHeading,
      bulletLine(action.decision),
      bulletLine(action.result.headline),
      bulletLine(p.beforeAfter(action.result.beforeLine, action.result.afterLine)),
    ].join('\n'),
    note: 'The measured before and after is included, with no claim about what caused it.',
  };
}

export function composeOwnerUpdate(
  insight: OwnerInsight,
  voice: EffectiveVoice,
): ComposedMessage {
  const language = ownerLanguage(voice);
  const p = PHRASES[language];
  const notes: string[] = [];

  const opening = p.updateOpening(insight.businessName);

  if (insight.evidence.analysed === 0) {
    notes.push('There is nothing to report until some feedback has been read.');
    return finish(
      'OWNER_UPDATE',
      COMMS_LABELS.OWNER_UPDATE,
      join([opening, p.nothingYet]),
      language,
      notes,
      insight,
      voice,
    );
  }

  const loves = named(insight.loves);
  const dislikes = named(insight.dislikes);

  const caveat = insight.evidence.enough ? null : p.tooEarly(insight.evidence.analysed);
  if (!insight.evidence.enough) {
    notes.push('Marked as early days — there is not enough feedback to be sure yet.');
  }

  const lovesBlock =
    loves.length > 0
      ? [p.lovesHeading, ...loves.map((t) => bulletLine(t.label))].join('\n')
      : [p.lovesHeading, bulletLine(p.noPraiseYet)].join('\n');

  // The single most repeated issue leads, because that is the one thing an
  // owner can act on. Anything else worth naming follows it.
  const mainIssue = insight.topIssue;
  const others = dislikes.filter((theme) => theme.key !== mainIssue?.key);

  const issueBlock = mainIssue
    ? [
        p.mainIssueHeading,
        bulletLine(mainIssue.label, p.mentions(mainIssue.count)),
        ...(others.length > 0
          ? ['', p.dislikesHeading, ...others.map((t) => bulletLine(t.label, p.mentions(t.count)))]
          : []),
      ].join('\n')
    : [p.dislikesHeading, bulletLine(p.noIssuesYet)].join('\n');

  if (!mainIssue) {
    notes.push('No issue has been mentioned often enough to name as the main one.');
  }

  // The pulse engine writes the movement ("6 → 2 mentions") but not what
  // moved, because its own panel shows the theme label beside it. In a message
  // the owner reads on its own, a bare pair of numbers says nothing.
  const changesBlock =
    insight.changes.length > 0
      ? [
          p.changedHeading,
          ...insight.changes
            .slice(0, MAX_LISTED)
            .map((change) => bulletLine(change.label, change.note)),
        ].join('\n')
      : null;

  if (insight.changes.length === 0) {
    notes.push(`No period comparison yet — ${insight.comparisonNote}`);
  }

  // What the business already agreed to or did comes before the next
  // suggestion: an owner who changed something last month should be told what
  // happened before being handed another job.
  const { block: improvement, note: improvementNote } = actionBlock(insight.action, p);
  if (improvementNote) notes.push(improvementNote);

  const recommendBlock = insight.recommendation
    ? [p.recommendHeading, bulletLine(insight.recommendation.action)].join('\n')
    : null;

  if (!insight.recommendation) {
    notes.push('No next step suggested, because nothing is coming up often enough.');
  }

  // A forward-looking promise, never a claim that anything has improved. What
  // did or did not work is the action loop's question, not this milestone's.
  const closing = insight.recommendation
    ? p.willCheck(insight.recommendation.themeLabel)
    : null;

  const body = join([
    opening,
    caveat,
    lovesBlock,
    issueBlock,
    changesBlock,
    improvement,
    recommendBlock,
    closing,
    p.basedOn(insight.evidence.analysed),
  ]);

  return finish(
    'OWNER_UPDATE',
    COMMS_LABELS.OWNER_UPDATE,
    body,
    language,
    notes,
    insight,
    voice,
  );
}

/**
 * The recommended next step on its own.
 *
 * A suggestion, not a record. Nothing here marks anything as done, scheduled or
 * measured — that is the action loop (M11).
 */
export function composeActionMessage(
  insight: OwnerInsight,
  voice: EffectiveVoice,
): ComposedMessage {
  const language = ownerLanguage(voice);
  const p = PHRASES[language];
  const notes: string[] = [];

  if (!insight.recommendation) {
    notes.push('Nothing is coming up often enough to recommend a change yet.');
    return finish(
      'ACTION_MESSAGE',
      COMMS_LABELS.ACTION_MESSAGE,
      join([p.actionOpening(insight.businessName), p.noIssuesYet]),
      language,
      notes,
      insight,
      voice,
    );
  }

  const { action, themeLabel, mentions } = insight.recommendation;

  return finish(
    'ACTION_MESSAGE',
    COMMS_LABELS.ACTION_MESSAGE,
    join([
      p.actionOpening(insight.businessName),
      bulletLine(action),
      p.actionBecause(themeLabel, mentions),
    ]),
    language,
    notes,
    insight,
    voice,
  );
}

/**
 * The follow-up nudge.
 *
 * Asks whether they got to it. It deliberately does not say the step was taken
 * or that anything improved, because RepOS does not know either yet.
 */
export function composeFollowUp(
  insight: OwnerInsight,
  voice: EffectiveVoice,
): ComposedMessage {
  const language = ownerLanguage(voice);
  const p = PHRASES[language];
  const notes: string[] = [];

  const recorded = insight.recentlyDone[0];
  const recordedLine = recorded ? p.alreadyRecorded(recorded.title) : null;
  if (recorded) {
    notes.push('Mentions what you recorded, without claiming it worked — that comes later.');
  }

  if (!insight.recommendation) {
    notes.push('No open recommendation, so this is a plain check-in.');
    return finish(
      'FOLLOW_UP',
      COMMS_LABELS.FOLLOW_UP,
      join([p.followUpOpening(insight.businessName), recordedLine, p.followUpAsk]),
      language,
      notes,
      insight,
      voice,
    );
  }

  return finish(
    'FOLLOW_UP',
    COMMS_LABELS.FOLLOW_UP,
    join([
      p.followUpOpening(insight.businessName),
      recordedLine,
      [p.recommendHeading, bulletLine(insight.recommendation.action)].join('\n'),
      p.followUpAsk,
      p.willCheck(insight.recommendation.themeLabel),
    ]),
    language,
    notes,
    insight,
    voice,
  );
}

/** Every owner-facing message for a client, in one call. */
export function composeOwnerMessages(
  insight: OwnerInsight,
  voice: EffectiveVoice,
): ComposedMessage[] {
  return [
    composeOwnerUpdate(insight, voice),
    composeActionMessage(insight, voice),
    composeFollowUp(insight, voice),
  ];
}
