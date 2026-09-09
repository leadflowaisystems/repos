/**
 * THE SHARED GLOSSARY.
 *
 * The words Headway has settled on, in all three languages. Its job is to stop
 * drift: without it, one page says "issue", the next says "problem", a third
 * says "concern", and the Hindi for all three is different again. An owner then
 * has to work out whether the portal is talking about one thing or three.
 *
 * ONE ENGLISH WORD PER IDEA, ONE HINDI WORD, ONE MARATHI WORD. Where two
 * English words mean the same thing to an owner ("issue" and "problem"), the
 * glossary picks one and the other stops being used.
 *
 * ENGLISH WORDS IN DEVANAGARI ARE OFTEN THE RIGHT ANSWER. A shop owner in Pune
 * says "फीडबॅक", not a Sanskritised coinage nobody uses out loud, and says
 * "रेटिंग" and "ट्रायल" too. Translating those into textbook vocabulary would be
 * accurate and unreadable, which is the opposite of the point. Where the
 * borrowed word is what people actually say, the glossary keeps it.
 */

export type GlossaryEntry = {
  en: string;
  hi: string;
  mr: string;
  /** Why this word and not the obvious alternative. */
  note?: string;
};

export const GLOSSARY: readonly GlossaryEntry[] = [
  // --- the things themselves ------------------------------------------------
  {
    en: 'feedback',
    hi: 'फ़ीडबैक',
    mr: 'फीडबॅक',
    note: 'What owners actually say. A native coinage would be correct and unread.',
  },
  {
    en: 'feedback entry',
    hi: 'फ़ीडबैक',
    mr: 'फीडबॅक',
    note: 'Counted as "90 फ़ीडबैक" — the counter carries the plural, the noun does not.',
  },
  { en: 'customer', hi: 'ग्राहक', mr: 'ग्राहक' },
  {
    en: 'review',
    hi: 'रिव्यू',
    mr: 'रिव्ह्यू',
    note: 'A public Google review specifically, never the private feedback. The two must stay separate words in every language.',
  },
  { en: 'rating', hi: 'रेटिंग', mr: 'रेटिंग' },
  { en: 'star', hi: 'स्टार', mr: 'स्टार' },

  // --- good and bad ---------------------------------------------------------
  {
    en: 'problem',
    hi: 'समस्या',
    mr: 'अडचण',
    note: 'The single word for a bad thing. "Issue", "concern" and "pain point" are not used.',
  },
  { en: 'main problem', hi: 'मुख्य समस्या', mr: 'मुख्य अडचण' },
  {
    en: 'what customers like',
    hi: 'ग्राहकों को क्या पसंद है',
    mr: 'ग्राहकांना काय आवडतं',
  },
  {
    en: 'what customers complain about',
    hi: 'ग्राहक किस बात की शिकायत करते हैं',
    mr: 'ग्राहक कशाबद्दल तक्रार करतात',
  },
  { en: 'praised', hi: 'तारीफ़ की', mr: 'कौतुक केलं' },
  { en: 'mentioned', hi: 'ज़िक्र किया', mr: 'उल्लेख केला' },
  { en: 'what went well', hi: 'क्या अच्छा रहा', mr: 'काय चांगलं झालं' },
  {
    en: 'what could be better',
    hi: 'क्या बेहतर हो सकता है',
    mr: 'काय अजून चांगलं होऊ शकतं',
  },

  // --- direction ------------------------------------------------------------
  { en: 'better', hi: 'बेहतर', mr: 'चांगलं' },
  { en: 'worse', hi: 'ख़राब', mr: 'वाईट' },
  { en: 'getting better', hi: 'सुधर रहा है', mr: 'सुधारत आहे' },
  { en: 'getting worse', hi: 'बिगड़ रहा है', mr: 'बिघडत आहे' },
  { en: 'more often', hi: 'ज़्यादा बार', mr: 'जास्त वेळा' },
  { en: 'less often', hi: 'कम बार', mr: 'कमी वेळा' },
  { en: 'about the same', hi: 'लगभग वैसा ही', mr: 'साधारण तसंच' },
  { en: 'going well', hi: 'अच्छा चल रहा है', mr: 'चांगलं चाललं आहे' },

  // --- doing something about it --------------------------------------------
  { en: 'what to do', hi: 'क्या करना है', mr: 'काय करायचं' },
  { en: 'change', hi: 'बदलाव', mr: 'बदल' },
  { en: 'improvement', hi: 'सुधार', mr: 'सुधारणा' },
  { en: 'before', hi: 'पहले', mr: 'आधी' },
  { en: 'after', hi: 'बाद में', mr: 'नंतर' },
  { en: 'check-in', hi: 'चेक-इन', mr: 'चेक-इन' },

  // --- the service ----------------------------------------------------------
  { en: 'account', hi: 'अकाउंट', mr: 'अकाउंट' },
  { en: 'team', hi: 'टीम', mr: 'टीम' },
  { en: 'print kit', hi: 'प्रिंट किट', mr: 'प्रिंट किट' },
  { en: 'trial', hi: 'ट्रायल', mr: 'ट्रायल' },
  { en: 'paused', hi: 'रोका गया है', mr: 'थांबवलं आहे' },
  { en: 'request received', hi: 'आपकी रिक्वेस्ट मिल गई है', mr: 'तुमची विनंती मिळाली आहे' },
  {
    en: 'ask to continue',
    hi: 'आगे जारी रखने के लिए कहें',
    mr: 'पुढे सुरू ठेवण्यासाठी सांगा',
  },
] as const;

