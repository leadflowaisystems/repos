import type { Namespace } from '../t';

/**
 * This week and This month reports (src/lib/reporting/service.ts)
 *
 * GENERATED SENTENCES. These are written by pure builder functions that are
 * handed a translator, never a locale — so a phrase here may be assembled from
 * placeholders the builder fills, and the placeholders must be identical in all
 * three languages. Word order is not: Hindi and Marathi put a total before its
 * count, which is exactly why these are whole sentences and not fragments.
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed.
 *
 * ONE SENTENCE PER PERIOD, WRITTEN TWICE. `buildPeriodReport` draws both the
 * week and the month, so every headline below exists as a `.week` and a
 * `.month` phrase rather than as one phrase with a "{period}" hole in it. The
 * hole falls in a different place in Hindi and Marathi than it does in English
 * — "इस हफ़्ते" opens the Hindi sentence where "this week" closes the English
 * one — so a period-shaped hole cannot be translated correctly. The same split
 * is already made in `pulse.ts` and `review.ts` for the pages themselves.
 *
 * {label} IS A THEME LABEL FROM THE PACK, and {count} and {min} are numbers the
 * engine computed. They are interpolated, never translated: a theme label is
 * data that arrives from packs/*.json, and a count an owner reads must be the
 * count Headway counted.
 */
