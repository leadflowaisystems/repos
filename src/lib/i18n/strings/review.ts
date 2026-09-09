import type { Namespace } from '../t';

/**
 * This month
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 *
 * ONLY THE SENTENCES THAT NAME THE MONTH LIVE HERE. One component draws both
 * period pages, so everything the month page says that a week page would say
 * the same way is in `pulse.ts` under `pulse.report.*`. What is written twice
 * is written twice on purpose: a sentence with a "{period}" hole in it puts the
 * hole in the wrong place in Hindi and Marathi.
 *
 * "Review" here is the code name for the monthly report. To an owner a review
 * is a public Google review and nothing else, so no phrase in this file uses
 * the word.
 */
export const review = {
  'review.title': {
    en: 'This month',
    hi: 'इस महीने',
    mr: 'या महिन्यात',
  },
  'review.volume.one': {
    en: '{count} feedback entry this month · {previous} the month before',
    hi: 'इस महीने {count} फ़ीडबैक · पिछले महीने {previous}',
    mr: 'या महिन्यात {count} फीडबॅक · मागच्या महिन्यात {previous}',
  },
  'review.volume.other': {
    en: '{count} feedback entries this month · {previous} the month before',
    hi: 'इस महीने {count} फ़ीडबैक · पिछले महीने {previous}',
    mr: 'या महिन्यात {count} फीडबॅक · मागच्या महिन्यात {previous}',
  },
  // Thin evidence, not a quiet month — so the bar stays in the sentence. The
  // number is the one the engine uses to decide whether to name a topic.
  'review.topics.none': {
    en: 'Nothing came up 3 or more times this month. Once something does, Headway will name it here.',
    hi: 'इस महीने कोई भी बात 3 या उससे ज़्यादा बार सामने नहीं आई। जब कोई बात इतनी बार आएगी, हेडवे उसका नाम यहाँ लिखेगा।',
    mr: 'या महिन्यात कोणतीही गोष्ट 3 किंवा जास्त वेळा समोर आली नाही. जेव्हा एखादी गोष्ट इतक्या वेळा येईल, तेव्हा हेडवे तिचं नाव इथे लिहील.',
  },
  // On the month page the changes are behind the owner; on the week page they
  // are still running. Two headings, not one heading with a hole in it.
  'review.actions.eyebrow': {
    en: 'Changes you made',
    hi: 'आपने जो बदलाव किए',
    mr: 'तुम्ही केलेले बदल',
  },
  // The month page only. This list is "mentioned in both months and no less
  // often", so the words have to cover steady as well as rising and judge
  // neither. It does not know whether the owner fixed anything.
  'review.unresolved.note': {
    en: 'Customers mentioned these this month and the month before, just as often or more often.',
    hi: 'इन बातों का ज़िक्र ग्राहकों ने इस महीने भी किया और पिछले महीने भी — उतनी ही बार या उससे ज़्यादा बार।',
    mr: 'या गोष्टींचा उल्लेख ग्राहकांनी या महिन्यात आणि मागच्या महिन्यातही केला — तितक्याच वेळा किंवा त्याहून जास्त वेळा.',
  },
} satisfies Namespace;
