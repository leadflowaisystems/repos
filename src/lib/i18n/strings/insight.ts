import type { Namespace } from '../t';

/**
 * The signal readings: what customers are saying, how often, and which way it is moving (src/lib/portal/view.ts)
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
 * TWO THINGS ARE NEVER TRANSLATED and arrive as placeholder values: what a
 * customer wrote, and what the packs word (a theme label, a suggestion). The
 * owner's own recorded decision is their words too, and stays theirs.
 *
 * THE CAVEATS ARE TRANSLATED AS CAREFULLY AS THE CLAIMS. "This does not show
 * the change caused the difference", "too few to be sure it is a pattern",
 * "Headway has read" — a before/after that loses its no-causation sentence in
 * Hindi is a stronger claim in Hindi than in English, which is the one thing
 * this whole layer exists to prevent.
 */
export const insight = {
  // -------------------------------------------------------------------------
  // Counting phrases
  //
  // The count carries the plural in Hindi and Marathi, so both forms of
  // "feedback" are the same word — the split exists for English and is kept
  // for all three so the key shape stays one thing.
  // -------------------------------------------------------------------------
  'insight.pieces.one': {
    en: '{count} feedback entry',
    hi: '{count} फ़ीडबैक',
    mr: '{count} फीडबॅक',
  },
  'insight.pieces.other': {
    en: '{count} feedback entries',
    hi: '{count} फ़ीडबैक',
    mr: '{count} फीडबॅक',
  },
  'insight.comments.one': {
    en: '{count} comment',
    hi: '{count} कमेंट',
    mr: '{count} कमेंट',
  },
  'insight.comments.other': {
    en: '{count} comments',
    hi: '{count} कमेंट',
    mr: '{count} कमेंट',
  },
  /** The last join in a list of theme names. The earlier ones are joined with a comma. */
  'insight.list.pair': {
    en: '{first} and {last}',
    hi: '{first} और {last}',
    mr: '{first} आणि {last}',
  },

  // -------------------------------------------------------------------------
  // Where a theme sits in the owner's attention
  // -------------------------------------------------------------------------
  'insight.bucket.FIRST': {
    en: 'Do this first',
    hi: 'यह पहले करें',
    mr: 'हे आधी करा',
  },
  'insight.bucket.KEEP': {
    en: 'Keep doing this',
    hi: 'यह करते रहें',
    mr: 'हे करत राहा',
  },
  'insight.bucket.WATCH': {
    en: 'Watching',
    hi: 'नज़र रखी जा रही है',
    mr: 'लक्ष ठेवलं जात आहे',
  },
  'insight.bucket.EARLY': {
    en: 'Waiting for more feedback',
    hi: 'और फ़ीडबैक का इंतज़ार है',
    mr: 'आणखी फीडबॅकची वाट पाहत आहे',
  },

  // -------------------------------------------------------------------------
  // The short instruction attached to a theme
  // -------------------------------------------------------------------------
  'insight.advice.START': {
    en: 'Act on this',
    hi: 'इस पर काम करें',
    mr: 'यावर काम करा',
  },
  'insight.advice.HOLD': {
    en: 'Coming up less on its own',
    hi: 'यह अपने आप कम बार आ रहा है',
    mr: 'हे आपोआप कमी वेळा येत आहे',
  },
  'insight.advice.CONTINUE': {
    en: 'Finish the change you agreed',
    hi: 'जिस बदलाव पर आप राज़ी हुए थे, उसे पूरा करें',
    mr: 'तुम्ही मान्य केलेला बदल पूर्ण करा',
  },
  'insight.advice.CHECKING': {
    en: 'Change made, not yet checked',
    hi: 'बदलाव हो गया है, जाँच अभी बाक़ी है',
    mr: 'बदल झाला आहे, तपासणी अजून बाकी आहे',
  },
  'insight.advice.KEEP_CHANGE': {
    en: 'Keep it in place',
    hi: 'इसे ऐसे ही रहने दें',
    mr: 'हे तसंच ठेवा',
  },
  'insight.advice.REVIEW_CHANGE': {
    en: 'Look at this again',
    hi: 'इसे फिर से देखें',
    mr: 'हे पुन्हा पाहा',
  },
  'insight.advice.PROTECT': {
    en: 'Worth protecting',
    hi: 'इसे बनाए रखना ज़रूरी है',
    mr: 'हे टिकवणं महत्त्वाचं आहे',
  },
  'insight.advice.WATCH': {
    en: 'Keep watching',
    hi: 'नज़र रखते रहें',
    mr: 'लक्ष ठेवत राहा',
  },
  'insight.advice.WAIT': {
    en: 'Wait for more feedback',
    hi: 'और फ़ीडबैक का इंतज़ार करें',
    mr: 'आणखी फीडबॅकची वाट पाहा',
  },

  // -------------------------------------------------------------------------
  // The stages of one improvement, and what each one means
  // -------------------------------------------------------------------------
  'insight.stage.SUGGESTED': {
    en: 'Suggested',
    hi: 'सुझाया गया',
    mr: 'सुचवलं',
  },
  'insight.stage.AGREED': {
    en: 'Agreed',
    hi: 'राज़ी हुए',
    mr: 'मान्य केलं',
  },
  'insight.stage.DONE': {
    en: 'Change made',
    hi: 'बदलाव हो गया',
    mr: 'बदल झाला',
  },
  'insight.stage.CHECKED': {
    en: 'Checked',
    hi: 'जाँच हो गई',
    mr: 'तपासलं',
  },
  'insight.stage.NOT_DOING': {
    en: 'Not doing',
    hi: 'नहीं कर रहे',
    mr: 'करत नाही',
  },
  'insight.stageMeaning.SUGGESTED': {
    en: 'Suggested from your feedback. Nothing has been decided yet.',
    hi: 'आपके फ़ीडबैक से यह सुझाया गया है। अभी कुछ भी तय नहीं हुआ है।',
    mr: 'तुमच्या फीडबॅकवरून हे सुचवलं आहे. अजून काहीही ठरलेलं नाही.',
  },
  'insight.stageMeaning.AGREED': {
    en: 'You agreed to make this change. It has not been made yet.',
    hi: 'आप यह बदलाव करने पर राज़ी हुए थे। यह अभी तक किया नहीं गया है।',
    mr: 'तुम्ही हा बदल करायचं मान्य केलं होतं. तो अजून केलेला नाही.',
  },
  'insight.stageMeaning.DONE': {
    en: 'You told us the change was made. Headway has not compared the feedback yet.',
    hi: 'आपने हमें बताया कि बदलाव हो गया है। Headway ने अभी फ़ीडबैक की तुलना नहीं की है।',
    mr: 'बदल झाल्याचं तुम्ही आम्हाला सांगितलं. Headway ने अजून फीडबॅकची तुलना केलेली नाही.',
  },
  'insight.stageMeaning.CHECKED': {
    en: 'Headway compared how often it came up before and after the change.',
    hi: 'बदलाव से पहले और बाद में यह कितनी बार आया, Headway ने इसकी तुलना की है।',
    mr: 'बदलाच्या आधी आणि नंतर हे किती वेळा आलं, याची Headway ने तुलना केली आहे.',
  },
  'insight.stageMeaning.NOT_DOING': {
    en: 'You decided not to make this change.',
    hi: 'आपने यह बदलाव न करने का फ़ैसला किया।',
    mr: 'तुम्ही हा बदल न करण्याचा निर्णय घेतला.',
  },

  // -------------------------------------------------------------------------
  // The before/after reading
  //
  // The note below is the sentence that keeps a before/after observational.
  // It says the difference is NOT shown to be caused by the change, and it
  // must say exactly that in all three languages — never "may not have been
  // caused", never dropped for brevity.
  // -------------------------------------------------------------------------
  'insight.outcome.note': {
    en: 'This does not show the change caused the difference.',
    hi: 'इससे यह साबित नहीं होता कि यह फ़र्क़ उस बदलाव की वजह से आया।',
    mr: 'यावरून हा फरक त्या बदलामुळे झाला आहे, असं सिद्ध होत नाही.',
  },
  'insight.outcome.lookAgain': {
    en: 'Look at it again.',
    hi: 'इसे फिर से देखें।',
    mr: 'हे पुन्हा पाहा.',
  },
  'insight.outcome.beforeScope': {
    en: 'Feedback read up to {date}',
    hi: '{date} तक पढ़ा गया फ़ीडबैक',
    mr: '{date} पर्यंत वाचलेला फीडबॅक',
  },
  'insight.outcome.afterScope.dated': {
    en: 'Feedback after the change you made on {date}',
    hi: '{date} को आपने जो बदलाव किया, उसके बाद का फ़ीडबैक',
    mr: '{date} रोजी तुम्ही केलेल्या बदलानंतरचा फीडबॅक',
  },
  'insight.outcome.afterScope': {
    en: 'Feedback after the change',
    hi: 'बदलाव के बाद का फ़ीडबैक',
    mr: 'बदलानंतरचा फीडबॅक',
  },

  // -------------------------------------------------------------------------
  // The next move, given where the improvement loop stands
  //
  // Process, not advice. Where a pack's own suggestion is repeated it arrives
  // as {suggestion} and is never translated here.
  // -------------------------------------------------------------------------
  'insight.next.praise': {
    en: 'Keep doing what customers are praising here.',
    hi: 'ग्राहक यहाँ जिसकी तारीफ़ कर रहे हैं, वह करते रहें।',
    mr: 'ग्राहक इथे ज्याचं कौतुक करत आहेत, ते करत राहा.',
  },
  'insight.next.watch.suggestion': {
    en: 'No change needed yet. If you want to fix it early, the usual fix is: {suggestion}',
    hi: 'अभी किसी बदलाव की ज़रूरत नहीं है। अगर आप इसे पहले ही ठीक करना चाहें, तो आम तौर पर यह किया जाता है: {suggestion}',
    mr: 'अजून कोणत्याही बदलाची गरज नाही. तुम्हाला हे आधीच सोडवायचं असेल, तर सहसा असं केलं जातं: {suggestion}',
  },
  'insight.next.watch': {
    en: 'No change needed yet.',
    hi: 'अभी किसी बदलाव की ज़रूरत नहीं है।',
    mr: 'अजून कोणत्याही बदलाची गरज नाही.',
  },
  'insight.next.easing.suggestion': {
    en: 'Decide whether to act now or wait. If it comes up more again, start here: {suggestion}',
    hi: 'तय करें कि अभी कुछ करना है या इंतज़ार करना है। अगर यह फिर से ज़्यादा बार आने लगे, तो यहाँ से शुरू करें: {suggestion}',
    mr: 'आता काही करायचं की थांबायचं हे ठरवा. हे पुन्हा जास्त वेळा येऊ लागलं, तर इथून सुरुवात करा: {suggestion}',
  },
  'insight.next.easing': {
    en: 'Decide whether to act now or wait.',
    hi: 'तय करें कि अभी कुछ करना है या इंतज़ार करना है।',
    mr: 'आता काही करायचं की थांबायचं हे ठरवा.',
  },
  'insight.next.start': {
    en: 'Start here: {suggestion}',
    hi: 'यहाँ से शुरू करें: {suggestion}',
    mr: 'इथून सुरुवात करा: {suggestion}',
  },
  'insight.next.act': {
    en: 'Customers have raised this often enough to act on. Decide what to change and tell us.',
    hi: 'ग्राहकों ने यह इतनी बार उठाया है कि इस पर काम किया जा सके। तय करें कि क्या बदलना है और हमें बताएँ।',
    mr: 'ग्राहकांनी हे इतक्या वेळा मांडलं आहे की यावर काम करता येईल. काय बदलायचं ते ठरवा आणि आम्हाला सांगा.',
  },
  'insight.next.recommended': {
    en: 'Decide whether to make this change and tell us.',
    hi: 'तय करें कि यह बदलाव करना है या नहीं, और हमें बताएँ।',
    mr: 'हा बदल करायचा की नाही ते ठरवा आणि आम्हाला सांगा.',
  },
  'insight.next.accepted': {
    en: 'Tell us once the change is made. Then Headway can compare the feedback that comes after it.',
    hi: 'बदलाव हो जाने पर हमें बताएँ। फिर Headway उसके बाद आने वाले फ़ीडबैक की तुलना कर सकेगा।',
    mr: 'बदल झाल्यावर आम्हाला सांगा. मग Headway त्यानंतर येणाऱ्या फीडबॅकची तुलना करू शकेल.',
  },
  'insight.next.paused': {
    en: 'The change you agreed is on hold. Headway cannot compare anything until it is made.',
    hi: 'जिस बदलाव पर आप राज़ी हुए थे, उसे रोका गया है। जब तक वह नहीं होता, Headway किसी चीज़ की तुलना नहीं कर सकता।',
    mr: 'तुम्ही मान्य केलेला बदल थांबवला आहे. तो होईपर्यंत Headway कशाचीही तुलना करू शकत नाही.',
  },
  /** A whole sentence, dropped into the two DONE sentences below as {made}. */
  'insight.next.done.madeOn': {
    en: 'You made the change on {date}.',
    hi: 'आपने {date} को यह बदलाव किया।',
    mr: 'तुम्ही {date} रोजी हा बदल केला.',
  },
  'insight.next.done.made': {
    en: 'You made the change.',
    hi: 'आपने यह बदलाव किया।',
    mr: 'तुम्ही हा बदल केला.',
  },
  'insight.next.done.enough.one': {
    en: '{made} {count} feedback entry has come in since then. That is enough to compare before and after.',
    hi: '{made} उसके बाद से {count} फ़ीडबैक आया है। पहले और बाद की तुलना करने के लिए यह काफ़ी है।',
    mr: '{made} त्यानंतर {count} फीडबॅक आला आहे. आधीच्या आणि नंतरच्या तुलनेसाठी हे पुरेसं आहे.',
  },
  'insight.next.done.enough.other': {
    en: '{made} {count} feedback entries have come in since then. That is enough to compare before and after.',
    hi: '{made} उसके बाद से {count} फ़ीडबैक आए हैं। पहले और बाद की तुलना करने के लिए यह काफ़ी है।',
    mr: '{made} त्यानंतर {count} फीडबॅक आले आहेत. आधीच्या आणि नंतरच्या तुलनेसाठी हे पुरेसं आहे.',
  },
  'insight.next.done.waiting': {
    en: '{made} Headway is waiting for enough new feedback to compare. So far it has {have} of the {need} it needs.',
    hi: '{made} तुलना करने के लिए जितना नया फ़ीडबैक चाहिए, Headway उसका इंतज़ार कर रहा है। ज़रूरी {need} में से अब तक {have} आया है।',
    mr: '{made} तुलना करण्यासाठी जेवढा नवा फीडबॅक हवा आहे, त्याची Headway वाट पाहत आहे. गरजेच्या {need} पैकी आतापर्यंत {have} आला आहे.',
  },
  'insight.next.improved': {
    en: 'Nothing in the feedback after the change says you should undo it. Headway will keep comparing as more comes in.',
    hi: 'बदलाव के बाद के फ़ीडबैक में ऐसा कुछ नहीं है जो कहे कि आपको यह बदलाव वापस लेना चाहिए। जैसे-जैसे और फ़ीडबैक आएगा, Headway तुलना करता रहेगा।',
    mr: 'बदलानंतरच्या फीडबॅकमध्ये असं काहीही नाही जे सांगेल की तुम्ही हा बदल मागे घ्यावा. जसजसा आणखी फीडबॅक येईल, तसतशी Headway तुलना करत राहील.',
  },
  'insight.next.improved.returning': {
    en: 'Nothing in the feedback after the change says you should undo it. Headway will keep comparing as more comes in. It is coming up more again. Before you make another change, check what else has changed.',
    hi: 'बदलाव के बाद के फ़ीडबैक में ऐसा कुछ नहीं है जो कहे कि आपको यह बदलाव वापस लेना चाहिए। जैसे-जैसे और फ़ीडबैक आएगा, Headway तुलना करता रहेगा। यह फिर से ज़्यादा बार आ रहा है। कोई और बदलाव करने से पहले देखें कि और क्या बदला है।',
    mr: 'बदलानंतरच्या फीडबॅकमध्ये असं काहीही नाही जे सांगेल की तुम्ही हा बदल मागे घ्यावा. जसजसा आणखी फीडबॅक येईल, तसतशी Headway तुलना करत राहील. हे पुन्हा जास्त वेळा येत आहे. आणखी एक बदल करण्यापूर्वी दुसरं काय बदललं आहे ते पाहा.',
  },
  'insight.next.worsened': {
    en: 'It came up more often in the feedback after the change. That does not show the change caused it. Before you undo the change, check what else changed.',
    hi: 'बदलाव के बाद के फ़ीडबैक में यह ज़्यादा बार आया। इससे यह साबित नहीं होता कि ऐसा उस बदलाव की वजह से हुआ। बदलाव वापस लेने से पहले देखें कि और क्या बदला था।',
    mr: 'बदलानंतरच्या फीडबॅकमध्ये हे जास्त वेळा आलं. यावरून हे त्या बदलामुळे झालं आहे, असं सिद्ध होत नाही. बदल मागे घेण्यापूर्वी दुसरं काय बदललं होतं ते पाहा.',
  },
  'insight.next.worsened.suggestion': {
    en: 'It came up more often in the feedback after the change. That does not show the change caused it. Before you undo the change, check what else changed. The first suggestion still stands: {suggestion}',
    hi: 'बदलाव के बाद के फ़ीडबैक में यह ज़्यादा बार आया। इससे यह साबित नहीं होता कि ऐसा उस बदलाव की वजह से हुआ। बदलाव वापस लेने से पहले देखें कि और क्या बदला था। पहला सुझाव अब भी लागू है: {suggestion}',
    mr: 'बदलानंतरच्या फीडबॅकमध्ये हे जास्त वेळा आलं. यावरून हे त्या बदलामुळे झालं आहे, असं सिद्ध होत नाही. बदल मागे घेण्यापूर्वी दुसरं काय बदललं होतं ते पाहा. पहिला सल्ला अजूनही लागू आहे: {suggestion}',
  },
  'insight.next.noClearChange': {
    en: 'The feedback after the change reads about the same as before. Keep collecting it. Headway will compare again.',
    hi: 'बदलाव के बाद का फ़ीडबैक पहले जैसा ही पढ़ने में आता है। इसे इकट्ठा करते रहें। Headway फिर से तुलना करेगा।',
    mr: 'बदलानंतरचा फीडबॅक आधीसारखाच वाचायला मिळतो. तो जमा करत राहा. Headway पुन्हा तुलना करेल.',
  },
  'insight.next.notEnough': {
    en: 'Not enough feedback after the change to compare yet. Headway will compare once {need} feedback entries have come in after it.',
    hi: 'तुलना करने के लिए बदलाव के बाद अभी काफ़ी फ़ीडबैक नहीं आया है। बदलाव के बाद {need} फ़ीडबैक आ जाने पर Headway तुलना करेगा।',
    mr: 'तुलना करण्यासाठी बदलानंतर अजून पुरेसा फीडबॅक आलेला नाही. बदलानंतर {need} फीडबॅक आल्यावर Headway तुलना करेल.',
  },
  'insight.next.record': {
    en: 'The suggestion stays on record in case it comes up again.',
    hi: 'यह सुझाव रिकॉर्ड में रहेगा, ताकि दोबारा ज़रूरत पड़ने पर काम आए।',
    mr: 'हा सल्ला रेकॉर्डमध्ये राहील, म्हणजे पुन्हा गरज पडल्यास उपयोगी पडेल.',
  },

  // -------------------------------------------------------------------------
  // The last two check-ins, on their own
  // -------------------------------------------------------------------------
  'insight.movement.issue.worsening': {
    en: 'Customers raised it more at your latest check-in than at the one before.',
    hi: 'पिछले चेक-इन के मुक़ाबले आपके सबसे नए चेक-इन पर ग्राहकों ने यह ज़्यादा बार उठाया।',
    mr: 'आधीच्या चेक-इनपेक्षा तुमच्या सर्वात नव्या चेक-इनला ग्राहकांनी हे जास्त वेळा मांडलं.',
  },
  'insight.movement.praise.worsening': {
    en: 'Customers praised it less at your latest check-in than at the one before.',
    hi: 'पिछले चेक-इन के मुक़ाबले आपके सबसे नए चेक-इन पर ग्राहकों ने इसकी तारीफ़ कम बार की।',
    mr: 'आधीच्या चेक-इनपेक्षा तुमच्या सर्वात नव्या चेक-इनला ग्राहकांनी याचं कौतुक कमी वेळा केलं.',
  },
  'insight.movement.issue.improving': {
    en: 'Customers raised it less at your latest check-in than at the one before.',
    hi: 'पिछले चेक-इन के मुक़ाबले आपके सबसे नए चेक-इन पर ग्राहकों ने यह कम बार उठाया।',
    mr: 'आधीच्या चेक-इनपेक्षा तुमच्या सर्वात नव्या चेक-इनला ग्राहकांनी हे कमी वेळा मांडलं.',
  },
  'insight.movement.praise.improving': {
    en: 'Customers praised it more at your latest check-in than at the one before.',
    hi: 'पिछले चेक-इन के मुक़ाबले आपके सबसे नए चेक-इन पर ग्राहकों ने इसकी तारीफ़ ज़्यादा बार की।',
    mr: 'आधीच्या चेक-इनपेक्षा तुमच्या सर्वात नव्या चेक-इनला ग्राहकांनी याचं कौतुक जास्त वेळा केलं.',
  },
  'insight.movement.stable': {
    en: 'Customers mentioned it about as often at your latest check-in as at the one before.',
    hi: 'पिछले चेक-इन के मुक़ाबले आपके सबसे नए चेक-इन पर ग्राहकों ने इसका ज़िक्र लगभग उतनी ही बार किया।',
    mr: 'आधीच्या चेक-इनला जितक्या वेळा, साधारण तितक्याच वेळा तुमच्या सर्वात नव्या चेक-इनलाही ग्राहकांनी याचा उल्लेख केला.',
  },
  'insight.movement.none': {
    en: 'There were too few mentions at one of your last two check-ins to compare.',
    hi: 'आपके पिछले दो चेक-इन में से एक पर इतने कम ज़िक्र थे कि तुलना नहीं की जा सकती।',
    mr: 'तुमच्या मागच्या दोन चेक-इनपैकी एकावर इतके कमी उल्लेख होते की तुलना करता येत नाही.',
  },

  // -------------------------------------------------------------------------
  // The reading of one complaint
  //
  // The date and the two shares sit in different places in Hindi and Marathi
  // than in English, so each combination is a whole sentence of its own rather
  // than an English sentence with fragments dropped into the middle of it.
  // -------------------------------------------------------------------------
  'insight.meaning.counterpart.issue': {
    en: '{label} is mostly a strength. {praise} praised it. But {against} said the opposite.',
    hi: '{label} ज़्यादातर आपकी ताक़त है। {praise} में इसकी तारीफ़ की गई। लेकिन {against} में इसका उल्टा कहा गया।',
    mr: '{label} ही बहुतांशी तुमची जमेची बाजू आहे. {praise} मध्ये याचं कौतुक केलं. पण {against} मध्ये याच्या उलट सांगितलं.',
  },
  'insight.meaning.improved.dated.shares': {
    en: 'In the feedback after the change on {date}, it has come up less often ({before} of feedback before, {after} after).',
    hi: '{date} को किए गए बदलाव के बाद के फ़ीडबैक में इसका ज़िक्र कम बार हुआ है (पहले फ़ीडबैक का {before}, बाद में {after})।',
    mr: '{date} रोजी केलेल्या बदलानंतरच्या फीडबॅकमध्ये याचा उल्लेख कमी वेळा झाला आहे (आधी फीडबॅकच्या {before}, नंतर {after}).',
  },
  'insight.meaning.improved.dated': {
    en: 'In the feedback after the change on {date}, it has come up less often.',
    hi: '{date} को किए गए बदलाव के बाद के फ़ीडबैक में इसका ज़िक्र कम बार हुआ है।',
    mr: '{date} रोजी केलेल्या बदलानंतरच्या फीडबॅकमध्ये याचा उल्लेख कमी वेळा झाला आहे.',
  },
  'insight.meaning.improved.shares': {
    en: 'In the feedback after the change, it has come up less often ({before} of feedback before, {after} after).',
    hi: 'बदलाव के बाद के फ़ीडबैक में इसका ज़िक्र कम बार हुआ है (पहले फ़ीडबैक का {before}, बाद में {after})।',
    mr: 'बदलानंतरच्या फीडबॅकमध्ये याचा उल्लेख कमी वेळा झाला आहे (आधी फीडबॅकच्या {before}, नंतर {after}).',
  },
  'insight.meaning.improved': {
    en: 'In the feedback after the change, it has come up less often.',
    hi: 'बदलाव के बाद के फ़ीडबैक में इसका ज़िक्र कम बार हुआ है।',
    mr: 'बदलानंतरच्या फीडबॅकमध्ये याचा उल्लेख कमी वेळा झाला आहे.',
  },
  'insight.meaning.worsened.dated.shares': {
    en: 'In the feedback after the change on {date}, it has come up more often ({before} of feedback before, {after} after).',
    hi: '{date} को किए गए बदलाव के बाद के फ़ीडबैक में इसका ज़िक्र ज़्यादा बार हुआ है (पहले फ़ीडबैक का {before}, बाद में {after})।',
    mr: '{date} रोजी केलेल्या बदलानंतरच्या फीडबॅकमध्ये याचा उल्लेख जास्त वेळा झाला आहे (आधी फीडबॅकच्या {before}, नंतर {after}).',
  },
  'insight.meaning.worsened.dated': {
    en: 'In the feedback after the change on {date}, it has come up more often.',
    hi: '{date} को किए गए बदलाव के बाद के फ़ीडबैक में इसका ज़िक्र ज़्यादा बार हुआ है।',
    mr: '{date} रोजी केलेल्या बदलानंतरच्या फीडबॅकमध्ये याचा उल्लेख जास्त वेळा झाला आहे.',
  },
  'insight.meaning.worsened.shares': {
    en: 'In the feedback after the change, it has come up more often ({before} of feedback before, {after} after).',
    hi: 'बदलाव के बाद के फ़ीडबैक में इसका ज़िक्र ज़्यादा बार हुआ है (पहले फ़ीडबैक का {before}, बाद में {after})।',
    mr: 'बदलानंतरच्या फीडबॅकमध्ये याचा उल्लेख जास्त वेळा झाला आहे (आधी फीडबॅकच्या {before}, नंतर {after}).',
  },
  'insight.meaning.worsened': {
    en: 'In the feedback after the change, it has come up more often.',
    hi: 'बदलाव के बाद के फ़ीडबैक में इसका ज़िक्र ज़्यादा बार हुआ है।',
    mr: 'बदलानंतरच्या फीडबॅकमध्ये याचा उल्लेख जास्त वेळा झाला आहे.',
  },
  'insight.meaning.noClearChange.dated.shares': {
    en: 'In the feedback after the change on {date}, it is coming up about as often as before ({before} of feedback before, {after} after).',
    hi: '{date} को किए गए बदलाव के बाद के फ़ीडबैक में इसका ज़िक्र पहले जितनी ही बार हो रहा है (पहले फ़ीडबैक का {before}, बाद में {after})।',
    mr: '{date} रोजी केलेल्या बदलानंतरच्या फीडबॅकमध्ये याचा उल्लेख आधीइतक्याच वेळा होत आहे (आधी फीडबॅकच्या {before}, नंतर {after}).',
  },
  'insight.meaning.noClearChange.dated': {
    en: 'In the feedback after the change on {date}, it is coming up about as often as before.',
    hi: '{date} को किए गए बदलाव के बाद के फ़ीडबैक में इसका ज़िक्र पहले जितनी ही बार हो रहा है।',
    mr: '{date} रोजी केलेल्या बदलानंतरच्या फीडबॅकमध्ये याचा उल्लेख आधीइतक्याच वेळा होत आहे.',
  },
  'insight.meaning.noClearChange.shares': {
    en: 'In the feedback after the change, it is coming up about as often as before ({before} of feedback before, {after} after).',
    hi: 'बदलाव के बाद के फ़ीडबैक में इसका ज़िक्र पहले जितनी ही बार हो रहा है (पहले फ़ीडबैक का {before}, बाद में {after})।',
    mr: 'बदलानंतरच्या फीडबॅकमध्ये याचा उल्लेख आधीइतक्याच वेळा होत आहे (आधी फीडबॅकच्या {before}, नंतर {after}).',
  },
  'insight.meaning.noClearChange': {
    en: 'In the feedback after the change, it is coming up about as often as before.',
    hi: 'बदलाव के बाद के फ़ीडबैक में इसका ज़िक्र पहले जितनी ही बार हो रहा है।',
    mr: 'बदलानंतरच्या फीडबॅकमध्ये याचा उल्लेख आधीइतक्याच वेळा होत आहे.',
  },
  'insight.meaning.notEnough.dated': {
    en: 'Not enough feedback after the change on {date} to compare yet.',
    hi: 'तुलना करने के लिए {date} को किए गए बदलाव के बाद अभी काफ़ी फ़ीडबैक नहीं आया है।',
    mr: 'तुलना करण्यासाठी {date} रोजी केलेल्या बदलानंतर अजून पुरेसा फीडबॅक आलेला नाही.',
  },
  'insight.meaning.notEnough': {
    en: 'Not enough feedback after the change to compare yet.',
    hi: 'तुलना करने के लिए बदलाव के बाद अभी काफ़ी फ़ीडबैक नहीं आया है।',
    mr: 'तुलना करण्यासाठी बदलानंतर अजून पुरेसा फीडबॅक आलेला नाही.',
  },
  'insight.meaning.stillWatched': {
    en: 'It is still the complaint Headway watches most closely.',
    hi: 'Headway सबसे ज़्यादा ध्यान से जिस शिकायत पर नज़र रखता है, वह अब भी यही है।',
    mr: 'Headway सर्वात बारकाईने ज्या तक्रारीवर लक्ष ठेवतो, ती अजूनही हीच आहे.',
  },
  'insight.meaning.recurring': {
    en: 'It has come up at each of your recent check-ins. It is not a one-off.',
    hi: 'यह आपके हाल के हर चेक-इन पर आया है। यह कोई एक बार की बात नहीं है।',
    mr: 'हे तुमच्या अलीकडच्या प्रत्येक चेक-इनला आलं आहे. ही एकदाच घडलेली गोष्ट नाही.',
  },
  'insight.meaning.new': {
    en: 'It became a pattern for the first time at your latest check-in. Watch it before you decide anything.',
    hi: 'आपके सबसे नए चेक-इन पर यह पहली बार पैटर्न बना है। कुछ भी तय करने से पहले इस पर नज़र रखें।',
    mr: 'तुमच्या सर्वात नव्या चेक-इनला हे पहिल्यांदाच पॅटर्न बनलं आहे. काहीही ठरवण्यापूर्वी यावर लक्ष ठेवा.',
  },
  'insight.meaning.early': {
    en: 'Customers raised it in {comments} so far. That is too few to be sure it is a pattern.',
    hi: 'अब तक ग्राहकों ने {comments} में यह उठाया है। यह पैटर्न है, इसका यक़ीन करने के लिए यह बहुत कम है।',
    mr: 'आतापर्यंत ग्राहकांनी {comments} मध्ये हे मांडलं आहे. हा पॅटर्न आहे याची खात्री करण्यासाठी हे फारच कमी आहे.',
  },
  'insight.meaning.watch': {
    en: 'Mentioned often enough to be a pattern, but not the main problem to fix first.',
    hi: 'इसका ज़िक्र इतनी बार हुआ है कि इसे पैटर्न कहा जा सके, लेकिन सबसे पहले ठीक करने वाली मुख्य समस्या यह नहीं है।',
    mr: 'याचा उल्लेख इतक्या वेळा झाला आहे की याला पॅटर्न म्हणता येईल, पण सर्वात आधी सोडवायची मुख्य अडचण ही नाही.',
  },
  'insight.meaning.act': {
    en: 'Customers raised it in {comments}. That is often enough to act on.',
    hi: 'ग्राहकों ने {comments} में यह उठाया है। इस पर काम करने के लिए यह काफ़ी बार है।',
    mr: 'ग्राहकांनी {comments} मध्ये हे मांडलं आहे. यावर काम करण्यासाठी हे पुरेशा वेळा आहे.',
  },
  'insight.meaning.returning': {
    en: 'It came up less often after your earlier change. Now it is coming up more again.',
    hi: 'आपके पिछले बदलाव के बाद यह कम बार आया था। अब यह फिर से ज़्यादा बार आ रहा है।',
    mr: 'तुमच्या आधीच्या बदलानंतर हे कमी वेळा आलं होतं. आता ते पुन्हा जास्त वेळा येत आहे.',
  },

  // -------------------------------------------------------------------------
  // The reading of one strength
  // -------------------------------------------------------------------------
  'insight.meaning.praise.growing.top': {
    en: 'This is one of the things customers praise most. They are mentioning it more than before.',
    hi: 'ग्राहक जिन चीज़ों की सबसे ज़्यादा तारीफ़ करते हैं, यह उनमें से एक है। वे पहले से ज़्यादा इसका ज़िक्र कर रहे हैं।',
    mr: 'ग्राहक ज्या गोष्टींचं सर्वात जास्त कौतुक करतात, त्यांपैकी ही एक आहे. ते आधीपेक्षा जास्त याचा उल्लेख करत आहेत.',
  },
  'insight.meaning.praise.growing': {
    en: 'This is a strength. Customers are mentioning it more than before.',
    hi: 'यह आपकी एक ताक़त है। ग्राहक पहले से ज़्यादा इसका ज़िक्र कर रहे हैं।',
    mr: 'ही तुमची एक जमेची बाजू आहे. ग्राहक आधीपेक्षा जास्त याचा उल्लेख करत आहेत.',
  },
  'insight.meaning.praise.slipping': {
    en: 'This is still a strength. But customers praised it less at your latest check-in than at the one before.',
    hi: 'यह अब भी आपकी एक ताक़त है। लेकिन पिछले चेक-इन के मुक़ाबले आपके सबसे नए चेक-इन पर ग्राहकों ने इसकी तारीफ़ कम बार की।',
    mr: 'ही अजूनही तुमची जमेची बाजू आहे. पण आधीच्या चेक-इनपेक्षा तुमच्या सर्वात नव्या चेक-इनला ग्राहकांनी याचं कौतुक कमी वेळा केलं.',
  },
  'insight.meaning.praise.recurring.top': {
    en: 'Customers praised it at each of your recent check-ins. It is one of the things they praise most.',
    hi: 'आपके हाल के हर चेक-इन पर ग्राहकों ने इसकी तारीफ़ की। वे जिन चीज़ों की सबसे ज़्यादा तारीफ़ करते हैं, यह उनमें से एक है।',
    mr: 'तुमच्या अलीकडच्या प्रत्येक चेक-इनला ग्राहकांनी याचं कौतुक केलं. ते ज्या गोष्टींचं सर्वात जास्त कौतुक करतात, त्यांपैकी ही एक आहे.',
  },
  'insight.meaning.praise.recurring': {
    en: 'Customers praised it at each of your recent check-ins. It is a steady strength.',
    hi: 'आपके हाल के हर चेक-इन पर ग्राहकों ने इसकी तारीफ़ की। यह एक टिकी हुई ताक़त है।',
    mr: 'तुमच्या अलीकडच्या प्रत्येक चेक-इनला ग्राहकांनी याचं कौतुक केलं. ही एक टिकून राहिलेली जमेची बाजू आहे.',
  },
  'insight.meaning.praise.top': {
    en: 'This is one of the things customers praise most.',
    hi: 'ग्राहक जिन चीज़ों की सबसे ज़्यादा तारीफ़ करते हैं, यह उनमें से एक है।',
    mr: 'ग्राहक ज्या गोष्टींचं सर्वात जास्त कौतुक करतात, त्यांपैकी ही एक आहे.',
  },
  'insight.meaning.praise.strength': {
    en: 'This is one of your strengths.',
    hi: 'यह आपकी ताक़तों में से एक है।',
    mr: 'ही तुमच्या जमेच्या बाजूंपैकी एक आहे.',
  },
  'insight.meaning.praise.few': {
    en: 'Customers have praised this a few times. That is not often enough yet to call it a strength.',
    hi: 'ग्राहकों ने कुछ बार इसकी तारीफ़ की है। इसे ताक़त कहने के लिए यह अभी काफ़ी बार नहीं है।',
    mr: 'ग्राहकांनी काही वेळा याचं कौतुक केलं आहे. याला जमेची बाजू म्हणण्यासाठी हे अजून पुरेशा वेळा नाही.',
  },
  'insight.meaning.praise.counterpart': {
    en: 'Not everyone agrees. {comments} said the opposite: {theme}.',
    hi: 'सब सहमत नहीं हैं। {comments} में इसका उल्टा कहा गया: {theme}।',
    mr: 'सगळेच सहमत नाहीत. {comments} मध्ये याच्या उलट सांगितलं: {theme}.',
  },

  // -------------------------------------------------------------------------
  // What Headway will check next for this theme
  // -------------------------------------------------------------------------
  'insight.watch.early.praise': {
    en: 'Headway is watching whether customers praise {theme} often enough to call it a strength. It needs {need} comments before it can say so.',
    hi: 'Headway देख रहा है कि ग्राहक {theme} की इतनी बार तारीफ़ करते हैं या नहीं कि इसे ताक़त कहा जा सके। ऐसा कहने से पहले उसे {need} कमेंट चाहिए।',
    mr: 'ग्राहक {theme} चं इतक्या वेळा कौतुक करतात का, की त्याला जमेची बाजू म्हणता येईल, हे Headway पाहत आहे. असं म्हणण्यापूर्वी त्याला {need} कमेंट लागतील.',
  },
  'insight.watch.early.issue': {
    en: 'Headway is watching whether {theme} comes up more often. It calls this a pattern once customers have raised it {need} times.',
    hi: 'Headway देख रहा है कि {theme} ज़्यादा बार आता है या नहीं। ग्राहक जब इसे {need} बार उठा देते हैं, तब वह इसे पैटर्न कहता है।',
    mr: '{theme} जास्त वेळा येतं का, हे Headway पाहत आहे. ग्राहकांनी हे {need} वेळा मांडल्यावर तो याला पॅटर्न म्हणतो.',
  },
  'insight.watch.praise': {
    en: 'Headway is checking that customers keep praising {theme}. It will tell you if the praise drops by {change} or more mentions at a check-in.',
    hi: 'Headway देख रहा है कि ग्राहक {theme} की तारीफ़ करते रहते हैं या नहीं। किसी चेक-इन पर तारीफ़ {change} या उससे ज़्यादा ज़िक्र से घटी, तो वह आपको बताएगा।',
    mr: 'ग्राहक {theme} चं कौतुक करत राहतात का, हे Headway तपासत आहे. एखाद्या चेक-इनला कौतुक {change} किंवा त्याहून जास्त उल्लेखांनी घटलं, तर तो तुम्हाला सांगेल.',
  },
  'insight.watch.improved': {
    en: 'Headway is checking whether {theme} keeps coming up less often as new feedback arrives. It will tell you if it comes up more again.',
    hi: 'नया फ़ीडबैक आने पर {theme} कम बार आता रहता है या नहीं, Headway यह देख रहा है। यह फिर से ज़्यादा बार आने लगा, तो वह आपको बताएगा।',
    mr: 'नवा फीडबॅक येताना {theme} कमी वेळा येत राहतं का, हे Headway तपासत आहे. ते पुन्हा जास्त वेळा येऊ लागलं, तर तो तुम्हाला सांगेल.',
  },
  'insight.watch.inProgress': {
    en: 'Headway is waiting for the feedback that comes in after the change. Then it can compare how often {theme} comes up.',
    hi: 'बदलाव के बाद आने वाले फ़ीडबैक का Headway इंतज़ार कर रहा है। फिर वह तुलना कर सकेगा कि {theme} कितनी बार आता है।',
    mr: 'बदलानंतर येणाऱ्या फीडबॅकची Headway वाट पाहत आहे. मग {theme} किती वेळा येतं याची तो तुलना करू शकेल.',
  },
  'insight.watch.default': {
    en: 'Headway is checking whether {theme} comes up more or less at your next check-in. It will tell you if the count moves by {change} or more mentions.',
    hi: 'आपके अगले चेक-इन पर {theme} ज़्यादा बार आता है या कम, Headway यह देख रहा है। गिनती {change} या उससे ज़्यादा ज़िक्र से बदली, तो वह आपको बताएगा।',
    mr: 'तुमच्या पुढच्या चेक-इनला {theme} जास्त वेळा येतं की कमी, हे Headway तपासत आहे. आकडा {change} किंवा त्याहून जास्त उल्लेखांनी बदलला, तर तो तुम्हाला सांगेल.',
  },

  // -------------------------------------------------------------------------
  // The customer fact
  //
  // "Headway has read" is an evidence qualifier, not filler: the count is of
  // the pile Headway actually read, and both other languages say so too.
  // -------------------------------------------------------------------------
  'insight.fact.one': {
    en: '{count} of {total} feedback entry Headway has read mention it.',
    hi: 'Headway ने जो {total} फ़ीडबैक पढ़ा है, उसमें से {count} में इसका ज़िक्र है।',
    mr: 'Headway ने वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे.',
  },
  'insight.fact.other': {
    en: '{count} of {total} feedback entries Headway has read mention it.',
    hi: 'Headway ने जो {total} फ़ीडबैक पढ़े हैं, उनमें से {count} में इसका ज़िक्र है।',
    mr: 'Headway ने वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख आहे.',
  },

  // -------------------------------------------------------------------------
  // The owner's own row. {decision} is what the owner wrote, and stays theirs.
  // -------------------------------------------------------------------------
  'insight.action.declined': {
    en: 'You decided not to make this change.',
    hi: 'आपने यह बदलाव न करने का फ़ैसला किया।',
    mr: 'तुम्ही हा बदल न करण्याचा निर्णय घेतला.',
  },
  'insight.action.undecided': {
    en: "You have not decided on Headway's suggestion yet.",
    hi: 'आपने Headway के सुझाव पर अभी फ़ैसला नहीं किया है।',
    mr: 'तुम्ही Headway च्या सल्ल्यावर अजून निर्णय घेतलेला नाही.',
  },
  'insight.action.changed': {
    en: 'You changed: {decision}',
    hi: 'आपने यह बदला: {decision}',
    mr: 'तुम्ही हे बदललं: {decision}',
  },
  'insight.action.agreedToChange': {
    en: 'You agreed to change: {decision}',
    hi: 'आप यह बदलने पर राज़ी हुए: {decision}',
    mr: 'तुम्ही हे बदलायचं मान्य केलं: {decision}',
  },
  'insight.action.madeChange': {
    en: 'You made a change here.',
    hi: 'आपने यहाँ एक बदलाव किया।',
    mr: 'तुम्ही इथे एक बदल केला.',
  },
  'insight.action.agreedChange': {
    en: 'You agreed to a change here.',
    hi: 'आप यहाँ एक बदलाव पर राज़ी हुए।',
    mr: 'तुम्ही इथे एका बदलाला मान्यता दिली.',
  },
  'insight.question.why': {
    en: '{comments} mention {theme}. Headway cannot tell from the feedback alone which of these fits. Your answer decides what to try first.',
    hi: '{comments} में {theme} का ज़िक्र है। अकेले फ़ीडबैक से Headway यह नहीं बता सकता कि इनमें से कौन-सा सही बैठता है। आपका जवाब तय करेगा कि पहले क्या आज़माया जाए।',
    mr: '{comments} मध्ये {theme} चा उल्लेख आहे. केवळ फीडबॅकवरून यांपैकी कोणतं लागू होतं हे Headway सांगू शकत नाही. आधी काय करून पाहायचं हे तुमचं उत्तर ठरवेल.',
  },

  // -------------------------------------------------------------------------
  // The picture, in one or two sentences
  // -------------------------------------------------------------------------
  'insight.summary.arrived.one': {
    en: '{count} feedback entry has arrived. Headway is reading it now.',
    hi: '{count} फ़ीडबैक आया है। Headway अभी उसे पढ़ रहा है।',
    mr: '{count} फीडबॅक आला आहे. Headway आता तो वाचत आहे.',
  },
  'insight.summary.arrived.other': {
    en: '{count} feedback entries have arrived. Headway is reading them now.',
    hi: '{count} फ़ीडबैक आए हैं। Headway अभी उन्हें पढ़ रहा है।',
    mr: '{count} फीडबॅक आले आहेत. Headway आता ते वाचत आहे.',
  },
  'insight.summary.none': {
    en: 'No feedback has come in yet. Once customers leave feedback through your QR code, Headway will read it and say what matters.',
    hi: 'अभी तक कोई फ़ीडबैक नहीं आया है। ग्राहक जब आपके QR कोड से फ़ीडबैक देंगे, तब Headway उसे पढ़कर बताएगा कि क्या मायने रखता है।',
    mr: 'अजून कोणताही फीडबॅक आलेला नाही. ग्राहक तुमच्या QR कोडवरून फीडबॅक देतील, तेव्हा Headway तो वाचून काय महत्त्वाचं आहे ते सांगेल.',
  },
  'insight.summary.early.one': {
    en: 'It is still early. Headway has read {count} feedback entry. That is enough to start looking, but not enough to be sure of anything.',
    hi: 'अभी शुरुआत है। Headway ने {count} फ़ीडबैक पढ़ा है। देखना शुरू करने के लिए यह काफ़ी है, लेकिन किसी बात का यक़ीन करने के लिए काफ़ी नहीं।',
    mr: 'अजून सुरुवात आहे. Headway ने {count} फीडबॅक वाचला आहे. पाहायला सुरुवात करण्यासाठी हे पुरेसं आहे, पण कशाचीही खात्री करण्यासाठी पुरेसं नाही.',
  },
  'insight.summary.early.other': {
    en: 'It is still early. Headway has read {count} feedback entries. That is enough to start looking, but not enough to be sure of anything.',
    hi: 'अभी शुरुआत है। Headway ने {count} फ़ीडबैक पढ़े हैं। देखना शुरू करने के लिए यह काफ़ी है, लेकिन किसी बात का यक़ीन करने के लिए काफ़ी नहीं।',
    mr: 'अजून सुरुवात आहे. Headway ने {count} फीडबॅक वाचले आहेत. पाहायला सुरुवात करण्यासाठी हे पुरेसं आहे, पण कशाचीही खात्री करण्यासाठी पुरेसं नाही.',
  },
  'insight.summary.praise.growing': {
    en: 'Customers are praising your {themes} more than before.',
    hi: 'ग्राहक आपके {themes} की पहले से ज़्यादा तारीफ़ कर रहे हैं।',
    mr: 'ग्राहक तुमच्या {themes} चं आधीपेक्षा जास्त कौतुक करत आहेत.',
  },
  'insight.summary.praise.keeps': {
    en: 'Customers keep praising your {theme}.',
    hi: 'ग्राहक आपके {theme} की तारीफ़ करते रहते हैं।',
    mr: 'ग्राहक तुमच्या {theme} चं कौतुक करत राहतात.',
  },
  'insight.summary.praise.most': {
    en: 'Customers praise your {theme} most.',
    hi: 'ग्राहक आपके {theme} की सबसे ज़्यादा तारीफ़ करते हैं।',
    mr: 'ग्राहक तुमच्या {theme} चं सर्वात जास्त कौतुक करतात.',
  },
  'insight.summary.main': {
    en: 'The main problem is {theme}.',
    hi: 'मुख्य समस्या {theme} है।',
    mr: 'मुख्य अडचण {theme} आहे.',
  },
  'insight.summary.main.still': {
    en: 'The main problem is still {theme}.',
    hi: 'मुख्य समस्या अब भी {theme} है।',
    mr: 'मुख्य अडचण अजूनही {theme} आहे.',
  },
  'insight.summary.tail.improved': {
    en: 'It has come up less in the feedback after the change.',
    hi: 'बदलाव के बाद के फ़ीडबैक में यह कम आया है।',
    mr: 'बदलानंतरच्या फीडबॅकमध्ये हे कमी आलं आहे.',
  },
  'insight.summary.tail.worsened': {
    en: 'It has come up more in the feedback after the change.',
    hi: 'बदलाव के बाद के फ़ीडबैक में यह ज़्यादा आया है।',
    mr: 'बदलानंतरच्या फीडबॅकमध्ये हे जास्त आलं आहे.',
  },
  'insight.summary.tail.worsening': {
    en: 'It came up more at your latest check-in.',
    hi: 'आपके सबसे नए चेक-इन पर यह ज़्यादा आया।',
    mr: 'तुमच्या सर्वात नव्या चेक-इनला हे जास्त आलं.',
  },
  'insight.summary.tail.improving': {
    en: 'It came up less at your latest check-in.',
    hi: 'आपके सबसे नए चेक-इन पर यह कम आया।',
    mr: 'तुमच्या सर्वात नव्या चेक-इनला हे कमी आलं.',
  },
  'insight.summary.noProblem': {
    en: 'Nothing is coming up often enough to call a problem.',
    hi: 'कोई भी बात इतनी बार नहीं आ रही कि उसे समस्या कहा जाए।',
    mr: 'कोणतीही गोष्ट इतक्या वेळा येत नाही की तिला अडचण म्हणता येईल.',
  },
  'insight.summary.clear': {
    en: 'Nothing in your feedback is standing out as a problem.',
    hi: 'आपके फ़ीडबैक में कोई भी बात समस्या के तौर पर उभरकर नहीं आ रही।',
    mr: 'तुमच्या फीडबॅकमध्ये कोणतीही गोष्ट अडचण म्हणून समोर येत नाही.',
  },

  // -------------------------------------------------------------------------
  // Why this strength was featured over a bigger number
  // -------------------------------------------------------------------------
  'insight.featured.growing': {
    en: 'Chosen because customers are mentioning it more than before, not only because it is mentioned often.',
    hi: 'इसे इसलिए चुना गया क्योंकि ग्राहक पहले से ज़्यादा इसका ज़िक्र कर रहे हैं, सिर्फ़ इसलिए नहीं कि इसका ज़िक्र अक्सर होता है।',
    mr: 'हे यासाठी निवडलं आहे कारण ग्राहक आधीपेक्षा जास्त याचा उल्लेख करत आहेत, फक्त याचा उल्लेख वारंवार होतो म्हणून नाही.',
  },
  'insight.featured.notBiggest': {
    en: 'Not your most-mentioned strength, but the one that matters most right now.',
    hi: 'यह आपकी सबसे ज़्यादा ज़िक्र होने वाली ताक़त नहीं है, लेकिन अभी सबसे ज़्यादा मायने यही रखती है।',
    mr: 'ही तुमची सर्वात जास्त उल्लेख होणारी जमेची बाजू नाही, पण आत्ता सर्वात जास्त महत्त्वाची हीच आहे.',
  },

  // -------------------------------------------------------------------------
  // Current signals: what the counts can and cannot mean
  // -------------------------------------------------------------------------
  'insight.soFar.empty': {
    en: 'Once Headway has read some feedback, what customers mention appears here.',
    hi: 'Headway जब कुछ फ़ीडबैक पढ़ लेगा, तब ग्राहक जिन बातों का ज़िक्र करते हैं, वे यहाँ दिखेंगी।',
    mr: 'Headway ने काही फीडबॅक वाचल्यावर, ग्राहक ज्या गोष्टींचा उल्लेख करतात त्या इथे दिसतील.',
  },
  'insight.soFar.patterns': {
    en: 'The marked ones are patterns. Customers raised them {need} or more times. The rest are mentions Headway is watching, not conclusions.',
    hi: 'निशान लगी बातें पैटर्न हैं। ग्राहकों ने उन्हें {need} या उससे ज़्यादा बार उठाया है। बाक़ी सिर्फ़ ज़िक्र हैं, जिन पर Headway नज़र रख रहा है — नतीजे नहीं।',
    mr: 'खूण केलेल्या गोष्टी पॅटर्न आहेत. ग्राहकांनी त्या {need} किंवा त्याहून जास्त वेळा मांडल्या आहेत. बाकीचे फक्त उल्लेख आहेत, ज्यांवर Headway लक्ष ठेवत आहे — निष्कर्ष नाहीत.',
  },
  'insight.soFar.noPattern': {
    en: 'Nothing here has been raised {need} times yet. So Headway is not calling any of it a pattern. It needs two check-ins before it can say whether anything is coming up more or less.',
    hi: 'यहाँ की कोई भी बात अभी तक {need} बार नहीं उठी है। इसलिए Headway इनमें से किसी को पैटर्न नहीं कह रहा। कुछ ज़्यादा बार आ रहा है या कम, यह बताने के लिए उसे दो चेक-इन चाहिए।',
    mr: 'इथली कोणतीही गोष्ट अजून {need} वेळा मांडली गेलेली नाही. त्यामुळे Headway यांपैकी कशालाही पॅटर्न म्हणत नाही. काही जास्त वेळा येत आहे की कमी, हे सांगण्यासाठी त्याला दोन चेक-इन लागतील.',
  },

  // -------------------------------------------------------------------------
  // The labelled facts on Home, each with its own scope
  // -------------------------------------------------------------------------
  'insight.fact.direction.label': {
    en: 'Overall direction',
    hi: 'कुल मिलाकर दिशा',
    mr: 'एकूण दिशा',
  },
  'insight.fact.direction.improving': {
    en: 'Getting better',
    hi: 'बेहतर हो रहा है',
    mr: 'चांगलं होत आहे',
  },
  'insight.fact.direction.worsening': {
    en: 'Getting worse',
    hi: 'ख़राब हो रहा है',
    mr: 'वाईट होत आहे',
  },
  'insight.fact.direction.stable': {
    en: 'Holding steady',
    hi: 'टिका हुआ है',
    mr: 'स्थिर आहे',
  },
  'insight.fact.direction.unknown': {
    en: 'Not enough to say',
    hi: 'कुछ कहने लायक़ नहीं है',
    mr: 'काही सांगण्याइतकं नाही',
  },
  'insight.fact.direction.scope.none': {
    en: 'Headway needs two check-ins before it can compare',
    hi: 'तुलना करने से पहले Headway को दो चेक-इन चाहिए',
    mr: 'तुलना करण्यापूर्वी Headway ला दोन चेक-इन लागतील',
  },
  'insight.fact.direction.scope': {
    en: 'Compared with your previous check-in',
    hi: 'आपके पिछले चेक-इन से तुलना',
    mr: 'तुमच्या आधीच्या चेक-इनशी तुलना',
  },
  'insight.fact.rating.label': {
    en: 'Public rating',
    hi: 'सार्वजनिक रेटिंग',
    mr: 'सार्वजनिक रेटिंग',
  },
  'insight.fact.rating.scope.count': {
    en: 'All {count} public reviews, not just the feedback Headway has read',
    hi: 'सभी {count} सार्वजनिक रिव्यू, सिर्फ़ वह फ़ीडबैक नहीं जो Headway ने पढ़ा है',
    mr: 'सर्व {count} सार्वजनिक रिव्ह्यू, फक्त Headway ने वाचलेला फीडबॅक नाही',
  },
  'insight.fact.rating.scope': {
    en: 'Your public listing, not the feedback Headway has read',
    hi: 'आपकी सार्वजनिक लिस्टिंग, वह फ़ीडबैक नहीं जो Headway ने पढ़ा है',
    mr: 'तुमची सार्वजनिक लिस्टिंग, Headway ने वाचलेला फीडबॅक नाही',
  },

  // -------------------------------------------------------------------------
  // The invisible work, stated plainly
  // -------------------------------------------------------------------------
  'insight.work.read.one': {
    en: 'Read {count} feedback entry.',
    hi: '{count} फ़ीडबैक पढ़ा।',
    mr: '{count} फीडबॅक वाचला.',
  },
  'insight.work.read.other': {
    en: 'Read {count} feedback entries.',
    hi: '{count} फ़ीडबैक पढ़े।',
    mr: '{count} फीडबॅक वाचले.',
  },
  'insight.work.readWithUnread.one': {
    en: 'Read {count} feedback entry ({unread} more being read now).',
    hi: '{count} फ़ीडबैक पढ़ा ({unread} और अभी पढ़ा जा रहा है)।',
    mr: '{count} फीडबॅक वाचला ({unread} आणखी आता वाचला जात आहे).',
  },
  'insight.work.readWithUnread.other': {
    en: 'Read {count} feedback entries ({unread} more being read now).',
    hi: '{count} फ़ीडबैक पढ़े ({unread} और अभी पढ़े जा रहे हैं)।',
    mr: '{count} फीडबॅक वाचले ({unread} आणखी आता वाचले जात आहेत).',
  },
  'insight.work.grouped.one': {
    en: 'Grouped them into {count} thing customers keep raising.',
    hi: 'उन्हें {count} ऐसी बात में बाँटा जो ग्राहक बार-बार उठाते हैं।',
    mr: 'ग्राहक वारंवार मांडतात अशा {count} गोष्टीत त्यांची विभागणी केली.',
  },
  'insight.work.grouped.other': {
    en: 'Grouped them into {count} things customers keep raising.',
    hi: 'उन्हें {count} ऐसी बातों में बाँटा जो ग्राहक बार-बार उठाते हैं।',
    mr: 'ग्राहक वारंवार मांडतात अशा {count} गोष्टींत त्यांची विभागणी केली.',
  },
  'insight.work.setAside.one': {
    en: 'Set aside {count} topic mentioned only once or twice.',
    hi: 'सिर्फ़ एक-दो बार ज़िक्र हुई {count} बात को अलग रखा।',
    mr: 'फक्त एक-दोन वेळा उल्लेख झालेली {count} गोष्ट बाजूला ठेवली.',
  },
  'insight.work.setAside.other': {
    en: 'Set aside {count} topics mentioned only once or twice.',
    hi: 'सिर्फ़ एक-दो बार ज़िक्र हुई {count} बातों को अलग रखा।',
    mr: 'फक्त एक-दोन वेळा उल्लेख झालेल्या {count} गोष्टी बाजूला ठेवल्या.',
  },
  'insight.work.nothing': {
    en: 'Found nothing yet that has been raised {need} or more times.',
    hi: 'अभी तक ऐसा कुछ नहीं मिला जो {need} या उससे ज़्यादा बार उठा हो।',
    mr: '{need} किंवा त्याहून जास्त वेळा मांडलं गेलं असं अजून काहीही सापडलेलं नाही.',
  },
  'insight.work.compared': {
    en: 'Compared your check-ins of {first} and {second}.',
    hi: 'आपके {first} और {second} के चेक-इन की तुलना की।',
    mr: 'तुमच्या {first} आणि {second} च्या चेक-इनची तुलना केली.',
  },
  'insight.work.firstCheckin': {
    en: 'Recorded your first check-in. The next one lets Headway show what changed.',
    hi: 'आपका पहला चेक-इन दर्ज किया। अगले चेक-इन के बाद Headway दिखा सकेगा कि क्या बदला।',
    mr: 'तुमचं पहिलं चेक-इन नोंदवलं. पुढच्या चेक-इननंतर Headway काय बदललं ते दाखवू शकेल.',
  },
  'insight.work.measured.one': {
    en: 'Compared the feedback before and after {count} change you made.',
    hi: 'आपने जो {count} बदलाव किया, उससे पहले और बाद के फ़ीडबैक की तुलना की।',
    mr: 'तुम्ही केलेल्या {count} बदलाच्या आधीच्या आणि नंतरच्या फीडबॅकची तुलना केली.',
  },
  'insight.work.measured.other': {
    en: 'Compared the feedback before and after {count} changes you made.',
    hi: 'आपने जो {count} बदलाव किए, उनसे पहले और बाद के फ़ीडबैक की तुलना की।',
    mr: 'तुम्ही केलेल्या {count} बदलांच्या आधीच्या आणि नंतरच्या फीडबॅकची तुलना केली.',
  },
  'insight.work.remembered.one': {
    en: 'Kept track of {count} decision you have made.',
    hi: 'आपने जो {count} फ़ैसला लिया, उसका हिसाब रखा।',
    mr: 'तुम्ही घेतलेल्या {count} निर्णयाची नोंद ठेवली.',
  },
  'insight.work.remembered.other': {
    en: 'Kept track of {count} decisions you have made.',
    hi: 'आपने जो {count} फ़ैसले लिए, उनका हिसाब रखा।',
    mr: 'तुम्ही घेतलेल्या {count} निर्णयांची नोंद ठेवली.',
  },

  // -------------------------------------------------------------------------
  // The quiet topics, and what not to spend time on
  // -------------------------------------------------------------------------
  'insight.quiet.one': {
    en: '{count} other topic was mentioned once or twice. That is not enough to call a pattern.',
    hi: '{count} और बात का एक-दो बार ज़िक्र हुआ। इसे पैटर्न कहने के लिए यह काफ़ी नहीं है।',
    mr: 'आणखी {count} गोष्टीचा एक-दोन वेळा उल्लेख झाला. याला पॅटर्न म्हणण्यासाठी हे पुरेसं नाही.',
  },
  'insight.quiet.other': {
    en: '{count} other topics were mentioned once or twice. That is not enough to call a pattern.',
    hi: '{count} और बातों का एक-दो बार ज़िक्र हुआ। इन्हें पैटर्न कहने के लिए यह काफ़ी नहीं है।',
    mr: 'आणखी {count} गोष्टींचा एक-दोन वेळा उल्लेख झाला. यांना पॅटर्न म्हणण्यासाठी हे पुरेसं नाही.',
  },
  'insight.noAction.lead.watch': {
    en: 'Nothing else comes ahead of what is listed above.',
    hi: 'ऊपर जो दिया है, उससे आगे और कुछ नहीं आता।',
    mr: 'वर दिलेल्या गोष्टींच्या पुढे आणखी काही येत नाही.',
  },
  'insight.noAction.lead': {
    en: 'Nothing else needs your attention.',
    hi: 'और किसी बात पर आपका ध्यान देने की ज़रूरत नहीं है।',
    mr: 'आणखी कशाकडेही तुमचं लक्ष देण्याची गरज नाही.',
  },
  'insight.noAction.early.one': {
    en: '{names} has come up. That is not often enough to act on yet.',
    hi: '{names} सामने आया है। इस पर काम करने के लिए यह अभी काफ़ी बार नहीं है।',
    mr: '{names} समोर आलं आहे. यावर काम करण्यासाठी हे अजून पुरेशा वेळा नाही.',
  },
  'insight.noAction.early.other': {
    en: '{names} have come up. That is not often enough to act on yet.',
    hi: '{names} सामने आए हैं। इन पर काम करने के लिए यह अभी काफ़ी बार नहीं है।',
    mr: '{names} समोर आले आहेत. यांवर काम करण्यासाठी हे अजून पुरेशा वेळा नाही.',
  },
  'insight.noAction.quiet.one': {
    en: '{count} other topic was mentioned once or twice.',
    hi: '{count} और बात का एक-दो बार ज़िक्र हुआ।',
    mr: 'आणखी {count} गोष्टीचा एक-दोन वेळा उल्लेख झाला.',
  },
  'insight.noAction.quiet.other': {
    en: '{count} other topics were mentioned once or twice.',
    hi: '{count} और बातों का एक-दो बार ज़िक्र हुआ।',
    mr: 'आणखी {count} गोष्टींचा एक-दोन वेळा उल्लेख झाला.',
  },
  'insight.noAction.tail': {
    en: 'Headway is not suggesting a change for any of these until they come up more often.',
    hi: 'जब तक ये ज़्यादा बार नहीं आतीं, Headway इनमें से किसी के लिए बदलाव का सुझाव नहीं दे रहा।',
    mr: 'या जास्त वेळा येत नाहीत तोपर्यंत Headway यांपैकी कशासाठीही बदलाचा सल्ला देत नाही.',
  },
  'insight.noAction.watchList': {
    en: 'Everything else customers raised is in the watch list above. None of it needs a change yet.',
    hi: 'ग्राहकों ने जो और बातें उठाईं, वे सब ऊपर की नज़र-रखने वाली सूची में हैं। उनमें से किसी में अभी बदलाव की ज़रूरत नहीं है।',
    mr: 'ग्राहकांनी मांडलेल्या इतर सर्व गोष्टी वरच्या लक्ष ठेवायच्या यादीत आहेत. त्यांपैकी कशातही अजून बदलाची गरज नाही.',
  },
  'insight.noAction.none': {
    en: 'Nothing else is coming up often enough to act on.',
    hi: 'और कुछ इतनी बार नहीं आ रहा कि उस पर काम किया जाए।',
    mr: 'आणखी काहीही इतक्या वेळा येत नाही की त्यावर काम करावं.',
  },
  'insight.noAction.empty': {
    en: 'There is nothing to set aside yet.',
    hi: 'अभी अलग रखने लायक़ कुछ नहीं है।',
    mr: 'अजून बाजूला ठेवण्यासारखं काही नाही.',
  },

  // -------------------------------------------------------------------------
  // One improvement, told end to end
  // -------------------------------------------------------------------------
  'insight.action.problem.one': {
    en: '{count} of {total} feedback entry read by {date} mentioned it ({share}).',
    hi: '{date} तक जो {total} फ़ीडबैक पढ़ा गया, उसमें से {count} में इसका ज़िक्र था ({share})।',
    mr: '{date} पर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख होता ({share}).',
  },
  'insight.action.problem.other': {
    en: '{count} of {total} feedback entries read by {date} mentioned it ({share}).',
    hi: '{date} तक जो {total} फ़ीडबैक पढ़े गए, उनमें से {count} में इसका ज़िक्र था ({share})।',
    mr: '{date} पर्यंत वाचलेल्या {total} फीडबॅकपैकी {count} मध्ये याचा उल्लेख होता ({share}).',
  },
  'insight.action.noSuggestion': {
    en: 'Headway raised this without a specific suggestion.',
    hi: 'Headway ने यह बात उठाई, लेकिन कोई ख़ास सुझाव नहीं दिया।',
    mr: 'Headway ने ही गोष्ट मांडली, पण कोणताही ठोस सल्ला दिला नाही.',
  },
  'insight.memory.change': {
    en: 'the change you made',
    hi: 'आपने जो बदलाव किया',
    mr: 'तुम्ही केलेला बदल',
  },
  'insight.memory.less': {
    en: 'Less often',
    hi: 'कम बार',
    mr: 'कमी वेळा',
  },
  'insight.memory.more': {
    en: 'More often',
    hi: 'ज़्यादा बार',
    mr: 'जास्त वेळा',
  },
  'insight.memory.noChange': {
    en: 'No clear difference',
    hi: 'कोई साफ़ फ़र्क़ नहीं',
    mr: 'स्पष्ट फरक नाही',
  },
  'insight.memory.notEnough': {
    en: 'Not enough feedback',
    hi: 'फ़ीडबैक काफ़ी नहीं',
    mr: 'पुरेसा फीडबॅक नाही',
  },
  'insight.sinceThen': {
    en: 'At check-ins after the change: {note}',
    hi: 'बदलाव के बाद के चेक-इन पर: {note}',
    mr: 'बदलानंतरच्या चेक-इनला: {note}',
  },

  // -------------------------------------------------------------------------
  // What Headway is watching, in three words
  // -------------------------------------------------------------------------
  'insight.state.returning': {
    en: 'coming up again',
    hi: 'फिर से आ रहा है',
    mr: 'पुन्हा येत आहे',
  },
  'insight.state.inProgress': {
    en: 'change in progress',
    hi: 'बदलाव चल रहा है',
    mr: 'बदल सुरू आहे',
  },
  'insight.state.improvedAfter': {
    en: 'less often after the change',
    hi: 'बदलाव के बाद कम बार',
    mr: 'बदलानंतर कमी वेळा',
  },
  'insight.state.worsenedAfter': {
    en: 'more often after the change',
    hi: 'बदलाव के बाद ज़्यादा बार',
    mr: 'बदलानंतर जास्त वेळा',
  },
  'insight.state.tooFew': {
    en: 'too few to compare yet',
    hi: 'तुलना के लिए अभी बहुत कम',
    mr: 'तुलनेसाठी अजून फारच कमी',
  },
  'insight.state.oneCheckin': {
    en: 'one check-in so far',
    hi: 'अब तक एक चेक-इन',
    mr: 'आतापर्यंत एक चेक-इन',
  },
  'insight.state.raisedLess': {
    en: 'raised less often',
    hi: 'कम बार उठाया गया',
    mr: 'कमी वेळा मांडलं',
  },
  'insight.state.raisedMore': {
    en: 'raised more often',
    hi: 'ज़्यादा बार उठाया गया',
    mr: 'जास्त वेळा मांडलं',
  },
  'insight.state.same': {
    en: 'about the same',
    hi: 'लगभग वैसा ही',
    mr: 'साधारण तसंच',
  },
  'insight.state.praisedMore': {
    en: 'praised more often',
    hi: 'ज़्यादा बार तारीफ़ की गई',
    mr: 'जास्त वेळा कौतुक केलं',
  },
  'insight.state.praisedLess': {
    en: 'praised less often',
    hi: 'कम बार तारीफ़ की गई',
    mr: 'कमी वेळा कौतुक केलं',
  },
  'insight.state.notChecked': {
    en: 'not yet checked',
    hi: 'अभी जाँच नहीं हुई',
    mr: 'अजून तपासलेलं नाही',
  },
  'insight.state.waitingFeedback': {
    en: 'waiting for more feedback',
    hi: 'और फ़ीडबैक का इंतज़ार',
    mr: 'आणखी फीडबॅकची वाट',
  },
  'insight.watching.awaiting': {
    en: 'Headway is waiting for enough new feedback to compare. So far it has {have} of {need}.',
    hi: 'तुलना करने के लिए जितना नया फ़ीडबैक चाहिए, Headway उसका इंतज़ार कर रहा है। {need} में से अब तक {have} आया है।',
    mr: 'तुलना करण्यासाठी जेवढा नवा फीडबॅक हवा आहे, त्याची Headway वाट पाहत आहे. {need} पैकी आतापर्यंत {have} आला आहे.',
  },
  'insight.watching.early': {
    en: 'Headway is watching whether these come up more often before it says anything about them.',
    hi: 'इनके बारे में कुछ कहने से पहले Headway देख रहा है कि ये ज़्यादा बार आती हैं या नहीं।',
    mr: 'यांबद्दल काही सांगण्यापूर्वी या जास्त वेळा येतात का, हे Headway पाहत आहे.',
  },

  // -------------------------------------------------------------------------
  // What the page is based on
  // -------------------------------------------------------------------------
  'insight.basis.reading': {
    en: 'Feedback is usually read within a minute of arriving. Refresh this page to see what Headway found.',
    hi: 'फ़ीडबैक आम तौर पर आने के एक मिनट के भीतर पढ़ लिया जाता है। Headway को क्या मिला, यह देखने के लिए यह पेज रिफ़्रेश करें।',
    mr: 'फीडबॅक सहसा आल्यानंतर एका मिनिटात वाचला जातो. Headway ला काय सापडलं ते पाहण्यासाठी हे पान रिफ्रेश करा.',
  },
  'insight.basis.none': {
    en: 'No feedback collected yet.',
    hi: 'अभी तक कोई फ़ीडबैक जमा नहीं हुआ है।',
    mr: 'अजून कोणताही फीडबॅक जमा झालेला नाही.',
  },
  'insight.basis.on.one': {
    en: 'Based on {count} feedback entry.',
    hi: '{count} फ़ीडबैक के आधार पर।',
    mr: '{count} फीडबॅकच्या आधारे.',
  },
  'insight.basis.on.other': {
    en: 'Based on {count} feedback entries.',
    hi: '{count} फ़ीडबैक के आधार पर।',
    mr: '{count} फीडबॅकच्या आधारे.',
  },
  'insight.basis.more.one': {
    en: '{count} more is being read now.',
    hi: '{count} और अभी पढ़ा जा रहा है।',
    mr: '{count} आणखी आता वाचला जात आहे.',
  },
  'insight.basis.more.other': {
    en: '{count} more are being read now.',
    hi: '{count} और अभी पढ़े जा रहे हैं।',
    mr: '{count} आणखी आता वाचले जात आहेत.',
  },
  'insight.changed.comparing.one': {
    en: 'Comparing your check-ins of {first} ({count} feedback entry) and {second} ({current}).',
    hi: 'आपके {first} ({count} फ़ीडबैक) और {second} ({current}) के चेक-इन की तुलना की जा रही है।',
    mr: 'तुमच्या {first} ({count} फीडबॅक) आणि {second} ({current}) च्या चेक-इनची तुलना केली जात आहे.',
  },
  'insight.changed.comparing.other': {
    en: 'Comparing your check-ins of {first} ({count} feedback entries) and {second} ({current}).',
    hi: 'आपके {first} ({count} फ़ीडबैक) और {second} ({current}) के चेक-इन की तुलना की जा रही है।',
    mr: 'तुमच्या {first} ({count} फीडबॅक) आणि {second} ({current}) च्या चेक-इनची तुलना केली जात आहे.',
  },
  'insight.changed.needTwo': {
    en: 'Headway needs two check-ins before it can show you what changed.',
    hi: 'क्या बदला यह दिखाने से पहले Headway को दो चेक-इन चाहिए।',
    mr: 'काय बदललं हे दाखवण्यापूर्वी Headway ला दोन चेक-इन लागतील.',
  },
  'insight.actions.none': {
    en: 'Nothing has been agreed yet. When something comes up often enough to act on, it will appear here.',
    hi: 'अभी किसी बात पर सहमति नहीं हुई है। जब कोई बात इतनी बार आएगी कि उस पर काम किया जा सके, तो वह यहाँ दिखेगी।',
    mr: 'अजून कशावरही सहमती झालेली नाही. एखादी गोष्ट इतक्या वेळा येईल की तिच्यावर काम करता येईल, तेव्हा ती इथे दिसेल.',
  },
  // -------------------------------------------------------------------------
  // What the owner told Headway is not possible, folded into the suggestion.
  //
  // Whole sentences with the noun as a placeholder: English can hang "is not
  // possible right now" off any noun, and Hindi and Marathi cannot without the
  // rest of the clause agreeing with it.
  // -------------------------------------------------------------------------
  'insight.constraint.alternative': {
    en: 'You told us {noun} is not possible right now, so this is the version that does not need it.',
    hi: 'आपने बताया था कि अभी {noun} मुमकिन नहीं है, तो यह वह तरीक़ा है जिसमें उसकी ज़रूरत नहीं है।',
    mr: 'तुम्ही सांगितलं होतं की आता {noun} शक्य नाही, म्हणून हा तो पर्याय आहे ज्यात त्याची गरज नाही.',
  },
  'insight.constraint.blocked': {
    en: 'You told us {noun} is not possible right now. This suggestion needs it, so ask your Headway contact for a version that does not.',
    hi: 'आपने बताया था कि अभी {noun} मुमकिन नहीं है। इस सलाह के लिए वह ज़रूरी है, तो अपने Headway संपर्क से ऐसा तरीक़ा माँगें जिसमें उसकी ज़रूरत न हो।',
    mr: 'तुम्ही सांगितलं होतं की आता {noun} शक्य नाही. या सल्ल्यासाठी ते आवश्यक आहे, म्हणून तुमच्या Headway संपर्काकडून त्याची गरज नसलेला पर्याय मागा.',
  },
  'insight.constraint.noun.STAFF': {
    en: 'extra staff', hi: 'अतिरिक्त स्टाफ़', mr: 'जास्तीचा स्टाफ',
  },
  'insight.constraint.noun.DISCOUNT': {
    en: 'a discount or offer', hi: 'कोई छूट या ऑफ़र', mr: 'सूट किंवा ऑफर',
  },
  'insight.constraint.noun.PRICE': {
    en: 'a price change', hi: 'क़ीमत में बदलाव', mr: 'किंमतीत बदल',
  },
  'insight.constraint.noun.SPEND': {
    en: 'extra spending', hi: 'अतिरिक्त ख़र्च', mr: 'जास्तीचा खर्च',
  },
  'insight.constraint.noun.OTHER': {
    en: 'something you have ruled out', hi: 'कुछ जो आपने पहले ही मना कर दिया है', mr: 'तुम्ही आधीच नाकारलेली एखादी गोष्ट',
  },
  // -------------------------------------------------------------------------
  // What the owner told Headway, said back to them.
  //
  // The FRAME is Headway's words and is translated; the {text} inside it is the
  // owner's own sentence and is passed through untouched, exactly like a
  // customer's quote.
  // -------------------------------------------------------------------------
  'insight.youToldUs.priority': {
    en: 'You told us what matters most right now: {text}.',
    hi: 'आपने हमें बताया था कि अभी सबसे ज़रूरी क्या है: {text}।',
    mr: 'तुम्ही आम्हाला सांगितलं होतं की आता सर्वात महत्त्वाचं काय आहे: {text}.',
  },
  'insight.youToldUs.focus': {
    en: 'You told us your current focus: {text}.',
    hi: 'आपने हमें बताया था कि आपका अभी का ध्यान किस पर है: {text}।',
    mr: 'तुम्ही आम्हाला सांगितलं होतं की तुमचं आताचं लक्ष कशावर आहे: {text}.',
  },
  'insight.youToldUs.plain': {
    en: 'You told us: {text}.',
    hi: 'आपने हमें बताया था: {text}।',
    mr: 'तुम्ही आम्हाला सांगितलं होतं: {text}.',
  },
  'insight.youToldUs.tried': {
    en: 'You told us you already tried this: {text}.',
    hi: 'आपने हमें बताया था कि आप यह पहले ही आज़मा चुके हैं: {text}।',
    mr: 'तुम्ही आम्हाला सांगितलं होतं की तुम्ही हे आधीच करून पाहिलं आहे: {text}.',
  },
  'insight.youToldUs.answer': {
    en: 'Asked "{question}", you told us: {text}.',
    hi: '"{question}" पूछने पर आपने हमें बताया था: {text}।',
    mr: '"{question}" विचारल्यावर तुम्ही आम्हाला सांगितलं होतं: {text}.',
  },
  'insight.youToldUs.wontSuggest': {
    en: ' Headway will not suggest {noun}.',
    hi: ' Headway {noun} का सुझाव नहीं देगा।',
    mr: ' Headway {noun} चा सल्ला देणार नाही.',
  },
} satisfies Namespace;
