import type { Namespace } from '../t';

/**
 * The readings and limits behind every count (src/lib/intelligence/engine.ts)
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
 * TWO COUNTS IN ONE SENTENCE. Several sentences here inflect on two different
 * numbers at once — how many customers mentioned a theme, and how much feedback
 * has been read. `t.plural` carries one of them, so the other is spelled into
 * the key itself as `.single` / `.many` before the `.one` / `.other` the
 * translator appends. The alternative — cutting "12 feedback entries" out as
 * its own phrase and gluing it in — is the fragment concatenation these
 * dictionaries exist to prevent, because Hindi and Marathi put the total first.
 *
 * THE CAVEATS ARE NOT DECORATION. "Some of this movement is just more feedback,
 * not a change in what customers think" is the sentence that keeps a count from
 * being read as a verdict. It is translated as carefully as any claim, and it
 * says the same thing in all three languages: no weakening, and never a cause.
 */
export const intelligence = {
  // -------------------------------------------------------------------------
  // How much has been read, and what that is worth
  // -------------------------------------------------------------------------
  'intelligence.evidence.standard.one': {
    en: 'Based on {count} feedback entry. That is enough to be confident about what keeps coming up.',
    hi: '{count} फ़ीडबैक के आधार पर। जो बार-बार आ रहा है, उसके बारे में भरोसे से कहने के लिए यह काफ़ी है।',
    mr: '{count} फीडबॅकच्या आधारे. जे वारंवार येत आहे त्याबद्दल खात्रीने सांगण्यासाठी हे पुरेसं आहे.',
  },
  'intelligence.evidence.standard.other': {
    en: 'Based on {count} feedback entries. That is enough to be confident about what keeps coming up.',
    hi: '{count} फ़ीडबैक के आधार पर। जो बार-बार आ रहा है, उसके बारे में भरोसे से कहने के लिए यह काफ़ी है।',
    mr: '{count} फीडबॅकच्या आधारे. जे वारंवार येत आहे त्याबद्दल खात्रीने सांगण्यासाठी हे पुरेसं आहे.',
  },
  'intelligence.evidence.limited.one': {
    en: 'Based on {count} feedback entry. That is enough to spot patterns, but not enough to be sure of them yet.',
    hi: '{count} फ़ीडबैक के आधार पर। पैटर्न दिखने के लिए यह काफ़ी है, पर उन पर पक्का भरोसा करने के लिए अभी काफ़ी नहीं।',
    mr: '{count} फीडबॅकच्या आधारे. पॅटर्न दिसण्यासाठी हे पुरेसं आहे, पण त्यांबद्दल खात्री बाळगण्यासाठी अजून पुरेसं नाही.',
  },
  'intelligence.evidence.limited.other': {
    en: 'Based on {count} feedback entries. That is enough to spot patterns, but not enough to be sure of them yet.',
    hi: '{count} फ़ीडबैक के आधार पर। पैटर्न दिखने के लिए यह काफ़ी है, पर उन पर पक्का भरोसा करने के लिए अभी काफ़ी नहीं।',
    mr: '{count} फीडबॅकच्या आधारे. पॅटर्न दिसण्यासाठी हे पुरेसं आहे, पण त्यांबद्दल खात्री बाळगण्यासाठी अजून पुरेसं नाही.',
  },
  'intelligence.evidence.none': {
    en: 'No feedback has been read yet, so there is nothing to report.',
    hi: 'अभी तक कोई फ़ीडबैक पढ़ा नहीं गया है, इसलिए बताने के लिए कुछ नहीं है।',
    mr: 'अजून कोणताही फीडबॅक वाचला गेलेला नाही, त्यामुळे सांगण्यासारखं काहीच नाही.',
  },
  'intelligence.evidence.thin.one': {
    en: 'Only {count} feedback entry so far. That is too few to draw any conclusion.',
    hi: 'अभी तक सिर्फ़ {count} फ़ीडबैक। कोई नतीजा निकालने के लिए यह बहुत कम है।',
    mr: 'आतापर्यंत फक्त {count} फीडबॅक. कोणताही निष्कर्ष काढण्यासाठी हे फारच कमी आहे.',
  },
  'intelligence.evidence.thin.other': {
    en: 'Only {count} feedback entries so far. That is too few to draw any conclusion.',
    hi: 'अभी तक सिर्फ़ {count} फ़ीडबैक। कोई नतीजा निकालने के लिए यह बहुत कम है।',
    mr: 'आतापर्यंत फक्त {count} फीडबॅक. कोणताही निष्कर्ष काढण्यासाठी हे फारच कमी आहे.',
  },

  /** Says which pile a count is over, so it is never read as a period. */
  'intelligence.evidence.scope.one': {
    en: 'across {count} feedback entry read so far',
    hi: 'अब तक पढ़े गए {count} फ़ीडबैक में',
    mr: 'आतापर्यंत वाचलेल्या {count} फीडबॅकमध्ये',
  },
  'intelligence.evidence.scope.other': {
    en: 'across {count} feedback entries read so far',
    hi: 'अब तक पढ़े गए {count} फ़ीडबैक में',
    mr: 'आतापर्यंत वाचलेल्या {count} फीडबॅकमध्ये',
  },

  // -------------------------------------------------------------------------
  // How much a single theme's count is worth
  //
  // `{count}` is how many entries mention the theme, `{total}` how many have
  // been read. `.single` / `.many` is the total's own inflection.
  // -------------------------------------------------------------------------
  'intelligence.confidence.strong.many.one': {
    en: '{count} of {total} feedback entries read so far mentions this. That is often enough to act on.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में से {count} में इसका ज़िक्र है। इस पर कदम उठाने के लिए आम तौर पर यह काफ़ी होता है।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे. यावर पाऊल उचलण्यासाठी हे बहुतेकदा पुरेसं असतं.',
  },
  'intelligence.confidence.strong.many.other': {
    en: '{count} of {total} feedback entries read so far mention this. That is often enough to act on.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में से {count} में इसका ज़िक्र है। इस पर कदम उठाने के लिए आम तौर पर यह काफ़ी होता है।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे. यावर पाऊल उचलण्यासाठी हे बहुतेकदा पुरेसं असतं.',
  },
  'intelligence.confidence.strong.single.one': {
    en: '{count} of {total} feedback entry read so far mentions this. That is often enough to act on.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में से {count} में इसका ज़िक्र है। इस पर कदम उठाने के लिए आम तौर पर यह काफ़ी होता है।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे. यावर पाऊल उचलण्यासाठी हे बहुतेकदा पुरेसं असतं.',
  },
  'intelligence.confidence.strong.single.other': {
    en: '{count} of {total} feedback entry read so far mention this. That is often enough to act on.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में से {count} में इसका ज़िक्र है। इस पर कदम उठाने के लिए आम तौर पर यह काफ़ी होता है।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे. यावर पाऊल उचलण्यासाठी हे बहुतेकदा पुरेसं असतं.',
  },

  'intelligence.confidence.moderate.many.one': {
    en: '{count} of {total} feedback entries read so far mentions this. That is a real pattern, but keep watching it.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में से {count} में इसका ज़िक्र है। यह सचमुच एक पैटर्न है, पर इस पर नज़र रखते रहें।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे. हा खरोखर एक पॅटर्न आहे, पण त्यावर लक्ष ठेवत राहा.',
  },
  'intelligence.confidence.moderate.many.other': {
    en: '{count} of {total} feedback entries read so far mention this. That is a real pattern, but keep watching it.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में से {count} में इसका ज़िक्र है। यह सचमुच एक पैटर्न है, पर इस पर नज़र रखते रहें।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे. हा खरोखर एक पॅटर्न आहे, पण त्यावर लक्ष ठेवत राहा.',
  },
  'intelligence.confidence.moderate.single.one': {
    en: '{count} of {total} feedback entry read so far mentions this. That is a real pattern, but keep watching it.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में से {count} में इसका ज़िक्र है। यह सचमुच एक पैटर्न है, पर इस पर नज़र रखते रहें।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे. हा खरोखर एक पॅटर्न आहे, पण त्यावर लक्ष ठेवत राहा.',
  },
  'intelligence.confidence.moderate.single.other': {
    en: '{count} of {total} feedback entry read so far mention this. That is a real pattern, but keep watching it.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में से {count} में इसका ज़िक्र है। यह सचमुच एक पैटर्न है, पर इस पर नज़र रखते रहें।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे. हा खरोखर एक पॅटर्न आहे, पण त्यावर लक्ष ठेवत राहा.',
  },

  'intelligence.confidence.early.many.one': {
    en: '{count} of {total} feedback entries read so far mentions this. That is an early sign, on too little feedback to be sure of.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में से {count} में इसका ज़िक्र है। यह शुरुआती संकेत है, और इतने कम फ़ीडबैक पर इसका पक्का भरोसा नहीं किया जा सकता।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे. हे सुरुवातीचं चिन्ह आहे, आणि इतक्या कमी फीडबॅकवर याची खात्री देता येत नाही.',
  },
  'intelligence.confidence.early.many.other': {
    en: '{count} of {total} feedback entries read so far mention this. That is an early sign, on too little feedback to be sure of.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में से {count} में इसका ज़िक्र है। यह शुरुआती संकेत है, और इतने कम फ़ीडबैक पर इसका पक्का भरोसा नहीं किया जा सकता।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे. हे सुरुवातीचं चिन्ह आहे, आणि इतक्या कमी फीडबॅकवर याची खात्री देता येत नाही.',
  },
  'intelligence.confidence.early.single.one': {
    en: '{count} of {total} feedback entry read so far mentions this. That is an early sign, on too little feedback to be sure of.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में से {count} में इसका ज़िक्र है। यह शुरुआती संकेत है, और इतने कम फ़ीडबैक पर इसका पक्का भरोसा नहीं किया जा सकता।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे. हे सुरुवातीचं चिन्ह आहे, आणि इतक्या कमी फीडबॅकवर याची खात्री देता येत नाही.',
  },
  'intelligence.confidence.early.single.other': {
    en: '{count} of {total} feedback entry read so far mention this. That is an early sign, on too little feedback to be sure of.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में से {count} में इसका ज़िक्र है। यह शुरुआती संकेत है, और इतने कम फ़ीडबैक पर इसका पक्का भरोसा नहीं किया जा सकता।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे. हे सुरुवातीचं चिन्ह आहे, आणि इतक्या कमी फीडबॅकवर याची खात्री देता येत नाही.',
  },

  // -------------------------------------------------------------------------
  // The two points being compared
  // -------------------------------------------------------------------------
  'intelligence.window.single_checkin': {
    en: 'There is only one check-in so far, so there is nothing to compare against yet.',
    hi: 'अभी तक सिर्फ़ एक चेक-इन हुआ है, इसलिए तुलना करने के लिए अभी कुछ नहीं है।',
    mr: 'आतापर्यंत फक्त एकच चेक-इन झालं आहे, त्यामुळे तुलना करण्यासाठी अजून काहीच नाही.',
  },
  'intelligence.window.both_empty': {
    en: 'Your check-ins of {previous} and {current} have no feedback between them to compare. Everything read so far came in after them. Your next check-in will include it.',
    hi: '{previous} और {current} के आपके चेक-इन के बीच तुलना करने लायक कोई फ़ीडबैक नहीं है। अब तक जो कुछ पढ़ा गया, वह इनके बाद आया है। आपके अगले चेक-इन में वह शामिल होगा।',
    mr: '{previous} आणि {current} या तुमच्या चेक-इनदरम्यान तुलना करण्यासारखा कोणताही फीडबॅक नाही. आतापर्यंत जे वाचलं गेलं ते यांच्या नंतर आलं आहे. तुमच्या पुढच्या चेक-इनमध्ये ते समाविष्ट असेल.',
  },
  'intelligence.window.too_thin': {
    en: 'There is not enough feedback between your check-ins to compare topic by topic: {previousCount} at {previous} and {currentCount} at {current}. Headway needs {needed} on each side.',
    hi: 'विषय-दर-विषय तुलना करने के लिए आपके चेक-इन के बीच पर्याप्त फ़ीडबैक नहीं है: {previous} पर {previousCount} और {current} पर {currentCount}। Headway को हर तरफ़ {needed} चाहिए।',
    mr: 'विषयवार तुलना करण्यासाठी तुमच्या चेक-इनदरम्यान पुरेसा फीडबॅक नाही: {previous} ला {previousCount} आणि {current} ला {currentCount}. Headway ला प्रत्येक बाजूला {needed} लागतात.',
  },
  'intelligence.window.note.one': {
    en: 'Comparing your check-in of {previous} ({count} feedback entry) with {current} ({currentCount}).',
    hi: '{previous} ({count} फ़ीडबैक) के आपके चेक-इन की तुलना {current} ({currentCount}) से की जा रही है।',
    mr: '{previous} ({count} फीडबॅक) या तुमच्या चेक-इनची तुलना {current} ({currentCount}) शी केली जात आहे.',
  },
  'intelligence.window.note.other': {
    en: 'Comparing your check-in of {previous} ({count} feedback entries) with {current} ({currentCount}).',
    hi: '{previous} ({count} फ़ीडबैक) के आपके चेक-इन की तुलना {current} ({currentCount}) से की जा रही है।',
    mr: '{previous} ({count} फीडबॅक) या तुमच्या चेक-इनची तुलना {current} ({currentCount}) शी केली जात आहे.',
  },
  /**
   * The volume caveat. It must keep saying that the movement is partly just
   * more feedback and NOT a change in what customers think — a correlation
   * held apart from a cause, in every language.
   */
  'intelligence.window.volume_caveat': {
    en: 'One check-in has far more feedback than the other ({previousCount} then, {currentCount} now). Some of this movement is just more feedback, not a change in what customers think.',
    hi: 'एक चेक-इन में दूसरे के मुक़ाबले कहीं ज़्यादा फ़ीडबैक है (तब {previousCount}, अब {currentCount})। इस हलचल का कुछ हिस्सा सिर्फ़ ज़्यादा फ़ीडबैक है, ग्राहकों की सोच में हुआ बदलाव नहीं।',
    mr: 'एका चेक-इनमध्ये दुसऱ्यापेक्षा कितीतरी जास्त फीडबॅक आहे (तेव्हा {previousCount}, आता {currentCount}). यातील काही हालचाल फक्त जास्त फीडबॅकमुळे आहे, ग्राहकांच्या विचारात झालेला बदल नाही.',
  },

  // -------------------------------------------------------------------------
  // How one theme moved between the two check-ins
  //
  // `{count}` is the count at the previous check-in, `{currentCount}` at the
  // current one. Both labels are dates, and go in as values.
  // -------------------------------------------------------------------------
  'intelligence.movement.absent': {
    en: '{theme} has not come up in the feedback attached to either check-in, so there is nothing to compare.',
    hi: '{theme} का ज़िक्र किसी भी चेक-इन से जुड़े फ़ीडबैक में नहीं आया, इसलिए तुलना करने के लिए कुछ नहीं है।',
    mr: '{theme} चा उल्लेख कोणत्याही चेक-इनशी जोडलेल्या फीडबॅकमध्ये आलेला नाही, त्यामुळे तुलना करण्यासारखं काही नाही.',
  },
  'intelligence.movement.count_note.one': {
    en: '{previousCount} → {count} mention',
    hi: '{previousCount} → {count} ज़िक्र',
    mr: '{previousCount} → {count} उल्लेख',
  },
  'intelligence.movement.count_note.other': {
    en: '{previousCount} → {count} mentions',
    hi: '{previousCount} → {count} ज़िक्र',
    mr: '{previousCount} → {count} उल्लेख',
  },
  'intelligence.movement.steady.one': {
    en: '{count} mention at your check-in on {previous}, {currentCount} at {current}. Holding steady.',
    hi: 'आपके {previous} के चेक-इन पर {count} ज़िक्र, {current} पर {currentCount}। स्थिर बना हुआ है।',
    mr: 'तुमच्या {previous} च्या चेक-इनला {count} उल्लेख, {current} ला {currentCount}. स्थिर आहे.',
  },
  'intelligence.movement.steady.other': {
    en: '{count} mentions at your check-in on {previous}, {currentCount} at {current}. Holding steady.',
    hi: 'आपके {previous} के चेक-इन पर {count} ज़िक्र, {current} पर {currentCount}। स्थिर बना हुआ है।',
    mr: 'तुमच्या {previous} च्या चेक-इनला {count} उल्लेख, {current} ला {currentCount}. स्थिर आहे.',
  },
  'intelligence.movement.too_few.one': {
    en: '{count} mention at your check-in on {previous}, {currentCount} at {current}. Too few either way to call it a change. Headway needs {needed} on one side.',
    hi: 'आपके {previous} के चेक-इन पर {count} ज़िक्र, {current} पर {currentCount}। इसे बदलाव कहने के लिए दोनों ही तरफ़ बहुत कम हैं। Headway को एक तरफ़ {needed} चाहिए।',
    mr: 'तुमच्या {previous} च्या चेक-इनला {count} उल्लेख, {current} ला {currentCount}. याला बदल म्हणण्यासाठी दोन्ही बाजूंनी हे फारच कमी आहेत. Headway ला एका बाजूला {needed} लागतात.',
  },
  'intelligence.movement.too_few.other': {
    en: '{count} mentions at your check-in on {previous}, {currentCount} at {current}. Too few either way to call it a change. Headway needs {needed} on one side.',
    hi: 'आपके {previous} के चेक-इन पर {count} ज़िक्र, {current} पर {currentCount}। इसे बदलाव कहने के लिए दोनों ही तरफ़ बहुत कम हैं। Headway को एक तरफ़ {needed} चाहिए।',
    mr: 'तुमच्या {previous} च्या चेक-इनला {count} उल्लेख, {current} ला {currentCount}. याला बदल म्हणण्यासाठी दोन्ही बाजूंनी हे फारच कमी आहेत. Headway ला एका बाजूला {needed} लागतात.',
  },
  'intelligence.movement.up.one': {
    en: '{count} mention at your check-in on {previous}, {currentCount} at {current} (up {delta}).',
    hi: 'आपके {previous} के चेक-इन पर {count} ज़िक्र, {current} पर {currentCount} ({delta} ज़्यादा)।',
    mr: 'तुमच्या {previous} च्या चेक-इनला {count} उल्लेख, {current} ला {currentCount} ({delta} जास्त).',
  },
  'intelligence.movement.up.other': {
    en: '{count} mentions at your check-in on {previous}, {currentCount} at {current} (up {delta}).',
    hi: 'आपके {previous} के चेक-इन पर {count} ज़िक्र, {current} पर {currentCount} ({delta} ज़्यादा)।',
    mr: 'तुमच्या {previous} च्या चेक-इनला {count} उल्लेख, {current} ला {currentCount} ({delta} जास्त).',
  },
  'intelligence.movement.down.one': {
    en: '{count} mention at your check-in on {previous}, {currentCount} at {current} (down {delta}).',
    hi: 'आपके {previous} के चेक-इन पर {count} ज़िक्र, {current} पर {currentCount} ({delta} कम)।',
    mr: 'तुमच्या {previous} च्या चेक-इनला {count} उल्लेख, {current} ला {currentCount} ({delta} कमी).',
  },
  'intelligence.movement.down.other': {
    en: '{count} mentions at your check-in on {previous}, {currentCount} at {current} (down {delta}).',
    hi: 'आपके {previous} के चेक-इन पर {count} ज़िक्र, {current} पर {currentCount} ({delta} कम)।',
    mr: 'तुमच्या {previous} च्या चेक-इनला {count} उल्लेख, {current} ला {currentCount} ({delta} कमी).',
  },

  // -------------------------------------------------------------------------
  // Why a theme sits where it sits
  //
  // `{vertical}` and `{label}` arrive from the vertical pack already lowercased.
  // They are data, and are never translated here.
  // -------------------------------------------------------------------------
  'intelligence.signal.severity_high': {
    en: 'This is a serious complaint for a {vertical}.',
    hi: '{vertical} के लिए यह गंभीर शिकायत है।',
    mr: '{vertical} साठी ही गंभीर तक्रार आहे.',
  },
  'intelligence.signal.severity_medium': {
    en: 'This matters to {vertical} customers.',
    hi: '{vertical} के ग्राहकों के लिए यह मायने रखता है।',
    mr: '{vertical} च्या ग्राहकांसाठी हे महत्त्वाचं आहे.',
  },
  'intelligence.signal.severity_low': {
    en: 'A small complaint, but customers did mention it.',
    hi: 'छोटी शिकायत है, पर ग्राहकों ने इसका ज़िक्र ज़रूर किया।',
    mr: 'छोटी तक्रार आहे, पण ग्राहकांनी याचा उल्लेख नक्की केला.',
  },
  'intelligence.signal.mentioned.one': {
    en: 'Mentioned {count} time.',
    hi: '{count} बार ज़िक्र किया गया।',
    mr: '{count} वेळा उल्लेख केला.',
  },
  'intelligence.signal.mentioned.other': {
    en: 'Mentioned {count} times.',
    hi: '{count} बार ज़िक्र किया गया।',
    mr: '{count} वेळा उल्लेख केला.',
  },
  'intelligence.signal.praised.one': {
    en: 'Praised {count} time.',
    hi: '{count} बार तारीफ़ की गई।',
    mr: '{count} वेळा कौतुक केलं.',
  },
  'intelligence.signal.praised.other': {
    en: 'Praised {count} times.',
    hi: '{count} बार तारीफ़ की गई।',
    mr: '{count} वेळा कौतुक केलं.',
  },
  'intelligence.signal.pattern': {
    en: 'Mentioned at least {needed} times. That makes it a pattern, not a one-off.',
    hi: 'कम से कम {needed} बार ज़िक्र किया गया। इससे यह पैटर्न बनता है, इक्का-दुक्का बात नहीं।',
    mr: 'किमान {needed} वेळा उल्लेख केला गेला. त्यामुळे हा पॅटर्न ठरतो, एखादी सुटी घटना नाही.',
  },
  'intelligence.signal.strength': {
    en: 'Praised often enough to be a strength. Protect it.',
    hi: 'इतनी बार तारीफ़ की गई कि यह आपकी ताक़त है। इसे बनाए रखें।',
    mr: 'इतक्या वेळा कौतुक केलं गेलं की ही तुमची ताकद आहे. ती जपा.',
  },
  /**
   * Tapped ratings, worded apart from written words on purpose: this says what
   * a customer rated, never what a customer said.
   */
  'intelligence.signal.rated_low.one': {
    en: '{count} customer of the {rated} who rated {label} put it at {threshold} or below.',
    hi: '{label} को रेटिंग देने वाले {rated} ग्राहकों में से {count} ने इसे {threshold} या उससे कम रखा।',
    mr: '{label} ला रेटिंग देणाऱ्या {rated} ग्राहकांपैकी {count} जणांनी ती {threshold} किंवा त्याहून कमी दिली.',
  },
  'intelligence.signal.rated_low.other': {
    en: '{count} customers of the {rated} who rated {label} put it at {threshold} or below.',
    hi: '{label} को रेटिंग देने वाले {rated} ग्राहकों में से {count} ने इसे {threshold} या उससे कम रखा।',
    mr: '{label} ला रेटिंग देणाऱ्या {rated} ग्राहकांपैकी {count} जणांनी ती {threshold} किंवा त्याहून कमी दिली.',
  },
  'intelligence.signal.worsening': {
    en: 'Customers mention it more than last time: {counts}.',
    hi: 'ग्राहक पिछली बार से ज़्यादा बार इसका ज़िक्र कर रहे हैं: {counts}।',
    mr: 'ग्राहक मागच्या वेळेपेक्षा जास्त वेळा याचा उल्लेख करत आहेत: {counts}.',
  },
  'intelligence.signal.growing': {
    en: 'Customers praise it more than last time: {counts}.',
    hi: 'ग्राहक पिछली बार से ज़्यादा बार इसकी तारीफ़ कर रहे हैं: {counts}।',
    mr: 'ग्राहक मागच्या वेळेपेक्षा जास्त वेळा याचं कौतुक करत आहेत: {counts}.',
  },

  // -------------------------------------------------------------------------
  // The one-line headline on an insight. `{theme}` is a pack label, as data.
  // -------------------------------------------------------------------------
  'intelligence.headline.loved': {
    en: 'Customers keep praising {theme}.',
    hi: 'ग्राहक {theme} की तारीफ़ करते रहते हैं।',
    mr: 'ग्राहक {theme} चं कौतुक करत राहतात.',
  },
  'intelligence.headline.unhappy': {
    en: 'Customers complain about {theme}.',
    hi: 'ग्राहक {theme} की शिकायत करते हैं।',
    mr: 'ग्राहक {theme} बद्दल तक्रार करतात.',
  },
  'intelligence.headline.attention': {
    en: '{theme} needs your attention.',
    hi: '{theme} पर आपका ध्यान चाहिए।',
    mr: '{theme} कडे तुमचं लक्ष हवं आहे.',
  },
  'intelligence.headline.issue_down': {
    en: 'Fewer customers are mentioning {theme}.',
    hi: 'कम ग्राहक {theme} का ज़िक्र कर रहे हैं।',
    mr: 'कमी ग्राहक {theme} चा उल्लेख करत आहेत.',
  },
  'intelligence.headline.issue_up': {
    en: 'More customers are mentioning {theme}.',
    hi: 'ज़्यादा ग्राहक {theme} का ज़िक्र कर रहे हैं।',
    mr: 'जास्त ग्राहक {theme} चा उल्लेख करत आहेत.',
  },
  'intelligence.headline.praise_up': {
    en: 'More customers are praising {theme}.',
    hi: 'ज़्यादा ग्राहक {theme} की तारीफ़ कर रहे हैं।',
    mr: 'जास्त ग्राहक {theme} चं कौतुक करत आहेत.',
  },
  'intelligence.headline.praise_down': {
    en: 'Fewer customers are praising {theme}.',
    hi: 'कम ग्राहक {theme} की तारीफ़ कर रहे हैं।',
    mr: 'कमी ग्राहक {theme} चं कौतुक करत आहेत.',
  },

  // -------------------------------------------------------------------------
  // The supporting line under a headline: the count and the pile it is over.
  // `{count}` is the mentions, `{total}` the entries read.
  // -------------------------------------------------------------------------
  'intelligence.detail.mentions.many.one': {
    en: '{count} mention across {total} feedback entries read so far.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में {count} ज़िक्र।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकमध्ये {count} उल्लेख.',
  },
  'intelligence.detail.mentions.many.other': {
    en: '{count} mentions across {total} feedback entries read so far.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में {count} ज़िक्र।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकमध्ये {count} उल्लेख.',
  },
  'intelligence.detail.mentions.single.one': {
    en: '{count} mention across {total} feedback entry read so far.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में {count} ज़िक्र।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकमध्ये {count} उल्लेख.',
  },
  'intelligence.detail.mentions.single.other': {
    en: '{count} mentions across {total} feedback entry read so far.',
    hi: 'अब तक पढ़े गए {total} फ़ीडबैक में {count} ज़िक्र।',
    mr: 'आतापर्यंत वाचलेल्या {total} फीडबॅकमध्ये {count} उल्लेख.',
  },

  // -------------------------------------------------------------------------
  // The line above the three things worth leading with
  // -------------------------------------------------------------------------
  'intelligence.summary.none': {
    en: 'Nothing has been said often enough yet for Headway to call it a pattern.',
    hi: 'अभी तक कोई बात इतनी बार नहीं कही गई कि Headway उसे पैटर्न कह सके।',
    mr: 'अजून कोणतीही गोष्ट इतक्या वेळा सांगितली गेलेली नाही की Headway तिला पॅटर्न म्हणू शकेल.',
  },
  'intelligence.summary.few.one': {
    en: 'Only {count} clear pattern so far. More will appear as feedback comes in.',
    hi: 'अभी तक सिर्फ़ {count} साफ़ पैटर्न। जैसे-जैसे फ़ीडबैक आएगा, और दिखेंगे।',
    mr: 'आतापर्यंत फक्त {count} स्पष्ट पॅटर्न. जसजसा फीडबॅक येईल, तसतसे आणखी दिसतील.',
  },
  'intelligence.summary.few.other': {
    en: 'Only {count} clear patterns so far. More will appear as feedback comes in.',
    hi: 'अभी तक सिर्फ़ {count} साफ़ पैटर्न। जैसे-जैसे फ़ीडबैक आएगा, और दिखेंगे।',
    mr: 'आतापर्यंत फक्त {count} स्पष्ट पॅटर्न. जसजसा फीडबॅक येईल, तसतसे आणखी दिसतील.',
  },
  'intelligence.summary.clearest': {
    en: 'The clearest things customers are telling this business right now.',
    hi: 'ग्राहक अभी इस बिज़नेस को जो सबसे साफ़ बातें बता रहे हैं।',
    mr: 'ग्राहक सध्या या व्यवसायाला ज्या सर्वात स्पष्ट गोष्टी सांगत आहेत त्या.',
  },

  // -------------------------------------------------------------------------
  // Which way things are going overall
  // -------------------------------------------------------------------------
  'intelligence.trend.single_checkin': {
    en: 'There is only one check-in so far, so Headway cannot say which way things are going.',
    hi: 'अभी तक सिर्फ़ एक चेक-इन हुआ है, इसलिए Headway यह नहीं कह सकता कि चीज़ें किस दिशा में जा रही हैं।',
    mr: 'आतापर्यंत फक्त एकच चेक-इन झालं आहे, त्यामुळे गोष्टी कोणत्या दिशेने चालल्या आहेत हे Headway सांगू शकत नाही.',
  },
  'intelligence.trend.improving': {
    en: 'Things are moving the right way.',
    hi: 'चीज़ें सही दिशा में जा रही हैं।',
    mr: 'गोष्टी योग्य दिशेने चालल्या आहेत.',
  },
  'intelligence.trend.declining': {
    en: 'Things are moving the wrong way.',
    hi: 'चीज़ें ग़लत दिशा में जा रही हैं।',
    mr: 'गोष्टी चुकीच्या दिशेने चालल्या आहेत.',
  },
  'intelligence.trend.stable': {
    en: 'Things are holding steady.',
    hi: 'चीज़ें स्थिर बनी हुई हैं।',
    mr: 'गोष्टी स्थिर आहेत.',
  },
  'intelligence.trend.unknown': {
    en: 'There is not enough to compare yet, so Headway cannot say which way things are going.',
    hi: 'तुलना करने के लिए अभी पर्याप्त नहीं है, इसलिए Headway यह नहीं कह सकता कि चीज़ें किस दिशा में जा रही हैं।',
    mr: 'तुलना करण्यासाठी अजून पुरेसं नाही, त्यामुळे गोष्टी कोणत्या दिशेने चालल्या आहेत हे Headway सांगू शकत नाही.',
  },

  // -------------------------------------------------------------------------
  // What Headway still cannot say
  // -------------------------------------------------------------------------
  'intelligence.limit.reading_all.one': {
    en: 'Headway is reading {count} feedback entry now. Nothing is counted until Headway has read it.',
    hi: 'Headway अभी {count} फ़ीडबैक पढ़ रहा है। जब तक Headway उसे पढ़ नहीं लेता, कुछ भी गिना नहीं जाता।',
    mr: 'Headway आत्ता {count} फीडबॅक वाचत आहे. Headway तो वाचेपर्यंत काहीही मोजलं जात नाही.',
  },
  'intelligence.limit.reading_all.other': {
    en: 'Headway is reading {count} feedback entries now. Nothing is counted until Headway has read it.',
    hi: 'Headway अभी {count} फ़ीडबैक पढ़ रहा है। जब तक Headway उसे पढ़ नहीं लेता, कुछ भी गिना नहीं जाता।',
    mr: 'Headway आत्ता {count} फीडबॅक वाचत आहे. Headway तो वाचेपर्यंत काहीही मोजलं जात नाही.',
  },
  'intelligence.limit.nothing_read': {
    en: 'No feedback has been read yet, so there is nothing for Headway to tell you.',
    hi: 'अभी तक कोई फ़ीडबैक पढ़ा नहीं गया है, इसलिए Headway के पास आपको बताने के लिए कुछ नहीं है।',
    mr: 'अजून कोणताही फीडबॅक वाचला गेलेला नाही, त्यामुळे Headway कडे तुम्हाला सांगण्यासारखं काही नाही.',
  },
  'intelligence.limit.too_thin.one': {
    en: 'Only {count} feedback entry has been read. Everything above is an early sign, not a conclusion.',
    hi: 'सिर्फ़ {count} फ़ीडबैक पढ़ा गया है। ऊपर जो कुछ है वह शुरुआती संकेत है, नतीजा नहीं।',
    mr: 'फक्त {count} फीडबॅक वाचला गेला आहे. वर जे काही आहे ते सुरुवातीचं चिन्ह आहे, निष्कर्ष नाही.',
  },
  'intelligence.limit.too_thin.other': {
    en: 'Only {count} feedback entries have been read. Everything above is an early sign, not a conclusion.',
    hi: 'सिर्फ़ {count} फ़ीडबैक पढ़े गए हैं। ऊपर जो कुछ है वह शुरुआती संकेत है, नतीजा नहीं।',
    mr: 'फक्त {count} फीडबॅक वाचले गेले आहेत. वर जे काही आहे ते सुरुवातीचं चिन्ह आहे, निष्कर्ष नाही.',
  },
  'intelligence.limit.reading_more.one': {
    en: 'Headway is reading {count} more feedback entry now. It is not counted above yet.',
    hi: 'Headway अभी {count} और फ़ीडबैक पढ़ रहा है। वह अभी ऊपर गिना नहीं गया है।',
    mr: 'Headway आत्ता आणखी {count} फीडबॅक वाचत आहे. तो अजून वर मोजलेला नाही.',
  },
  'intelligence.limit.reading_more.other': {
    en: 'Headway is reading {count} more feedback entries now. They are not counted above yet.',
    hi: 'Headway अभी {count} और फ़ीडबैक पढ़ रहा है। वे अभी ऊपर गिने नहीं गए हैं।',
    mr: 'Headway आत्ता आणखी {count} फीडबॅक वाचत आहे. ते अजून वर मोजलेले नाहीत.',
  },
  'intelligence.limit.quiet.one': {
    en: '{count} other topic was mentioned once or twice. That is not enough to call a pattern yet.',
    hi: '{count} और विषय का ज़िक्र एक-दो बार हुआ। इसे अभी पैटर्न कहने के लिए यह काफ़ी नहीं है।',
    mr: 'आणखी {count} विषयाचा उल्लेख एक-दोन वेळा झाला. याला अजून पॅटर्न म्हणण्यासाठी हे पुरेसं नाही.',
  },
  'intelligence.limit.quiet.other': {
    en: '{count} other topics were mentioned once or twice. That is not enough to call a pattern yet.',
    hi: '{count} और विषयों का ज़िक्र एक-दो बार हुआ। इन्हें अभी पैटर्न कहने के लिए यह काफ़ी नहीं है।',
    mr: 'आणखी {count} विषयांचा उल्लेख एक-दोन वेळा झाला. यांना अजून पॅटर्न म्हणण्यासाठी हे पुरेसं नाही.',
  },

  // -------------------------------------------------------------------------
  // Operator context, kept apart from customer evidence
  // -------------------------------------------------------------------------
  'intelligence.context.label': {
    en: 'You recorded this. A customer did not say it.',
    hi: 'यह आपने दर्ज किया है। यह किसी ग्राहक ने नहीं कहा।',
    mr: 'हे तुम्ही नोंदवलं आहे. हे कोणत्याही ग्राहकाने सांगितलेलं नाही.',
  },

  // -------------------------------------------------------------------------
  // THE HEALTH CARD AND THE PULSE (src/lib/health/health.ts)
  //
  // Deterministic sentences, assembled from stored check-ins and stored
  // feedback. Every one of them carries the real figures that produced it, and
  // every threshold in them comes from `health/rules.ts` — so a number here is
  // never rounded, restated or dropped in translation.
  //
  // COUNTING UNIT. English says "feedback entries", never "items": an item is
  // a row in a table, a feedback entry is the thing a customer left. Hindi
  // and Marathi say फ़ीडबैक / फीडबॅक, which does not inflect, so the `.one` and
  // `.other` forms are identical there and differ only in English.
  //
  // TWO COUNTS IN ONE SENTENCE, again. Where a sentence carries both a part and
  // a whole, `t.plural` inflects on the whole — that is the noun English has to
  // agree with — and the part rides in as its own placeholder ({negative},
  // {mentions}, {unanswered}). Hindi and Marathi put the whole first, which is
  // exactly why these are whole sentences.
  //
  // THE EVIDENCE FLOORS ARE NOT DECORATION. "below the {needed} Headway needs
  // before it states a share", "under the {needed} needed to call a direction"
  // and "read these as counts, not a pattern" are the sentences that stop a
  // figure being read as a verdict. They say exactly as much in all three
  // languages: no softening, and no movement turned into a cause.
  // -------------------------------------------------------------------------

  // --- how much feedback a check-in holds, and what it is worth -------------
  'intelligence.health.distribution.none': {
    en: 'No feedback yet.',
    hi: 'अभी तक कोई फ़ीडबैक नहीं।',
    mr: 'अजून कोणताही फीडबॅक नाही.',
  },
  'intelligence.health.distribution.based_on.one': {
    en: 'Based on {count} feedback entry.',
    hi: '{count} फ़ीडबैक के आधार पर।',
    mr: '{count} फीडबॅकच्या आधारे.',
  },
  'intelligence.health.distribution.based_on.other': {
    en: 'Based on {count} feedback entries.',
    hi: '{count} फ़ीडबैक के आधार पर।',
    mr: '{count} फीडबॅकच्या आधारे.',
  },
  'intelligence.health.distribution.thin.one': {
    en: 'Only {count} feedback entry so far, below the {needed} Headway needs before it states a share.',
    hi: 'अभी तक सिर्फ़ {count} फ़ीडबैक — हिस्सा बताने से पहले Headway को जो {needed} चाहिए, उससे कम।',
    mr: 'आतापर्यंत फक्त {count} फीडबॅक — वाटा सांगण्यापूर्वी Headway ला जे {needed} लागतात, त्यापेक्षा कमी.',
  },
  'intelligence.health.distribution.thin.other': {
    en: 'Only {count} feedback entries so far, below the {needed} Headway needs before it states a share.',
    hi: 'अभी तक सिर्फ़ {count} फ़ीडबैक — हिस्सा बताने से पहले Headway को जो {needed} चाहिए, उससे कम।',
    mr: 'आतापर्यंत फक्त {count} फीडबॅक — वाटा सांगण्यापूर्वी Headway ला जे {needed} लागतात, त्यापेक्षा कमी.',
  },

  // --- the three figures compared between two check-ins ---------------------
  'intelligence.health.metric.rating': {
    en: 'Rating',
    hi: 'रेटिंग',
    mr: 'रेटिंग',
  },
  'intelligence.health.metric.negative_share': {
    en: 'Negative feedback share',
    hi: 'नकारात्मक फ़ीडबैक का हिस्सा',
    mr: 'नकारात्मक फीडबॅकचा वाटा',
  },
  'intelligence.health.metric.unanswered_share': {
    en: 'Unanswered public reviews',
    hi: 'बिना जवाब वाले सार्वजनिक रिव्यू',
    mr: 'उत्तर न दिलेले सार्वजनिक रिव्ह्यू',
  },

  'intelligence.health.trend.rating.not_recorded': {
    en: 'The rating was not recorded at both check-ins, so it cannot be compared.',
    hi: 'दोनों चेक-इन पर रेटिंग दर्ज नहीं की गई थी, इसलिए इसकी तुलना नहीं की जा सकती।',
    mr: 'दोन्ही चेक-इनला रेटिंग नोंदवली गेली नव्हती, त्यामुळे तिची तुलना करता येत नाही.',
  },
  'intelligence.health.trend.rating.moved': {
    en: 'Rating moved from {previous} to {current} ({delta}).',
    hi: 'रेटिंग {previous} से {current} हुई ({delta})।',
    mr: 'रेटिंग {previous} वरून {current} झाली ({delta}).',
  },
  /** The threshold sentence: a move too small to be called a direction. */
  'intelligence.health.trend.rating.flat': {
    en: 'Rating moved from {previous} to {current} — smaller than the {needed} needed to call a direction.',
    hi: 'रेटिंग {previous} से {current} हुई — दिशा बताने के लिए जो {needed} चाहिए, उससे कम।',
    mr: 'रेटिंग {previous} वरून {current} झाली — दिशा सांगण्यासाठी जे {needed} लागतात, त्यापेक्षा कमी.',
  },
  'intelligence.health.trend.negative.not_comparable': {
    en: 'One of the two check-ins has no feedback, so the share cannot be compared.',
    hi: 'दोनों में से एक चेक-इन पर कोई फ़ीडबैक नहीं है, इसलिए हिस्से की तुलना नहीं की जा सकती।',
    mr: 'दोनपैकी एका चेक-इनला कोणताही फीडबॅक नाही, त्यामुळे वाट्याची तुलना करता येत नाही.',
  },
  'intelligence.health.trend.negative.too_little': {
    en: 'Too little feedback to read as a trend: {previousCount} then, {currentCount} now. Headway needs {needed} on each side.',
    hi: 'इसे रुझान की तरह पढ़ने के लिए फ़ीडबैक बहुत कम है: तब {previousCount}, अब {currentCount}। Headway को हर तरफ़ {needed} चाहिए।',
    mr: 'याला कल म्हणून वाचण्यासाठी फीडबॅक फारच कमी आहे: तेव्हा {previousCount}, आता {currentCount}. Headway ला प्रत्येक बाजूला {needed} लागतात.',
  },
  'intelligence.health.trend.negative.moved': {
    en: 'Negative share moved from {previous} to {current}.',
    hi: 'नकारात्मक हिस्सा {previous} से {current} हुआ।',
    mr: 'नकारात्मक वाटा {previous} वरून {current} झाला.',
  },
  'intelligence.health.trend.negative.flat': {
    en: 'Negative share moved from {previous} to {current} — under the {needed} needed to call a direction.',
    hi: 'नकारात्मक हिस्सा {previous} से {current} हुआ — दिशा बताने के लिए जो {needed} चाहिए, उससे कम।',
    mr: 'नकारात्मक वाटा {previous} वरून {current} झाला — दिशा सांगण्यासाठी जे {needed} लागतात, त्यापेक्षा कमी.',
  },
  'intelligence.health.trend.unanswered.not_recorded': {
    en: 'Unanswered public reviews were not recorded at both check-ins, so they cannot be compared.',
    hi: 'बिना जवाब वाले सार्वजनिक रिव्यू दोनों चेक-इन पर दर्ज नहीं किए गए थे, इसलिए उनकी तुलना नहीं की जा सकती।',
    mr: 'उत्तर न दिलेले सार्वजनिक रिव्ह्यू दोन्ही चेक-इनला नोंदवले गेले नव्हते, त्यामुळे त्यांची तुलना करता येत नाही.',
  },
  'intelligence.health.trend.unanswered.moved': {
    en: 'Unanswered share moved from {previous} to {current}.',
    hi: 'बिना जवाब वालों का हिस्सा {previous} से {current} हुआ।',
    mr: 'उत्तर न दिलेल्यांचा वाटा {previous} वरून {current} झाला.',
  },
  'intelligence.health.trend.unanswered.flat': {
    en: 'Unanswered share moved from {previous} to {current} — under the {needed} needed to call a direction.',
    hi: 'बिना जवाब वालों का हिस्सा {previous} से {current} हुआ — दिशा बताने के लिए जो {needed} चाहिए, उससे कम।',
    mr: 'उत्तर न दिलेल्यांचा वाटा {previous} वरून {current} झाला — दिशा सांगण्यासाठी जे {needed} लागतात, त्यापेक्षा कमी.',
  },

  // --- whether a direction can be called at all -----------------------------
  'intelligence.health.trend.no_checkins': {
    en: 'No check-ins yet, so there is nothing to compare.',
    hi: 'अभी तक कोई चेक-इन नहीं हुआ, इसलिए तुलना करने के लिए कुछ नहीं है।',
    mr: 'अजून कोणतंही चेक-इन झालेलं नाही, त्यामुळे तुलना करण्यासारखं काही नाही.',
  },
  'intelligence.health.trend.one_checkin': {
    en: 'Only one check-in so far. A trend needs at least two.',
    hi: 'अभी तक सिर्फ़ एक चेक-इन। रुझान के लिए कम से कम दो चाहिए।',
    mr: 'आतापर्यंत फक्त एकच चेक-इन. कल समजण्यासाठी किमान दोन लागतात.',
  },
  'intelligence.health.trend.no_common_figure': {
    en: 'The last two check-ins have no figure in common, so Headway cannot say which way things are going.',
    hi: 'पिछले दो चेक-इन में कोई आँकड़ा साझा नहीं है, इसलिए Headway यह नहीं कह सकता कि चीज़ें किस दिशा में जा रही हैं।',
    mr: 'शेवटच्या दोन चेक-इनमध्ये कोणताही आकडा समान नाही, त्यामुळे गोष्टी कोणत्या दिशेने चालल्या आहेत हे Headway सांगू शकत नाही.',
  },
  'intelligence.health.trend.nothing_moved.one': {
    en: 'Nothing moved far enough to count, across {count} figure Headway could compare.',
    hi: 'Headway जिस {count} आँकड़े की तुलना कर सका, उसमें कुछ भी इतना नहीं हिला कि गिना जाए।',
    mr: 'Headway ज्या {count} आकड्याची तुलना करू शकला, त्यात काहीही मोजण्याइतकं हललं नाही.',
  },
  'intelligence.health.trend.nothing_moved.other': {
    en: 'Nothing moved far enough to count, across {count} figures Headway could compare.',
    hi: 'Headway जिन {count} आँकड़ों की तुलना कर सका, उनमें कुछ भी इतना नहीं हिला कि गिना जाए।',
    mr: 'Headway ज्या {count} आकड्यांची तुलना करू शकला, त्यांत काहीही मोजण्याइतकं हललं नाही.',
  },

  // --- the direction label itself -------------------------------------------
  'intelligence.health.trend_label.improving': {
    en: 'Improving',
    hi: 'सुधर रहा है',
    mr: 'सुधारत आहे',
  },
  'intelligence.health.trend_label.stable': {
    en: 'Stable',
    hi: 'स्थिर',
    mr: 'स्थिर',
  },
  'intelligence.health.trend_label.declining': {
    en: 'Declining',
    hi: 'गिर रहा है',
    mr: 'घसरत आहे',
  },
  /** "Yet" carries that check-ins are missing, not that results are flat. */
  'intelligence.health.trend_label.none': {
    en: 'No trend yet',
    hi: 'अभी कोई रुझान नहीं',
    mr: 'अजून कल नाही',
  },

  // --- the status word --------------------------------------------------------
  'intelligence.health.status_label.healthy': {
    en: 'Healthy',
    hi: 'ठीक है',
    mr: 'ठीक आहे',
  },
  'intelligence.health.status_label.watch': {
    en: 'Watch',
    hi: 'नज़र रखें',
    mr: 'लक्ष ठेवा',
  },
  'intelligence.health.status_label.attention': {
    en: 'Needs attention',
    hi: 'ध्यान चाहिए',
    mr: 'लक्ष हवं',
  },
  /** Not a verdict: Headway is refusing to give one until it has enough. */
  'intelligence.health.status_label.insufficient': {
    en: 'Not enough yet',
    hi: 'अभी पर्याप्त नहीं',
    mr: 'अजून पुरेसं नाही',
  },

  // --- what fired, and the figures that fired it ----------------------------
  'intelligence.health.signal.negative_share_attention.label': {
    en: 'High share of negative feedback',
    hi: 'नकारात्मक फ़ीडबैक का हिस्सा ज़्यादा',
    mr: 'नकारात्मक फीडबॅकचा वाटा जास्त',
  },
  'intelligence.health.signal.negative_share_attention.detail.one': {
    en: '{negative} of {count} feedback entry are negative ({share}). Headway flags anything at {threshold} or above.',
    hi: '{count} फ़ीडबैक में से {negative} नकारात्मक हैं ({share})। Headway {threshold} या उससे ज़्यादा की किसी भी बात को चिह्नित करता है।',
    mr: '{count} फीडबॅकपैकी {negative} नकारात्मक आहेत ({share}). Headway {threshold} किंवा त्याहून जास्त असलेली कोणतीही गोष्ट चिन्हांकित करतो.',
  },
  'intelligence.health.signal.negative_share_attention.detail.other': {
    en: '{negative} of {count} feedback entries are negative ({share}). Headway flags anything at {threshold} or above.',
    hi: '{count} फ़ीडबैक में से {negative} नकारात्मक हैं ({share})। Headway {threshold} या उससे ज़्यादा की किसी भी बात को चिह्नित करता है।',
    mr: '{count} फीडबॅकपैकी {negative} नकारात्मक आहेत ({share}). Headway {threshold} किंवा त्याहून जास्त असलेली कोणतीही गोष्ट चिन्हांकित करतो.',
  },
  /**
   * A level, not a direction: this fires on one check-in's share and never
   * looks at the one before, so no language may say "climbing" here.
   */
  'intelligence.health.signal.negative_share_watch.label': {
    en: 'Negative feedback worth watching',
    hi: 'नकारात्मक फ़ीडबैक, नज़र रखने लायक',
    mr: 'नकारात्मक फीडबॅक, लक्ष ठेवण्यासारखा',
  },
  'intelligence.health.signal.negative_share_watch.detail.one': {
    en: '{negative} of {count} feedback entry are negative ({share}). Headway watches anything at {threshold} or above.',
    hi: '{count} फ़ीडबैक में से {negative} नकारात्मक हैं ({share})। Headway {threshold} या उससे ज़्यादा की किसी भी बात पर नज़र रखता है।',
    mr: '{count} फीडबॅकपैकी {negative} नकारात्मक आहेत ({share}). Headway {threshold} किंवा त्याहून जास्त असलेल्या कोणत्याही गोष्टीवर लक्ष ठेवतो.',
  },
  'intelligence.health.signal.negative_share_watch.detail.other': {
    en: '{negative} of {count} feedback entries are negative ({share}). Headway watches anything at {threshold} or above.',
    hi: '{count} फ़ीडबैक में से {negative} नकारात्मक हैं ({share})। Headway {threshold} या उससे ज़्यादा की किसी भी बात पर नज़र रखता है।',
    mr: '{count} फीडबॅकपैकी {negative} नकारात्मक आहेत ({share}). Headway {threshold} किंवा त्याहून जास्त असलेल्या कोणत्याही गोष्टीवर लक्ष ठेवतो.',
  },

  /** `{theme}` is a pack label. It arrives as data and is never translated here. */
  'intelligence.health.signal.recurring_issue.label': {
    en: 'Recurring problem: {theme}',
    hi: 'बार-बार आ रही समस्या: {theme}',
    mr: 'वारंवार येणारी अडचण: {theme}',
  },
  'intelligence.health.signal.severe_issue.detail.one': {
    en: 'Mentioned in {mentions} of {count} feedback entry — at or above the {needed} needed to call it a pattern, and a serious complaint for this kind of business.',
    hi: '{count} फ़ीडबैक में से {mentions} में इसका ज़िक्र है — इसे पैटर्न कहने के लिए जो {needed} चाहिए, उतना या उससे ज़्यादा, और इस तरह के बिज़नेस के लिए यह गंभीर शिकायत है।',
    mr: '{count} फीडबॅकपैकी {mentions} मध्ये याचा उल्लेख आहे — याला पॅटर्न म्हणण्यासाठी जे {needed} लागतात, तितकं किंवा त्याहून जास्त, आणि अशा व्यवसायासाठी ही गंभीर तक्रार आहे.',
  },
  'intelligence.health.signal.severe_issue.detail.other': {
    en: 'Mentioned in {mentions} of {count} feedback entries — at or above the {needed} needed to call it a pattern, and a serious complaint for this kind of business.',
    hi: '{count} फ़ीडबैक में से {mentions} में इसका ज़िक्र है — इसे पैटर्न कहने के लिए जो {needed} चाहिए, उतना या उससे ज़्यादा, और इस तरह के बिज़नेस के लिए यह गंभीर शिकायत है।',
    mr: '{count} फीडबॅकपैकी {mentions} मध्ये याचा उल्लेख आहे — याला पॅटर्न म्हणण्यासाठी जे {needed} लागतात, तितकं किंवा त्याहून जास्त, आणि अशा व्यवसायासाठी ही गंभीर तक्रार आहे.',
  },
  'intelligence.health.signal.recurring_issue.detail.one': {
    en: 'Mentioned in {mentions} of {count} feedback entry, at or above the {needed} needed to call it a pattern.',
    hi: '{count} फ़ीडबैक में से {mentions} में इसका ज़िक्र है, इसे पैटर्न कहने के लिए जो {needed} चाहिए, उतना या उससे ज़्यादा।',
    mr: '{count} फीडबॅकपैकी {mentions} मध्ये याचा उल्लेख आहे, याला पॅटर्न म्हणण्यासाठी जे {needed} लागतात, तितकं किंवा त्याहून जास्त.',
  },
  'intelligence.health.signal.recurring_issue.detail.other': {
    en: 'Mentioned in {mentions} of {count} feedback entries, at or above the {needed} needed to call it a pattern.',
    hi: '{count} फ़ीडबैक में से {mentions} में इसका ज़िक्र है, इसे पैटर्न कहने के लिए जो {needed} चाहिए, उतना या उससे ज़्यादा।',
    mr: '{count} फीडबॅकपैकी {mentions} मध्ये याचा उल्लेख आहे, याला पॅटर्न म्हणण्यासाठी जे {needed} लागतात, तितकं किंवा त्याहून जास्त.',
  },

  'intelligence.health.signal.rating_drop_attention.label': {
    en: 'Rating fell',
    hi: 'रेटिंग गिरी',
    mr: 'रेटिंग घसरली',
  },
  'intelligence.health.signal.rating_drop_attention.detail': {
    en: 'Rating went from {previous} to {current} ({delta}). Headway flags a fall of {threshold} or more.',
    hi: 'रेटिंग {previous} से {current} हो गई ({delta})। Headway {threshold} या उससे ज़्यादा की गिरावट को चिह्नित करता है।',
    mr: 'रेटिंग {previous} वरून {current} झाली ({delta}). Headway {threshold} किंवा त्याहून जास्त घसरण चिन्हांकित करतो.',
  },
  'intelligence.health.signal.rating_drop_watch.label': {
    en: 'Rating slipping',
    hi: 'रेटिंग खिसक रही है',
    mr: 'रेटिंग घसरत आहे',
  },
  'intelligence.health.signal.rating_drop_watch.detail': {
    en: 'Rating went from {previous} to {current} ({delta}).',
    hi: 'रेटिंग {previous} से {current} हो गई ({delta})।',
    mr: 'रेटिंग {previous} वरून {current} झाली ({delta}).',
  },

  'intelligence.health.signal.reply_gap_attention.label': {
    en: 'Most public reviews have no reply',
    hi: 'ज़्यादातर सार्वजनिक रिव्यू का कोई जवाब नहीं',
    mr: 'बहुतेक सार्वजनिक रिव्ह्यूंना उत्तर नाही',
  },
  'intelligence.health.signal.reply_gap_attention.detail': {
    en: '{unanswered} of {total} public reviews have no reply ({share}). Headway flags {threshold} or more.',
    hi: '{total} सार्वजनिक रिव्यू में से {unanswered} का कोई जवाब नहीं है ({share})। Headway {threshold} या उससे ज़्यादा को चिह्नित करता है।',
    mr: '{total} सार्वजनिक रिव्ह्यूंपैकी {unanswered} ना उत्तर नाही ({share}). Headway {threshold} किंवा त्याहून जास्त चिन्हांकित करतो.',
  },
  /**
   * A level, not a direction: the share at this check-in only. The old
   * "backlog building" claimed a movement nothing here measures.
   */
  'intelligence.health.signal.reply_gap_watch.label': {
    en: 'Some public reviews have no reply',
    hi: 'कुछ सार्वजनिक रिव्यू का कोई जवाब नहीं',
    mr: 'काही सार्वजनिक रिव्ह्यूंना उत्तर नाही',
  },
  'intelligence.health.signal.reply_gap_watch.detail': {
    en: '{unanswered} of {total} public reviews have no reply ({share}). Headway watches {threshold} or more.',
    hi: '{total} सार्वजनिक रिव्यू में से {unanswered} का कोई जवाब नहीं है ({share})। Headway {threshold} या उससे ज़्यादा पर नज़र रखता है।',
    mr: '{total} सार्वजनिक रिव्ह्यूंपैकी {unanswered} ना उत्तर नाही ({share}). Headway {threshold} किंवा त्याहून जास्त असल्यास लक्ष ठेवतो.',
  },

  'intelligence.health.signal.stale_attention.label': {
    en: 'Last check-in is out of date',
    hi: 'पिछला चेक-इन पुराना हो चुका है',
    mr: 'शेवटचं चेक-इन जुनं झालं आहे',
  },
  /** Says what the card describes, so nobody reads it as today's position. */
  'intelligence.health.signal.stale_attention.detail': {
    en: 'The last check-in was {days} days ago, past the {limit}-day limit. This card describes then, not now.',
    hi: 'पिछला चेक-इन {days} दिन पहले हुआ था, जो {limit} दिन की सीमा से आगे है। यह कार्ड तब की बात बताता है, अभी की नहीं।',
    mr: 'शेवटचं चेक-इन {days} दिवसांपूर्वी झालं होतं, जे {limit} दिवसांच्या मर्यादेपलीकडे आहे. हे कार्ड तेव्हाची स्थिती सांगतं, आत्ताची नाही.',
  },
  'intelligence.health.signal.stale_watch.label': {
    en: 'Check-in due',
    hi: 'चेक-इन बाकी है',
    mr: 'चेक-इन बाकी आहे',
  },
  'intelligence.health.signal.stale_watch.detail': {
    en: 'The last check-in was {days} days ago, past the {limit}-day mark.',
    hi: 'पिछला चेक-इन {days} दिन पहले हुआ था, जो {limit} दिन के निशान से आगे है।',
    mr: 'शेवटचं चेक-इन {days} दिवसांपूर्वी झालं होतं, जे {limit} दिवसांच्या टप्प्यापलीकडे आहे.',
  },

  'intelligence.health.signal.low_velocity.label': {
    en: 'Almost no new public reviews',
    hi: 'नए सार्वजनिक रिव्यू लगभग नहीं आ रहे',
    mr: 'नवीन सार्वजनिक रिव्ह्यू जवळजवळ येत नाहीत',
  },
  'intelligence.health.signal.low_velocity.detail': {
    en: '{perWeek} public reviews a week at the last check-in, below the {expected} Headway expects. The print kit and staff asking customers for a review are what change this.',
    hi: 'पिछले चेक-इन पर हफ़्ते में {perWeek} सार्वजनिक रिव्यू, जो Headway की उम्मीद के {expected} से कम है। प्रिंट किट और स्टाफ़ का ग्राहकों से रिव्यू माँगना — यही इसे बदलते हैं।',
    mr: 'शेवटच्या चेक-इनला आठवड्याला {perWeek} सार्वजनिक रिव्ह्यू, जे Headway ला अपेक्षित असलेल्या {expected} पेक्षा कमी आहे. प्रिंट किट आणि कर्मचाऱ्यांनी ग्राहकांना रिव्ह्यू मागणं — हेच हे बदलतं.',
  },

  // --- how much has been recorded, over how long ----------------------------
  'intelligence.health.coverage.none': {
    en: 'No check-ins have been saved for this client yet.',
    hi: 'इस क्लाइंट के लिए अभी तक कोई चेक-इन सेव नहीं हुआ है।',
    mr: 'या क्लायंटसाठी अजून कोणतंही चेक-इन सेव्ह झालेलं नाही.',
  },
  'intelligence.health.coverage.single.one': {
    en: 'One check-in, covering the day it was taken. {count} feedback entry.',
    hi: 'एक चेक-इन, जिस दिन लिया गया उसी दिन का। {count} फ़ीडबैक।',
    mr: 'एक चेक-इन, ज्या दिवशी घेतलं त्याच दिवसाचं. {count} फीडबॅक.',
  },
  'intelligence.health.coverage.single.other': {
    en: 'One check-in, covering the day it was taken. {count} feedback entries.',
    hi: 'एक चेक-इन, जिस दिन लिया गया उसी दिन का। {count} फ़ीडबैक।',
    mr: 'एक चेक-इन, ज्या दिवशी घेतलं त्याच दिवसाचं. {count} फीडबॅक.',
  },
  'intelligence.health.coverage.many.one': {
    en: '{checkins} check-ins over {days} days. {count} feedback entry.',
    hi: '{days} दिनों में {checkins} चेक-इन। {count} फ़ीडबैक।',
    mr: '{days} दिवसांत {checkins} चेक-इन. {count} फीडबॅक.',
  },
  'intelligence.health.coverage.many.other': {
    en: '{checkins} check-ins over {days} days. {count} feedback entries.',
    hi: '{days} दिनों में {checkins} चेक-इन। {count} फ़ीडबैक।',
    mr: '{days} दिवसांत {checkins} चेक-इन. {count} फीडबॅक.',
  },

  // --- the one line under the status ----------------------------------------
  'intelligence.health.summary.no_checkin': {
    en: 'No check-in yet. Take the first one to give this client a health status.',
    hi: 'अभी तक कोई चेक-इन नहीं। इस क्लाइंट को हेल्थ स्टेटस देने के लिए पहला चेक-इन करें।',
    mr: 'अजून कोणतंही चेक-इन नाही. या क्लायंटला हेल्थ स्टेटस देण्यासाठी पहिलं चेक-इन करा.',
  },
  'intelligence.health.summary.nothing_to_judge': {
    en: 'The last check-in has no rating and no feedback, so there is nothing to judge.',
    hi: 'पिछले चेक-इन में न रेटिंग है न फ़ीडबैक, इसलिए आँकने के लिए कुछ नहीं है।',
    mr: 'शेवटच्या चेक-इनमध्ये रेटिंगही नाही आणि फीडबॅकही नाही, त्यामुळे मूल्यमापन करण्यासारखं काही नाही.',
  },
  /**
   * Healthy names its two inputs on purpose: nothing fired in what Headway
   * holds, which is not the same claim as the business being fine. All three
   * languages keep both halves.
   */
  'intelligence.health.summary.healthy.one': {
    en: 'Nothing in the feedback or the listing figures is a problem right now. That is {count} feedback entry and the figures from the last check-in.',
    hi: 'फ़ीडबैक या लिस्टिंग के आँकड़ों में अभी कोई समस्या नहीं है। यह {count} फ़ीडबैक और पिछले चेक-इन के आँकड़ों पर आधारित है।',
    mr: 'फीडबॅकमध्ये किंवा लिस्टिंगच्या आकड्यांमध्ये सध्या कोणतीही अडचण नाही. हे {count} फीडबॅक आणि शेवटच्या चेक-इनच्या आकड्यांवर आधारित आहे.',
  },
  'intelligence.health.summary.healthy.other': {
    en: 'Nothing in the feedback or the listing figures is a problem right now. That is {count} feedback entries and the figures from the last check-in.',
    hi: 'फ़ीडबैक या लिस्टिंग के आँकड़ों में अभी कोई समस्या नहीं है। यह {count} फ़ीडबैक और पिछले चेक-इन के आँकड़ों पर आधारित है।',
    mr: 'फीडबॅकमध्ये किंवा लिस्टिंगच्या आकड्यांमध्ये सध्या कोणतीही अडचण नाही. हे {count} फीडबॅक आणि शेवटच्या चेक-इनच्या आकड्यांवर आधारित आहे.',
  },
  /** `{labels}` is the list of signals that fired, already lowercased. */
  'intelligence.health.summary.flagged.one': {
    en: 'Headway flagged {count} thing: {labels}.',
    hi: 'Headway ने {count} बात चिह्नित की: {labels}।',
    mr: 'Headway ने {count} गोष्ट चिन्हांकित केली: {labels}.',
  },
  'intelligence.health.summary.flagged.other': {
    en: 'Headway flagged {count} things: {labels}.',
    hi: 'Headway ने {count} बातें चिह्नित कीं: {labels}।',
    mr: 'Headway ने {count} गोष्टी चिन्हांकित केल्या: {labels}.',
  },

  // --- the pulse: one check-in against the one before it --------------------
  'intelligence.health.pulse.no_checkin': {
    en: 'No check-in recorded yet. Once two are on record, Headway can say which way things are moving.',
    hi: 'अभी तक कोई चेक-इन दर्ज नहीं हुआ। जब दो दर्ज हो जाएँगे, तब Headway बता सकेगा कि चीज़ें किस दिशा में जा रही हैं।',
    mr: 'अजून कोणतंही चेक-इन नोंदवलेलं नाही. दोन नोंदवली गेली की गोष्टी कोणत्या दिशेने चालल्या आहेत हे Headway सांगू शकेल.',
  },
  'intelligence.health.pulse.one_checkin': {
    en: 'Only one check-in so far. The next one will let Headway compare the two.',
    hi: 'अभी तक सिर्फ़ एक चेक-इन। अगला चेक-इन होने पर Headway दोनों की तुलना कर सकेगा।',
    mr: 'आतापर्यंत फक्त एकच चेक-इन. पुढचं चेक-इन झाल्यावर Headway दोघांची तुलना करू शकेल.',
  },
  /** Both labels are dates or the operator's own check-in label: data. */
  'intelligence.health.pulse.comparing': {
    en: 'Comparing {previous} with {current}.',
    hi: '{previous} की तुलना {current} से की जा रही है।',
    mr: '{previous} ची तुलना {current} शी केली जात आहे.',
  },
  'intelligence.health.pulse.count_note.one': {
    en: '{previousCount} → {count} mention',
    hi: '{previousCount} → {count} ज़िक्र',
    mr: '{previousCount} → {count} उल्लेख',
  },
  'intelligence.health.pulse.count_note.other': {
    en: '{previousCount} → {count} mentions',
    hi: '{previousCount} → {count} ज़िक्र',
    mr: '{previousCount} → {count} उल्लेख',
  },
  /**
   * The small-sample caveat. It must keep saying that these are counts and NOT
   * a pattern — the sentence that stops "1 to 3" being read as a trend — with
   * the same force in every language.
   */
  'intelligence.health.pulse.small_numbers.one': {
    en: 'Small numbers: {count} feedback entry at the earlier check-in and {currentCount} at the later one. Headway needs {needed} on each side before it calls a change a trend — read these as counts, not a pattern.',
    hi: 'छोटे आँकड़े: पहले वाले चेक-इन पर {count} फ़ीडबैक और बाद वाले पर {currentCount}। किसी बदलाव को रुझान कहने से पहले Headway को हर तरफ़ {needed} चाहिए — इन्हें गिनती की तरह पढ़ें, पैटर्न की तरह नहीं।',
    mr: 'छोटे आकडे: आधीच्या चेक-इनला {count} फीडबॅक आणि नंतरच्याला {currentCount}. एखाद्या बदलाला कल म्हणण्यापूर्वी Headway ला प्रत्येक बाजूला {needed} लागतात — हे आकडे म्हणून वाचा, पॅटर्न म्हणून नाही.',
  },
  'intelligence.health.pulse.small_numbers.other': {
    en: 'Small numbers: {count} feedback entries at the earlier check-in and {currentCount} at the later one. Headway needs {needed} on each side before it calls a change a trend — read these as counts, not a pattern.',
    hi: 'छोटे आँकड़े: पहले वाले चेक-इन पर {count} फ़ीडबैक और बाद वाले पर {currentCount}। किसी बदलाव को रुझान कहने से पहले Headway को हर तरफ़ {needed} चाहिए — इन्हें गिनती की तरह पढ़ें, पैटर्न की तरह नहीं।',
    mr: 'छोटे आकडे: आधीच्या चेक-इनला {count} फीडबॅक आणि नंतरच्याला {currentCount}. एखाद्या बदलाला कल म्हणण्यापूर्वी Headway ला प्रत्येक बाजूला {needed} लागतात — हे आकडे म्हणून वाचा, पॅटर्न म्हणून नाही.',
  },
} satisfies Namespace;