/**
 * THIS LIST APPLIES TO HEADWAY'S OWN WORDS, NEVER TO A CUSTOMER'S.
 *
 * A customer wrote "nearly an hour for the mains". "Mains" is on the banned
 * list below, and rewriting it to "main course" in a quote was caught by
 * tests/m26.marketing-site.test.ts, which pins every quoted sentence to the
 * dataset record it came from. That test is right and the rewrite was wrong:
 * a quote is evidence. Editing it — however small the improvement, however
 * banned the word — turns a thing a customer said into a thing Headway said
 * they said. Plain English is a rule for Headway's voice only.
 */

/**
 * English words and phrases that must not appear in owner-facing text.
 *
 * Two kinds. The first is jargon an owner should never have to decode. The
 * second, and the reason this list exists at all, is INDIRECTION: saying a
 * plain thing the long way round. "Customers are not unhappy about your food"
 * is six words spent avoiding "Customers like your food", and it is the single
 * habit this pass was written to remove.
 *
 * Checked by tests/m31.plain-english.test.ts against every English phrase in
 * the dictionary.
 */
export const BANNED_IN_OWNER_TEXT: readonly string[] = [
  // jargon
  'sentiment',
  'intervention',
  'recurring signal',
  'operational',
  'qualitative',
  'quantitative',
  'customer intelligence',
  'optimization',
  'optimisation',
  'remediation',
  'cadence',
  'taxonomy',
  'utilise',
  'leverage',
  'granular',
  'actionable',
  'stakeholder',
  // indirection
  'not unhappy',
  'not unfavorable',
  'not unfavourable',
  'not dissatisfied',
  'requires attention',
  'worth your attention',
  // hedging that reads as a machine talking
  'indicate that',
  'suggests that',
  'it appears that',
  // words that mean something else to a restaurant owner
  'mains',
] as const;

/** The one English word Headway uses, given a word it no longer uses. */
export const PREFERRED_INSTEAD: Readonly<Record<string, string>> = {
  issue: 'problem',
  concern: 'problem',
  'pain point': 'problem',
  insight: 'what Headway found',
  metric: 'number',
  'data point': 'feedback entry',
  utilise: 'use',
  purchase: 'buy',
  commence: 'start',
  'in order to': 'to',
  'at this time': 'now',
  'piece of feedback': 'feedback entry',
  'pieces of feedback': 'feedback entries',
};