export const period = {
  // -------------------------------------------------------------------------
  // The headline — the one honest sentence at the top of the report
  // -------------------------------------------------------------------------

  // Nothing arrived at all. Not a verdict on the business, just an empty week.
  'period.headline.none.week': {
    en: 'No new feedback this week.',
    hi: 'इस हफ़्ते कोई नया फ़ीडबैक नहीं आया।',
    mr: 'या आठवड्यात नवीन फीडबॅक आला नाही.',
  },
  'period.headline.none.month': {
    en: 'No new feedback this month.',
    hi: 'इस महीने कोई नया फ़ीडबैक नहीं आया।',
    mr: 'या महिन्यात नवीन फीडबॅक आला नाही.',
  },

  // Some feedback, but under the floor. "Yet" carries the whole sentence: this
  // says Headway cannot see a pattern, never that there is nothing there.
  'period.headline.thin.week': {
    en: 'Not enough new feedback this week to see a pattern yet.',
    hi: 'इस हफ़्ते अभी इतना नया फ़ीडबैक नहीं आया कि कोई पैटर्न दिख सके।',
    mr: 'या आठवड्यात पॅटर्न दिसण्याइतका नवीन फीडबॅक अजून आलेला नाही.',
  },
  'period.headline.thin.month': {
    en: 'Not enough new feedback this month to see a pattern yet.',
    hi: 'इस महीने अभी इतना नया फ़ीडबैक नहीं आया कि कोई पैटर्न दिख सके।',
    mr: 'या महिन्यात पॅटर्न दिसण्याइतका नवीन फीडबॅक अजून आलेला नाही.',
  },

  // Enough to read, but not enough on the other side to compare against. The
  // shortfall is named as the earlier window's, not as the owner's.
  'period.headline.incomparable.week.one': {
    en: '{count} feedback entry this week. The week before does not have enough to compare with.',
    hi: 'इस हफ़्ते {count} फ़ीडबैक। पिछले हफ़्ते में तुलना करने लायक़ इतना फ़ीडबैक नहीं है।',
    mr: 'या आठवड्यात {count} फीडबॅक. मागच्या आठवड्यात तुलना करण्याइतका फीडबॅक नाही.',
  },
  'period.headline.incomparable.week.other': {
    en: '{count} feedback entries this week. The week before does not have enough to compare with.',
    hi: 'इस हफ़्ते {count} फ़ीडबैक। पिछले हफ़्ते में तुलना करने लायक़ इतना फ़ीडबैक नहीं है।',
    mr: 'या आठवड्यात {count} फीडबॅक. मागच्या आठवड्यात तुलना करण्याइतका फीडबॅक नाही.',
  },
  'period.headline.incomparable.month.one': {
    en: '{count} feedback entry this month. The month before does not have enough to compare with.',
    hi: 'इस महीने {count} फ़ीडबैक। पिछले महीने में तुलना करने लायक़ इतना फ़ीडबैक नहीं है।',
    mr: 'या महिन्यात {count} फीडबॅक. मागच्या महिन्यात तुलना करण्याइतका फीडबॅक नाही.',
  },
  'period.headline.incomparable.month.other': {
    en: '{count} feedback entries this month. The month before does not have enough to compare with.',
    hi: 'इस महीने {count} फ़ीडबैक। पिछले महीने में तुलना करने लायक़ इतना फ़ीडबैक नहीं है।',
    mr: 'या महिन्यात {count} फीडबॅक. मागच्या महिन्यात तुलना करण्याइतका फीडबॅक नाही.',
  },

  // Comparable, and nothing moved far enough to report. "No major change" is
  // the honest reading of a movement under the floor — not "all is well".
  'period.headline.steady.week': {
    en: 'No major change this week.',
    hi: 'इस हफ़्ते कोई बड़ा बदलाव नहीं हुआ।',
    mr: 'या आठवड्यात मोठा बदल झाला नाही.',
  },
  'period.headline.steady.month': {
    en: 'No major change this month.',
    hi: 'इस महीने कोई बड़ा बदलाव नहीं हुआ।',
    mr: 'या महिन्यात मोठा बदल झाला नाही.',
  },

  // A count moved. The sentence reports how often the topic was mentioned and
  // stops there — it does not say the business got worse or better, because
  // counting mentions cannot show that.
  'period.headline.worsened.week': {
    en: '{label} came up more often this week.',
    hi: 'इस हफ़्ते {label} का ज़िक्र ज़्यादा बार हुआ।',
    mr: 'या आठवड्यात {label} चा उल्लेख जास्त वेळा झाला.',
  },
  'period.headline.worsened.month': {
    en: '{label} came up more often this month.',
    hi: 'इस महीने {label} का ज़िक्र ज़्यादा बार हुआ।',
    mr: 'या महिन्यात {label} चा उल्लेख जास्त वेळा झाला.',
  },
  'period.headline.improved.week': {
    en: '{label} came up less often this week.',
    hi: 'इस हफ़्ते {label} का ज़िक्र कम बार हुआ।',
    mr: 'या आठवड्यात {label} चा उल्लेख कमी वेळा झाला.',
  },
  'period.headline.improved.month': {
    en: '{label} came up less often this month.',
    hi: 'इस महीने {label} का ज़िक्र कम बार हुआ।',
    mr: 'या महिन्यात {label} चा उल्लेख कमी वेळा झाला.',
  },

  // -------------------------------------------------------------------------
  // What this report cannot tell them — always stated, never hidden
  // -------------------------------------------------------------------------

  'period.limit.noFeedback': {
    en: 'No feedback arrived, so there is nothing to compare.',
    hi: 'कोई फ़ीडबैक नहीं आया, इसलिए तुलना करने के लिए कुछ नहीं है।',
    mr: 'कोणताही फीडबॅक आला नाही, त्यामुळे तुलना करण्यासारखं काही नाही.',
  },

  // The bar stays inside the sentence, with the number the engine actually
  // uses. An owner is entitled to know what would have to happen for Headway
  // to name a problem, not only that it did not name one.
  'period.limit.thin.one': {
    en: '{count} feedback entry arrived. Headway names a problem once at least {min} customers have mentioned it.',
    hi: '{count} फ़ीडबैक आया। Headway किसी समस्या का नाम तभी लेता है जब कम से कम {min} ग्राहक उसका ज़िक्र कर चुके हों।',
    mr: '{count} फीडबॅक आला. Headway एखाद्या अडचणीचं नाव तेव्हाच घेतो जेव्हा किमान {min} ग्राहकांनी तिचा उल्लेख केलेला असतो.',
  },
  'period.limit.thin.other': {
    en: '{count} feedback entries arrived. Headway names a problem once at least {min} customers have mentioned it.',
    hi: '{count} फ़ीडबैक आए। Headway किसी समस्या का नाम तभी लेता है जब कम से कम {min} ग्राहक उसका ज़िक्र कर चुके हों।',
    mr: '{count} फीडबॅक आले. Headway एखाद्या अडचणीचं नाव तेव्हाच घेतो जेव्हा किमान {min} ग्राहकांनी तिचा उल्लेख केलेला असतो.',
  },

  // {count} is the EARLIER window's feedback and {min} is the floor for
  // comparing at all. Two different numbers in one sentence, so each is named
  // by what it counts rather than left to be told apart by position.
  'period.limit.incomparable.week.one': {
    en: 'The week before has {count} feedback entry. Headway needs at least {min} to compare fairly.',
    hi: 'पिछले हफ़्ते में {count} फ़ीडबैक है। सही तरीक़े से तुलना करने के लिए Headway को कम से कम {min} चाहिए।',
    mr: 'मागच्या आठवड्यात {count} फीडबॅक आहे. योग्य तुलना करण्यासाठी Headway ला किमान {min} लागतात.',
  },
  'period.limit.incomparable.week.other': {
    en: 'The week before has {count} feedback entries. Headway needs at least {min} to compare fairly.',
    hi: 'पिछले हफ़्ते में {count} फ़ीडबैक हैं। सही तरीक़े से तुलना करने के लिए Headway को कम से कम {min} चाहिए।',
    mr: 'मागच्या आठवड्यात {count} फीडबॅक आहेत. योग्य तुलना करण्यासाठी Headway ला किमान {min} लागतात.',
  },
  'period.limit.incomparable.month.one': {
    en: 'The month before has {count} feedback entry. Headway needs at least {min} to compare fairly.',
    hi: 'पिछले महीने में {count} फ़ीडबैक है। सही तरीक़े से तुलना करने के लिए Headway को कम से कम {min} चाहिए।',
    mr: 'मागच्या महिन्यात {count} फीडबॅक आहे. योग्य तुलना करण्यासाठी Headway ला किमान {min} लागतात.',
  },
  'period.limit.incomparable.month.other': {
    en: 'The month before has {count} feedback entries. Headway needs at least {min} to compare fairly.',
    hi: 'पिछले महीने में {count} फ़ीडबैक हैं। सही तरीक़े से तुलना करने के लिए Headway को कम से कम {min} चाहिए।',
    mr: 'मागच्या महिन्यात {count} फीडबॅक आहेत. योग्य तुलना करण्यासाठी Headway ला किमान {min} लागतात.',
  },

  // THE VOLUME CAVEAT, and it must not soften in translation. It says that
  // part of the movement is how MUCH feedback arrived rather than what
  // customers said — a statement about what this comparison cannot separate,
  // not a hedge and not an apology. Wording like "the change may be smaller
  // than it looks" would be claiming something Headway never measured.
  'period.limit.volume': {
    en: 'Much more or much less feedback arrived than last time. So part of this change is the amount of feedback, not what customers said.',
    hi: 'पिछली बार से बहुत ज़्यादा या बहुत कम फ़ीडबैक आया है। इसलिए इस बदलाव का कुछ हिस्सा फ़ीडबैक की मात्रा है, ग्राहकों ने जो कहा वह नहीं।',
    mr: 'मागच्या वेळेपेक्षा खूप जास्त किंवा खूप कमी फीडबॅक आला आहे. त्यामुळे या बदलाचा काही भाग हा फीडबॅकच्या प्रमाणामुळे आहे, ग्राहकांनी काय म्हटलं त्यामुळे नाही.',
  },
} satisfies Namespace;
