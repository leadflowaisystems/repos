import type { Namespace } from '../t';

/**
 * Feedback and Customers view-models: filters, counts, empty states (src/lib/portal/pages.ts, history.ts)
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
 * A PACK LABEL IS DATA. "long waiting time", "doctor's care and explanation"
 * and the business's own name arrive as values from packs/*.json and the
 * database, and are interpolated exactly as they came. They are not translated
 * here, and neither is anything a customer wrote.
 */
export const evidence = {
  // -------------------------------------------------------------------------
  // Small pieces the sentences below are built from.
  //
  // Two only: the conjunction that ends a list of pack labels, and the count
  // of feedback entries. Both are needed because the thing they join is data
  // of unknown length — everything else on this page is a whole sentence.
  // -------------------------------------------------------------------------
  'evidence.list.pair': {
    en: '{rest} and {last}',
    hi: '{rest} और {last}',
    mr: '{rest} आणि {last}',
  },
  'evidence.pieces.one': {
    en: '{count} feedback entry',
    hi: '{count} फ़ीडबैक',
    mr: '{count} फीडबॅक',
  },
  'evidence.pieces.other': {
    en: '{count} feedback entries',
    hi: '{count} फ़ीडबैक',
    mr: '{count} फीडबॅक',
  },

  // -------------------------------------------------------------------------
  // CUSTOMERS — the interpretation the page opens with.
  // -------------------------------------------------------------------------
  'evidence.telling.keep.recurring': {
    en: 'Customers keep praising your {theme}.',
    hi: 'ग्राहक लगातार आपके {theme} की तारीफ़ करते हैं।',
    mr: 'ग्राहक सतत तुमच्या {theme} चं कौतुक करतात.',
  },
  'evidence.telling.keep.top': {
    en: 'Customers praise your {theme} most.',
    hi: 'ग्राहक सबसे ज़्यादा आपके {theme} की तारीफ़ करते हैं।',
    mr: 'ग्राहक सर्वात जास्त तुमच्या {theme} चं कौतुक करतात.',
  },
  // Its own short sentence, not glued on with ", though …": the disagreement
  // is a separate fact and reads as one.
  'evidence.telling.opposite.one': {
    en: 'But {count} comment said the opposite.',
    hi: 'लेकिन {count} कॉमेंट में इसका उलटा कहा गया है।',
    mr: 'पण {count} कॉमेंटमध्ये याच्या उलट म्हटलं आहे.',
  },
  'evidence.telling.opposite.other': {
    en: 'But {count} comments said the opposite.',
    hi: 'लेकिन {count} कॉमेंट में इसका उलटा कहा गया है।',
    mr: 'पण {count} कॉमेंटमध्ये याच्या उलट म्हटलं आहे.',
  },
  'evidence.telling.others': {
    en: 'Customers also praise your {things} often.',
    hi: 'ग्राहक अक्सर आपके {things} की भी तारीफ़ करते हैं।',
    mr: 'ग्राहक अनेकदा तुमच्या {things} चंही कौतुक करतात.',
  },
  // Praise that has not cleared the floor. The qualifier is the point of the
  // sentence and survives whole: not yet often enough to be called a strength.
  'evidence.telling.early.one': {
    en: 'Customers praise your {things}. It has not come up often enough yet to call it a strength.',
    hi: 'ग्राहक आपके {things} की तारीफ़ करते हैं। यह अभी इतनी बार नहीं आया है कि इसे आपकी ताक़त कहा जा सके।',
    mr: 'ग्राहक तुमच्या {things} चं कौतुक करतात. हे अजून इतक्या वेळा आलेलं नाही की याला तुमची ताकद म्हणता येईल.',
  },
  'evidence.telling.early.other': {
    en: 'Customers praise your {things}. They have not come up often enough yet to call them a strength.',
    hi: 'ग्राहक आपके {things} की तारीफ़ करते हैं। ये अभी इतनी बार नहीं आए हैं कि इन्हें आपकी ताक़त कहा जा सके।',
    mr: 'ग्राहक तुमच्या {things} चं कौतुक करतात. ही अजून इतक्या वेळा आलेली नाहीत की यांना तुमची ताकद म्हणता येईल.',
  },
  'evidence.telling.first': {
    en: 'Headway would deal with {theme} first.',
    hi: 'हेडवे सबसे पहले {theme} पर काम करेगा।',
    mr: 'हेडवे सर्वात आधी {theme} वर काम करेल.',
  },
  'evidence.telling.noWeakness': {
    en: 'No complaint has come up often enough to call it a weakness.',
    hi: 'कोई भी शिकायत इतनी बार नहीं आई है कि उसे कमज़ोरी कहा जा सके।',
    mr: 'कोणतीही तक्रार इतक्या वेळा आलेली नाही की तिला कमजोरी म्हणता येईल.',
  },

  // -------------------------------------------------------------------------
  // CUSTOMERS — what cannot be said yet, and why.
  // -------------------------------------------------------------------------
  'evidence.recurrence.noCheckin': {
    en: 'You have not recorded a check-in yet. Headway cannot tell you what keeps coming back until you do.',
    hi: 'आपने अभी तक कोई चेक-इन दर्ज नहीं किया है। जब तक आप ऐसा नहीं करते, हेडवे यह नहीं बता सकता कि बार-बार क्या लौटकर आता है।',
    mr: 'तुम्ही अजून एकही चेक-इन नोंदवलेला नाही. तोपर्यंत हेडवे तुम्हाला काय पुन्हा पुन्हा येतं हे सांगू शकत नाही.',
  },
  'evidence.recurrence.oneCheckin': {
    en: 'You have only one check-in so far. After your next one, Headway can tell you what keeps coming back and what is new.',
    hi: 'अभी आपके पास सिर्फ़ एक चेक-इन है। अगले चेक-इन के बाद हेडवे बता सकेगा कि बार-बार क्या लौटकर आता है और क्या नया है।',
    mr: 'सध्या तुमच्याकडे फक्त एकच चेक-इन आहे. पुढच्या चेक-इननंतर हेडवे सांगू शकेल की काय पुन्हा पुन्हा येतं आणि काय नवीन आहे.',
  },
  'evidence.steady.none': {
    en: 'Nothing moved by 2 or more mentions between these check-ins.',
    hi: 'इन चेक-इन के बीच किसी भी चीज़ में 2 या उससे ज़्यादा ज़िक्र का बदलाव नहीं हुआ।',
    mr: 'या चेक-इनदरम्यान कशातही 2 किंवा त्याहून जास्त उल्लेखांचा बदल झालेला नाही.',
  },
  'evidence.steady.with': {
    en: 'Nothing moved by 2 or more mentions between these check-ins. Your {things} held steady.',
    hi: 'इन चेक-इन के बीच किसी भी चीज़ में 2 या उससे ज़्यादा ज़िक्र का बदलाव नहीं हुआ। आपके {things} स्थिर रहे।',
    mr: 'या चेक-इनदरम्यान कशातही 2 किंवा त्याहून जास्त उल्लेखांचा बदल झालेला नाही. तुमचे {things} स्थिर राहिले.',
  },

  // -------------------------------------------------------------------------
  // IMPROVEMENTS — the record line, and the two states before there is one.
  //
  // The pieces are joined with " · " because they are separate facts about the
  // same set of changes, not a clause each. Each is a whole key.
  // -------------------------------------------------------------------------
  'evidence.record.compared.one': {
    en: '{count} change compared',
    hi: '{count} बदलाव की तुलना की गई',
    mr: '{count} बदलाची तुलना केली',
  },
  'evidence.record.compared.other': {
    en: '{count} changes compared',
    hi: '{count} बदलावों की तुलना की गई',
    mr: '{count} बदलांची तुलना केली',
  },
  'evidence.record.better.single': {
    en: 'mentioned less often after the change',
    hi: 'बदलाव के बाद कम बार ज़िक्र हुआ',
    mr: 'बदलानंतर कमी वेळा उल्लेख झाला',
  },
  'evidence.record.better.many': {
    en: 'mentioned less often after {count} of them',
    hi: 'उनमें से {count} के बाद कम बार ज़िक्र हुआ',
    mr: 'त्यांपैकी {count} नंतर कमी वेळा उल्लेख झाला',
  },
  'evidence.record.worse.single': {
    en: 'mentioned more often after the change',
    hi: 'बदलाव के बाद ज़्यादा बार ज़िक्र हुआ',
    mr: 'बदलानंतर जास्त वेळा उल्लेख झाला',
  },
  'evidence.record.worse.many': {
    en: 'mentioned more often after {count} of them',
    hi: 'उनमें से {count} के बाद ज़्यादा बार ज़िक्र हुआ',
    mr: 'त्यांपैकी {count} नंतर जास्त वेळा उल्लेख झाला',
  },
  'evidence.record.noChange': {
    en: 'You have not agreed to any change yet.',
    hi: 'आपने अभी तक किसी बदलाव पर हाँ नहीं कही है।',
    mr: 'तुम्ही अजून कोणत्याही बदलाला होकार दिलेला नाही.',
  },
  'evidence.record.noComparison': {
    en: 'Headway has not compared any change with later feedback yet.',
    hi: 'हेडवे ने अभी तक किसी बदलाव की तुलना बाद के फ़ीडबैक से नहीं की है।',
    mr: 'हेडवेने अजून कोणत्याही बदलाची तुलना नंतरच्या फीडबॅकशी केलेली नाही.',
  },

  // -------------------------------------------------------------------------
  // FEEDBACK — the active filters, said back as one line.
  //
  // The owner's own search words are a value. They are quoted and passed
  // through exactly as typed, in every language.
  // -------------------------------------------------------------------------
  'evidence.filter.theme': {
    en: 'about {theme}',
    hi: '{theme} के बारे में',
    mr: '{theme} बद्दल',
  },
  'evidence.filter.stars.one': {
    en: 'rated {count} star',
    hi: '{count} स्टार रेटिंग वाले',
    mr: '{count} स्टार रेटिंग असलेले',
  },
  'evidence.filter.stars.other': {
    en: 'rated {count} stars',
    hi: '{count} स्टार रेटिंग वाले',
    mr: '{count} स्टार रेटिंग असलेले',
  },
  'evidence.filter.needsReply': {
    en: 'that need your answer',
    hi: 'जिनका जवाब आपको देना है',
    mr: 'ज्यांना तुमचं उत्तर हवं आहे',
  },
  'evidence.filter.mentioning': {
    en: 'mentioning "{query}"',
    hi: 'जिनमें "{query}" का ज़िक्र है',
    mr: 'ज्यांत "{query}" चा उल्लेख आहे',
  },

  // -------------------------------------------------------------------------
  // FEEDBACK — how a row was read.
  //
  // The four tones come from `feedback.tone.*`, which the filter chips already
  // use, so a chip and the row beneath it can never disagree. Only the two
  // words that had no key yet live here.
  // -------------------------------------------------------------------------
  'evidence.tone.unread': {
    en: 'Not read yet',
    hi: 'अभी पढ़ा नहीं गया',
    mr: 'अजून वाचलेलं नाही',
  },
  'evidence.class.praise': {
    en: 'Praise',
    hi: 'तारीफ़',
    mr: 'कौतुक',
  },
  'evidence.class.complaint': {
    en: 'Complaint',
    hi: 'शिकायत',
    mr: 'तक्रार',
  },
  'evidence.class.mixed': {
    en: 'Mixed',
    hi: 'मिला-जुला',
    mr: 'संमिश्र',
  },
  'evidence.class.question': {
    en: 'Question',
    hi: 'सवाल',
    mr: 'प्रश्न',
  },
  'evidence.class.neutral': {
    en: 'General comment',
    hi: 'सामान्य कॉमेंट',
    mr: 'सर्वसाधारण कॉमेंट',
  },

  // -------------------------------------------------------------------------
  // FEEDBACK — what Headway found, so reading the pile is optional.
  // Every count names its own pile, in every language.
  // -------------------------------------------------------------------------
  'evidence.found.read': {
    en: 'Headway has read all {entries}: {positive} positive, {mixed} mixed, {neutral} neutral, {negative} negative.',
    hi: 'हेडवे ने सारे {entries} पढ़ लिए हैं: {positive} सकारात्मक, {mixed} मिला-जुला, {neutral} सामान्य, {negative} नकारात्मक।',
    mr: 'हेडवेने सर्व {entries} वाचले आहेत: {positive} सकारात्मक, {mixed} संमिश्र, {neutral} सामान्य, {negative} नकारात्मक.',
  },
  'evidence.found.praiseTwo': {
    en: 'Customers praise two things most: your {first}, and your {second}.',
    hi: 'ग्राहक सबसे ज़्यादा दो चीज़ों की तारीफ़ करते हैं: आपके {first}, और आपके {second}।',
    mr: 'ग्राहक सर्वात जास्त दोन गोष्टींचं कौतुक करतात: तुमच्या {first}, आणि तुमच्या {second}.',
  },
  'evidence.found.praiseOne': {
    en: 'Customers praise your {first} most.',
    hi: 'ग्राहक सबसे ज़्यादा आपके {first} की तारीफ़ करते हैं।',
    mr: 'ग्राहक सर्वात जास्त तुमच्या {first} चं कौतुक करतात.',
  },
  'evidence.found.attention': {
    en: 'Headway would deal with {theme} first. {count} of {outOf} comments mention it.',
    hi: 'हेडवे सबसे पहले {theme} पर काम करेगा। {outOf} में से {count} कॉमेंट में इसका ज़िक्र है।',
    mr: 'हेडवे सर्वात आधी {theme} वर काम करेल. {outOf} पैकी {count} कॉमेंटमध्ये याचा उल्लेख आहे.',
  },
  'evidence.found.noPattern': {
    en: 'No complaint is a pattern yet. None has come up {min} or more times.',
    hi: 'अभी कोई भी शिकायत पैटर्न नहीं बनी है। कोई भी {min} या उससे ज़्यादा बार नहीं आई है।',
    mr: 'अजून कोणतीही तक्रार पॅटर्न बनलेली नाही. कोणतीही {min} किंवा त्याहून जास्त वेळा आलेली नाही.',
  },
  'evidence.found.reply.one': {
    en: '{count} of {entries} needs an answer from you. Headway has written a draft reply where it could do so safely. The ones without a draft need your own words.',
    hi: '{entries} में से {count} का जवाब आपको देना है। जहाँ हेडवे सुरक्षित तरीक़े से ऐसा कर सका, वहाँ उसने जवाब का ड्राफ़्ट लिख दिया है। जिनमें ड्राफ़्ट नहीं है, उनके लिए आपके अपने शब्द चाहिए।',
    mr: '{entries}पैकी {count} ना तुमचं उत्तर हवं आहे. जिथे हेडवेला सुरक्षितपणे शक्य होतं तिथे त्याने उत्तराचा ड्राफ्ट लिहिला आहे. ज्यांना ड्राफ्ट नाही त्यांसाठी तुमचे स्वतःचे शब्द हवेत.',
  },
  'evidence.found.reply.other': {
    en: '{count} of {entries} need an answer from you. Headway has written a draft reply where it could do so safely. The ones without a draft need your own words.',
    hi: '{entries} में से {count} का जवाब आपको देना है। जहाँ हेडवे सुरक्षित तरीक़े से ऐसा कर सका, वहाँ उसने जवाब का ड्राफ़्ट लिख दिया है। जिनमें ड्राफ़्ट नहीं है, उनके लिए आपके अपने शब्द चाहिए।',
    mr: '{entries}पैकी {count} ना तुमचं उत्तर हवं आहे. जिथे हेडवेला सुरक्षितपणे शक्य होतं तिथे त्याने उत्तराचा ड्राफ्ट लिहिला आहे. ज्यांना ड्राफ्ट नाही त्यांसाठी तुमचे स्वतःचे शब्द हवेत.',
  },

  // -------------------------------------------------------------------------
  // FEEDBACK — the conclusions as one-tap filters.
  // -------------------------------------------------------------------------
  'evidence.quick.theme': {
    en: '{theme} ({count} comments)',
    hi: '{theme} ({count} कॉमेंट)',
    mr: '{theme} ({count} कॉमेंट)',
  },
  'evidence.quick.positive': {
    en: 'All positive ({count})',
    hi: 'सारे सकारात्मक ({count})',
    mr: 'सर्व सकारात्मक ({count})',
  },
  'evidence.quick.negative': {
    en: 'All negative ({count})',
    hi: 'सारे नकारात्मक ({count})',
    mr: 'सर्व नकारात्मक ({count})',
  },
  'evidence.quick.needsReply': {
    en: 'Need your answer ({count} of {total})',
    hi: 'आपके जवाब की ज़रूरत ({total} में से {count})',
    mr: 'तुमचं उत्तर हवं ({total} पैकी {count})',
  },

  // -------------------------------------------------------------------------
  // CHECK-IN — movement only, since the last one.
  // -------------------------------------------------------------------------
  'evidence.checkin.better.one': {
    en: '{count} thing is getting better',
    hi: '{count} चीज़ बेहतर हो रही है',
    mr: '{count} गोष्ट चांगली होत आहे',
  },
  'evidence.checkin.better.other': {
    en: '{count} things are getting better',
    hi: '{count} चीज़ें बेहतर हो रही हैं',
    mr: '{count} गोष्टी चांगल्या होत आहेत',
  },
  'evidence.checkin.worse.one': {
    en: '{count} thing is getting worse',
    hi: '{count} चीज़ ख़राब हो रही है',
    mr: '{count} गोष्ट वाईट होत आहे',
  },
  'evidence.checkin.worse.other': {
    en: '{count} things are getting worse',
    hi: '{count} चीज़ें ख़राब हो रही हैं',
    mr: '{count} गोष्टी वाईट होत आहेत',
  },
  'evidence.checkin.compared.one': {
    en: '{count} change was compared',
    hi: '{count} बदलाव की तुलना की गई',
    mr: '{count} बदलाची तुलना केली',
  },
  'evidence.checkin.compared.other': {
    en: '{count} changes were compared',
    hi: '{count} बदलावों की तुलना की गई',
    mr: '{count} बदलांची तुलना केली',
  },
  'evidence.checkin.since': {
    en: 'Since your check-in on {date}: {bits}.',
    hi: '{date} के आपके चेक-इन के बाद से: {bits}।',
    mr: '{date} रोजीच्या तुमच्या चेक-इननंतर: {bits}.',
  },
  'evidence.checkin.nothing': {
    en: 'Nothing moved enough to report since your check-in on {date}.',
    hi: '{date} के आपके चेक-इन के बाद से बताने लायक़ कोई बदलाव नहीं हुआ।',
    mr: '{date} रोजीच्या तुमच्या चेक-इननंतर सांगण्यासारखा कोणताही बदल झालेला नाही.',
  },
  // The honest limit on the comparison. It says what could NOT be compared and
  // why, and it says exactly that in all three languages.
  'evidence.checkin.notCompared.one': {
    en: 'Headway could not compare {count} topic. It had too few mentions at one of the two check-ins.',
    hi: 'हेडवे {count} विषय की तुलना नहीं कर सका। दोनों में से किसी एक चेक-इन पर उसके ज़िक्र बहुत कम थे।',
    mr: 'हेडवेला {count} विषयाची तुलना करता आली नाही. दोन चेक-इनपैकी एकावर त्याचे उल्लेख फार कमी होते.',
  },
  'evidence.checkin.notCompared.other': {
    en: 'Headway could not compare {count} topics. They had too few mentions at one of the two check-ins.',
    hi: 'हेडवे {count} विषयों की तुलना नहीं कर सका। दोनों में से किसी एक चेक-इन पर उनके ज़िक्र बहुत कम थे।',
    mr: 'हेडवेला {count} विषयांची तुलना करता आली नाही. दोन चेक-इनपैकी एकावर त्यांचे उल्लेख फार कमी होते.',
  },
  'evidence.checkin.steady': {
    en: 'Everything else Headway could compare held steady.',
    hi: 'हेडवे जिन बाक़ी चीज़ों की तुलना कर सका, वे सब स्थिर रहीं।',
    mr: 'हेडवेला ज्या इतर गोष्टींची तुलना करता आली, त्या सर्व स्थिर राहिल्या.',
  },
  'evidence.checkin.steadyIncludes': {
    en: 'Everything else Headway could compare held steady. This includes your {things}.',
    hi: 'हेडवे जिन बाक़ी चीज़ों की तुलना कर सका, वे सब स्थिर रहीं। इनमें आपके {things} शामिल हैं।',
    mr: 'हेडवेला ज्या इतर गोष्टींची तुलना करता आली, त्या सर्व स्थिर राहिल्या. यात तुमच्या {things} चा समावेश आहे.',
  },
  'evidence.checkin.title': {
    en: '{month} check-in',
    hi: '{month} का चेक-इन',
    mr: '{month} महिन्याचा चेक-इन',
  },
  'evidence.checkin.noneTitle': {
    en: 'No check-in yet',
    hi: 'अभी कोई चेक-इन नहीं',
    mr: 'अजून कोणताही चेक-इन नाही',
  },
  'evidence.period.compares': {
    en: 'This compares your check-in on {latest} with your check-in on {previous}.',
    hi: 'यह {latest} के आपके चेक-इन की तुलना {previous} के आपके चेक-इन से करता है।',
    mr: 'हे {latest} रोजीच्या तुमच्या चेक-इनची तुलना {previous} रोजीच्या तुमच्या चेक-इनशी करतं.',
  },
  'evidence.period.single': {
    en: 'This uses your check-in on {latest}. A second check-in will show what changed.',
    hi: 'यह {latest} के आपके चेक-इन का इस्तेमाल करता है। दूसरा चेक-इन दिखाएगा कि क्या बदला।',
    mr: 'हे {latest} रोजीच्या तुमच्या चेक-इनवर आधारित आहे. दुसरा चेक-इन काय बदललं ते दाखवेल.',
  },
  'evidence.period.all': {
    en: 'This covers everything Headway has read so far.',
    hi: 'इसमें वह सब कुछ शामिल है जो हेडवे ने अब तक पढ़ा है।',
    mr: 'यात हेडवेने आतापर्यंत वाचलेलं सर्व काही समाविष्ट आहे.',
  },

  // The month a check-in is named after. A word in a title, not a date: the
  // dates themselves are printed by `formatDate` and are never touched.
  'evidence.month.1': { en: 'January', hi: 'जनवरी', mr: 'जानेवारी' },
  'evidence.month.2': { en: 'February', hi: 'फ़रवरी', mr: 'फेब्रुवारी' },
  'evidence.month.3': { en: 'March', hi: 'मार्च', mr: 'मार्च' },
  'evidence.month.4': { en: 'April', hi: 'अप्रैल', mr: 'एप्रिल' },
  'evidence.month.5': { en: 'May', hi: 'मई', mr: 'मे' },
  'evidence.month.6': { en: 'June', hi: 'जून', mr: 'जून' },
  'evidence.month.7': { en: 'July', hi: 'जुलाई', mr: 'जुलै' },
  'evidence.month.8': { en: 'August', hi: 'अगस्त', mr: 'ऑगस्ट' },
  'evidence.month.9': { en: 'September', hi: 'सितंबर', mr: 'सप्टेंबर' },
  'evidence.month.10': { en: 'October', hi: 'अक्तूबर', mr: 'ऑक्टोबर' },
  'evidence.month.11': { en: 'November', hi: 'नवंबर', mr: 'नोव्हेंबर' },
  'evidence.month.12': { en: 'December', hi: 'दिसंबर', mr: 'डिसेंबर' },

  // -------------------------------------------------------------------------
  // WHAT KEEPS COMING BACK (src/lib/portal/history.ts).
  //
  // The customers are the subject of the sentence and the verb is the one an
  // owner would use themselves, which is why the complaint wording and the
  // praise wording are whole separate sentences rather than one sentence with
  // a verb swapped into it — no other language would let that work.
  // -------------------------------------------------------------------------
  'evidence.recurrence.issue.repeat': {
    en: 'Customers mentioned this at {raised} of your last {total} check-ins.',
    hi: 'आपके पिछले {total} चेक-इन में से {raised} पर ग्राहकों ने इसका ज़िक्र किया।',
    mr: 'तुमच्या मागच्या {total} चेक-इनपैकी {raised} वर ग्राहकांनी याचा उल्लेख केला.',
  },
  'evidence.recurrence.praise.repeat': {
    en: 'Customers praised this at {raised} of your last {total} check-ins.',
    hi: 'आपके पिछले {total} चेक-इन में से {raised} पर ग्राहकों ने इसकी तारीफ़ की।',
    mr: 'तुमच्या मागच्या {total} चेक-इनपैकी {raised} वर ग्राहकांनी याचं कौतुक केलं.',
  },
  'evidence.recurrence.issue.new.one': {
    en: 'Customers mentioned this at your latest check-in only. They did not mention it at the one before it.',
    hi: 'ग्राहकों ने इसका ज़िक्र सिर्फ़ आपके ताज़ा चेक-इन पर किया। उससे पहले वाले चेक-इन पर उन्होंने इसका ज़िक्र नहीं किया था।',
    mr: 'ग्राहकांनी याचा उल्लेख फक्त तुमच्या ताज्या चेक-इनवर केला. त्याआधीच्या चेक-इनवर त्यांनी याचा उल्लेख केला नव्हता.',
  },
  'evidence.recurrence.issue.new.other': {
    en: 'Customers mentioned this at your latest check-in only. They did not mention it at the {count} before it.',
    hi: 'ग्राहकों ने इसका ज़िक्र सिर्फ़ आपके ताज़ा चेक-इन पर किया। उससे पहले वाले {count} चेक-इन पर उन्होंने इसका ज़िक्र नहीं किया था।',
    mr: 'ग्राहकांनी याचा उल्लेख फक्त तुमच्या ताज्या चेक-इनवर केला. त्याआधीच्या {count} चेक-इनवर त्यांनी याचा उल्लेख केला नव्हता.',
  },
  'evidence.recurrence.praise.new.one': {
    en: 'Customers praised this at your latest check-in only. They did not praise it at the one before it.',
    hi: 'ग्राहकों ने इसकी तारीफ़ सिर्फ़ आपके ताज़ा चेक-इन पर की। उससे पहले वाले चेक-इन पर उन्होंने इसकी तारीफ़ नहीं की थी।',
    mr: 'ग्राहकांनी याचं कौतुक फक्त तुमच्या ताज्या चेक-इनवर केलं. त्याआधीच्या चेक-इनवर त्यांनी याचं कौतुक केलं नव्हतं.',
  },
  'evidence.recurrence.praise.new.other': {
    en: 'Customers praised this at your latest check-in only. They did not praise it at the {count} before it.',
    hi: 'ग्राहकों ने इसकी तारीफ़ सिर्फ़ आपके ताज़ा चेक-इन पर की। उससे पहले वाले {count} चेक-इन पर उन्होंने इसकी तारीफ़ नहीं की थी।',
    mr: 'ग्राहकांनी याचं कौतुक फक्त तुमच्या ताज्या चेक-इनवर केलं. त्याआधीच्या {count} चेक-इनवर त्यांनी याचं कौतुक केलं नव्हतं.',
  },
  'evidence.recurrence.issue.faded': {
    en: 'Customers mentioned this at an earlier check-in. They did not mention it at your latest one.',
    hi: 'ग्राहकों ने इसका ज़िक्र पहले किसी चेक-इन पर किया था। आपके ताज़ा चेक-इन पर उन्होंने इसका ज़िक्र नहीं किया।',
    mr: 'ग्राहकांनी याचा उल्लेख आधीच्या एका चेक-इनवर केला होता. तुमच्या ताज्या चेक-इनवर त्यांनी याचा उल्लेख केला नाही.',
  },
  'evidence.recurrence.praise.faded': {
    en: 'Customers praised this at an earlier check-in. They did not praise it at your latest one.',
    hi: 'ग्राहकों ने इसकी तारीफ़ पहले किसी चेक-इन पर की थी। आपके ताज़ा चेक-इन पर उन्होंने इसकी तारीफ़ नहीं की।',
    mr: 'ग्राहकांनी याचं कौतुक आधीच्या एका चेक-इनवर केलं होतं. तुमच्या ताज्या चेक-इनवर त्यांनी याचं कौतुक केलं नाही.',
  },
} satisfies Namespace;
