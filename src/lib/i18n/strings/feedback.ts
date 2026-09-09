import type { Namespace } from '../t';

/**
 * Feedback (route: reviews) — the feedback list, counts and filters
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 *
 * ONE COUNTED NOUN ON THIS PAGE: a "feedback entry". The screen used to switch
 * between "pieces of feedback", "comments" and "feedback" for the same rows,
 * which left an owner working out whether three things were being counted or
 * one. Hindi and Marathi carry the plural on the number, not on the noun —
 * "90 फ़ीडबैक", never a pluralised फ़ीडबैक — so both plural forms are written
 * the same way there on purpose.
 *
 * WHOLE SENTENCES, NOT FRAGMENTS. "Showing {shown} of {total} …" is one key
 * with two placeholders rather than three pieces glued together, because the
 * word order that works in English puts the numbers somewhere else in Marathi.
 */
export const feedback = {
  // -------------------------------------------------------------------------
  // The top of the page
  // -------------------------------------------------------------------------
  'feedback.intro.eyebrow': {
    en: 'Feedback',
    hi: 'फ़ीडबैक',
    mr: 'फीडबॅक',
  },
  'feedback.intro.title': {
    en: 'What your customers wrote',
    hi: 'आपके ग्राहकों ने क्या लिखा',
    mr: 'तुमच्या ग्राहकांनी काय लिहिलं',
  },
  'feedback.intro.empty': {
    en: 'No feedback yet. It starts coming in when customers scan your QR code.',
    hi: 'अभी तक कोई फ़ीडबैक नहीं आया है। ग्राहक आपका QR कोड स्कैन करेंगे, तब फ़ीडबैक आना शुरू होगा।',
    mr: 'अजून कोणताही फीडबॅक आलेला नाही. ग्राहक तुमचा QR कोड स्कॅन करतील तेव्हा फीडबॅक येऊ लागेल.',
  },
  'feedback.intro.reading': {
    en: 'Feedback has come in. Headway is reading it now. This usually takes less than a minute. Reload the page to see what it found.',
    hi: 'फ़ीडबैक आ गया है। हेडवे उसे अभी पढ़ रहा है। इसमें आम तौर पर एक मिनट से कम लगता है। हेडवे को क्या मिला, यह देखने के लिए पेज दोबारा लोड करें।',
    mr: 'फीडबॅक आला आहे. हेडवे तो आत्ता वाचत आहे. यासाठी सहसा एका मिनिटापेक्षा कमी वेळ लागतो. हेडवेला काय आढळलं ते पाहण्यासाठी पेज पुन्हा लोड करा.',
  },
  'feedback.intro.ready': {
    en: 'Next to each one you can see what Headway found in it.',
    hi: 'हर फ़ीडबैक के बगल में आप देख सकते हैं कि हेडवे को उसमें क्या मिला।',
    mr: 'प्रत्येक फीडबॅकच्या बाजूला हेडवेला त्यात काय आढळलं ते तुम्ही पाहू शकता.',
  },

  // -------------------------------------------------------------------------
  // The funnel: everything read → the patterns → the one-offs → what needs
  // attention. Each label sits under its own big number, so the count is never
  // written into the phrase.
  // -------------------------------------------------------------------------
  'feedback.funnel.aria': {
    en: 'How Headway read this feedback',
    hi: 'हेडवे ने यह फ़ीडबैक कैसे पढ़ा',
    mr: 'हेडवेने हा फीडबॅक कसा वाचला',
  },
  'feedback.funnel.read.one': {
    en: 'feedback entry read',
    hi: 'फ़ीडबैक पढ़ा गया',
    mr: 'फीडबॅक वाचला',
  },
  'feedback.funnel.read.other': {
    en: 'feedback entries read',
    hi: 'फ़ीडबैक पढ़े गए',
    mr: 'फीडबॅक वाचले',
  },
  'feedback.funnel.pattern.one': {
    en: 'pattern',
    hi: 'बार-बार आई बात',
    mr: 'वारंवार आलेली गोष्ट',
  },
  'feedback.funnel.pattern.other': {
    en: 'patterns',
    hi: 'बार-बार आई बातें',
    mr: 'वारंवार आलेल्या गोष्टी',
  },
  'feedback.funnel.isolated.one': {
    en: 'topic mentioned once or twice',
    hi: 'बात जिसका एक-दो बार ज़िक्र हुआ',
    mr: 'एक-दोनदा उल्लेख झालेली गोष्ट',
  },
  'feedback.funnel.isolated.other': {
    en: 'topics mentioned once or twice',
    hi: 'बातें जिनका एक-दो बार ज़िक्र हुआ',
    mr: 'एक-दोनदा उल्लेख झालेल्या गोष्टी',
  },
  'feedback.funnel.attention': {
    en: 'needs attention · {topic}',
    hi: 'ध्यान देने की ज़रूरत · {topic}',
    mr: 'लक्ष देण्याची गरज · {topic}',
  },
  'feedback.funnel.attentionNone': {
    en: 'need attention',
    hi: 'ध्यान देने की ज़रूरत',
    mr: 'लक्ष देण्याची गरज',
  },

  // -------------------------------------------------------------------------
  // The counts strip
  // -------------------------------------------------------------------------
  'feedback.status.collected': {
    en: 'collected',
    hi: 'जमा हुए',
    mr: 'जमा झाले',
  },
  'feedback.status.read': {
    en: 'read by Headway',
    hi: 'हेडवे ने पढ़े',
    mr: 'हेडवेने वाचले',
  },
  'feedback.status.reading': {
    en: 'being read now',
    hi: 'अभी पढ़े जा रहे हैं',
    mr: 'आत्ता वाचले जात आहेत',
  },
  'feedback.status.failed': {
    en: 'could not be read yet',
    hi: 'अभी तक पढ़े नहीं जा सके',
    mr: 'अजून वाचता आले नाहीत',
  },
  'feedback.status.average.one': {
    en: 'average of {count} rating',
    hi: '{count} रेटिंग का औसत',
    mr: '{count} रेटिंगची सरासरी',
  },
  'feedback.status.average.other': {
    en: 'average of {count} ratings',
    hi: '{count} रेटिंग का औसत',
    mr: '{count} रेटिंगची सरासरी',
  },

  // -------------------------------------------------------------------------
  // The patterns, as one-tap filters
  // -------------------------------------------------------------------------
  'feedback.signals.heading': {
    en: 'What keeps coming up · tap one to read that feedback',
    hi: 'बार-बार क्या आ रहा है · वह फ़ीडबैक पढ़ने के लिए किसी एक पर टैप करें',
    mr: 'वारंवार काय येत आहे · तो फीडबॅक वाचण्यासाठी एकावर टॅप करा',
  },

  // -------------------------------------------------------------------------
  // What Headway found, and the two charts behind it
  // -------------------------------------------------------------------------
  'feedback.found.summary': {
    en: 'What Headway found',
    hi: 'हेडवे को क्या मिला',
    mr: 'हेडवेला काय आढळलं',
  },
  'feedback.found.byRating': {
    en: 'By rating · {count} gave a rating',
    hi: 'रेटिंग के हिसाब से · {count} ने रेटिंग दी',
    mr: 'रेटिंगनुसार · {count} जणांनी रेटिंग दिली',
  },
  'feedback.found.byTone': {
    en: 'By tone · all {count} read by Headway',
    hi: 'टोन के हिसाब से · हेडवे ने पढ़े गए सभी {count}',
    mr: 'टोननुसार · हेडवेने वाचलेले सर्व {count}',
  },

  // -------------------------------------------------------------------------
  // Search and filter
  // -------------------------------------------------------------------------
  'feedback.filter.summary': {
    en: 'Search and filter',
    hi: 'खोजें और फ़िल्टर करें',
    mr: 'शोधा आणि फिल्टर करा',
  },
  'feedback.filter.search': {
    en: 'Search',
    hi: 'खोजें',
    mr: 'शोधा',
  },
  'feedback.filter.searchPlaceholder': {
    en: 'A word customers used',
    hi: 'ग्राहकों ने इस्तेमाल किया कोई शब्द',
    mr: 'ग्राहकांनी वापरलेला एखादा शब्द',
  },
  'feedback.filter.about': {
    en: 'About',
    hi: 'किस बारे में',
    mr: 'कशाबद्दल',
  },
  'feedback.filter.anything': {
    en: 'Anything',
    hi: 'कुछ भी',
    mr: 'काहीही',
  },
  'feedback.filter.complaints': {
    en: 'Complaints',
    hi: 'शिकायतें',
    mr: 'तक्रारी',
  },
  'feedback.filter.praise': {
    en: 'Praise',
    hi: 'तारीफ़',
    mr: 'कौतुक',
  },
  'feedback.filter.rating': {
    en: 'Rating',
    hi: 'रेटिंग',
    mr: 'रेटिंग',
  },
  'feedback.filter.any': {
    en: 'Any',
    hi: 'कोई भी',
    mr: 'कोणतीही',
  },
  'feedback.filter.stars.one': {
    en: '{count} star',
    hi: '{count} स्टार',
    mr: '{count} स्टार',
  },
  'feedback.filter.stars.other': {
    en: '{count} stars',
    hi: '{count} स्टार',
    mr: '{count} स्टार',
  },
  'feedback.filter.tone': {
    en: 'Tone',
    hi: 'टोन',
    mr: 'टोन',
  },
  'feedback.filter.from': {
    en: 'From',
    hi: 'कहाँ से',
    mr: 'कुठून',
  },
  'feedback.filter.anywhere': {
    en: 'Anywhere',
    hi: 'कहीं से भी',
    mr: 'कुठूनही',
  },
  'feedback.filter.needsReply': {
    en: 'Only ones that need your answer',
    hi: 'सिर्फ़ वे जिनका जवाब आपको देना है',
    mr: 'फक्त ज्यांना तुमचं उत्तर द्यायचं आहे ते',
  },
  'feedback.filter.show': {
    en: 'Show',
    hi: 'दिखाएँ',
    mr: 'दाखवा',
  },
  'feedback.filter.clear': {
    en: 'Clear filters',
    hi: 'फ़िल्टर हटाएँ',
    mr: 'फिल्टर काढा',
  },

  // -------------------------------------------------------------------------
  // Tone. The same four words the rows themselves carry, so the filter and the
  // row can never disagree about what a feedback entry was.
  // -------------------------------------------------------------------------
  'feedback.tone.positive': {
    en: 'Positive',
    hi: 'सकारात्मक',
    mr: 'सकारात्मक',
  },
  'feedback.tone.mixed': {
    en: 'Mixed',
    hi: 'मिला-जुला',
    mr: 'संमिश्र',
  },
  'feedback.tone.neutral': {
    en: 'Neutral',
    hi: 'सामान्य',
    mr: 'सामान्य',
  },
  'feedback.tone.negative': {
    en: 'Negative',
    hi: 'नकारात्मक',
    mr: 'नकारात्मक',
  },

  // -------------------------------------------------------------------------
  // The list itself
  // -------------------------------------------------------------------------
  'feedback.empty.body': {
    en: 'Every feedback entry appears here exactly as the customer wrote it, next to what Headway found in it.',
    hi: 'हर फ़ीडबैक यहाँ ठीक वैसे ही दिखता है जैसे ग्राहक ने लिखा था, और उसके बगल में हेडवे को उसमें क्या मिला, यह दिखता है।',
    mr: 'प्रत्येक फीडबॅक इथे ग्राहकाने जसा लिहिला अगदी तसाच दिसतो, आणि त्याच्या बाजूला हेडवेला त्यात काय आढळलं ते दिसतं.',
  },
  'feedback.evidence.eyebrow': {
    en: 'What Headway based this on',
    hi: 'हेडवे ने यह किस आधार पर कहा',
    mr: 'हेडवेने हे कशाच्या आधारावर सांगितलं',
  },
  'feedback.evidence.title': {
    en: 'Feedback about {topic}',
    hi: '{topic} के बारे में फ़ीडबैक',
    mr: '{topic} बद्दल फीडबॅक',
  },
  'feedback.evidence.count.one': {
    en: '{count} feedback entry.',
    hi: '{count} फ़ीडबैक।',
    mr: '{count} फीडबॅक.',
  },
  'feedback.evidence.count.other': {
    en: '{count} feedback entries.',
    hi: '{count} फ़ीडबैक।',
    mr: '{count} फीडबॅक.',
  },
  'feedback.evidence.clearest.one': {
    en: 'The clearest one is first.',
    hi: 'सबसे साफ़ बात वाला सबसे ऊपर है।',
    mr: 'सर्वात स्पष्ट असलेला सर्वात वर आहे.',
  },
  'feedback.evidence.clearest.other': {
    en: 'The clearest ones are first.',
    hi: 'सबसे साफ़ बात वाले सबसे ऊपर हैं।',
    mr: 'सर्वात स्पष्ट असलेले सर्वात वर आहेत.',
  },
  'feedback.list.count.one': {
    en: '{count} feedback entry',
    hi: '{count} फ़ीडबैक',
    mr: '{count} फीडबॅक',
  },
  'feedback.list.count.other': {
    en: '{count} feedback entries',
    hi: '{count} फ़ीडबैक',
    mr: '{count} फीडबॅक',
  },
  'feedback.list.noMatch': {
    en: 'Nothing matches your filters.',
    hi: 'आपके फ़िल्टर से कुछ भी मेल नहीं खाता।',
    mr: 'तुमच्या फिल्टरशी काहीही जुळत नाही.',
  },
  'feedback.list.clearAll': {
    en: 'Clear the filters to see everything.',
    hi: 'सब कुछ देखने के लिए फ़िल्टर हटाएँ।',
    mr: 'सर्व काही पाहण्यासाठी फिल्टर काढा.',
  },
  'feedback.list.showingAbout': {
    en: 'Showing {shown} of {total} feedback entries about this.',
    hi: 'इस बारे में {total} में से {shown} फ़ीडबैक दिखाए जा रहे हैं।',
    mr: 'याबद्दलच्या {total} पैकी {shown} फीडबॅक दाखवले जात आहेत.',
  },
  'feedback.list.showAll': {
    en: 'Show all {count}',
    hi: 'सभी {count} दिखाएँ',
    mr: 'सर्व {count} दाखवा',
  },
  'feedback.list.showing': {
    en: 'Showing {shown} of {total} feedback entries.',
    hi: '{total} में से {shown} फ़ीडबैक दिखाए जा रहे हैं।',
    mr: '{total} पैकी {shown} फीडबॅक दाखवले जात आहेत.',
  },
  'feedback.list.showMore': {
    en: 'Show more',
    hi: 'और दिखाएँ',
    mr: 'आणखी दाखवा',
  },
  'feedback.list.end.one': {
    en: 'That is the only feedback entry.',
    hi: 'बस यही एक फ़ीडबैक है।',
    mr: 'हाच एकमेव फीडबॅक आहे.',
  },
  'feedback.list.end.other': {
    en: 'That is all {count} feedback entries.',
    hi: 'बस इतने ही — कुल {count} फ़ीडबैक।',
    mr: 'एवढेच — एकूण {count} फीडबॅक.',
  },
} satisfies Namespace;
