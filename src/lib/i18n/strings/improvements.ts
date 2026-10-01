import type { Namespace } from '../t';

/**
 * Improvements — changes the owner is making and what happened after
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 */
export const improvements = {
  // -------------------------------------------------------------------------
  // The page and its sections
  // -------------------------------------------------------------------------
  'improvements.page.eyebrow': {
    en: 'Improvements',
    hi: 'सुधार',
    mr: 'सुधारणा',
  },
  'improvements.page.title': {
    en: 'What you changed, and what happened after',
    hi: 'आपने क्या बदला, और उसके बाद क्या हुआ',
    mr: 'तुम्ही काय बदललं, आणि त्यानंतर काय झालं',
  },
  'improvements.page.empty': {
    en: 'Nothing here yet. Make a change Headway suggested, and this page will compare the feedback from before and after it.',
    hi: 'यहाँ अभी कुछ नहीं है। Headway ने जो बदलाव सुझाया है वह करें, और यह पेज उससे पहले और बाद के फ़ीडबैक की तुलना करेगा।',
    mr: 'इथे अजून काही नाही. Headway ने सुचवलेला बदल करा, आणि हे पान त्याआधीच्या आणि नंतरच्या फीडबॅकची तुलना करेल.',
  },
  'improvements.stories.summary': {
    en: 'The full story of each change',
    hi: 'हर बदलाव की पूरी कहानी',
    mr: 'प्रत्येक बदलाची संपूर्ण गोष्ट',
  },

  'improvements.section.compared': {
    en: 'Changes compared',
    hi: 'तुलना किए गए बदलाव',
    mr: 'तुलना केलेले बदल',
  },
  'improvements.section.comparedNote': {
    en: 'How often customers mentioned it before and after the change',
    hi: 'बदलाव से पहले और बाद में ग्राहकों ने इसका कितनी बार ज़िक्र किया',
    mr: 'बदलाच्या आधी आणि नंतर ग्राहकांनी याचा किती वेळा उल्लेख केला',
  },
  'improvements.section.inProgress': {
    en: 'In progress',
    hi: 'चल रहे हैं',
    mr: 'सुरू आहेत',
  },
  'improvements.section.waiting': {
    en: 'Waiting for your decision',
    hi: 'आपके फ़ैसले का इंतज़ार',
    mr: 'तुमच्या निर्णयाची वाट',
  },
  'improvements.section.waitingNote': {
    en: 'Headway has suggested a change',
    hi: 'Headway ने एक बदलाव सुझाया है',
    mr: 'Headway ने एक बदल सुचवला आहे',
  },

  /** Used both as the section heading and as the label on that moment. */
  'improvements.notDoing': {
    en: 'Not doing',
    hi: 'नहीं कर रहे',
    mr: 'करत नाही',
  },

  // -------------------------------------------------------------------------
  // The three moments: the problem → you changed → Headway checked again
  // -------------------------------------------------------------------------
  'improvements.moment.problem': {
    en: 'The problem',
    hi: 'समस्या',
    mr: 'अडचण',
  },
  'improvements.moment.youChanged': {
    en: 'You changed',
    hi: 'आपने बदला',
    mr: 'तुम्ही बदललं',
  },
  'improvements.moment.checkedAgain': {
    en: 'Headway checked again',
    hi: 'Headway ने फिर से जाँचा',
    mr: 'Headway ने पुन्हा तपासलं',
  },

  /**
   * The line under each big figure. One key, not "{count} of" + "{total}" +
   * "feedback entries": Hindi and Marathi put the total first.
   */
  'improvements.entries.one': {
    en: '{count} of {total} feedback entry',
    hi: '{total} में से {count} फ़ीडबैक',
    mr: '{total} पैकी {count} फीडबॅक',
  },
  'improvements.entries.other': {
    en: '{count} of {total} feedback entries',
    hi: '{total} में से {count} फ़ीडबैक',
    mr: '{total} पैकी {count} फीडबॅक',
  },

  'improvements.moment.changeNotDescribed': {
    en: 'You told us you made the change, but not what you changed.',
    hi: 'आपने बताया कि आपने बदलाव किया, लेकिन यह नहीं बताया कि क्या बदला।',
    mr: 'तुम्ही सांगितलं की तुम्ही बदल केला, पण काय बदललं ते सांगितलं नाही.',
  },
  'improvements.moment.declinedReason': {
    en: 'Your reason: {reason}',
    hi: 'आपकी वजह: {reason}',
    mr: 'तुमचं कारण: {reason}',
  },
  'improvements.moment.declined': {
    en: 'You decided not to make this change.',
    hi: 'आपने यह बदलाव न करने का फ़ैसला किया।',
    mr: 'तुम्ही हा बदल न करण्याचा निर्णय घेतला.',
  },
  'improvements.moment.agreedNotMade': {
    en: 'You agreed to this change. You have not made it yet.',
    hi: 'आपने इस बदलाव के लिए हाँ कहा। आपने अभी तक यह किया नहीं है।',
    mr: 'तुम्ही या बदलाला होकार दिला. तुम्ही तो अजून केलेला नाही.',
  },
  'improvements.moment.waitingDecision': {
    en: 'Waiting for your decision.',
    hi: 'आपके फ़ैसले का इंतज़ार है।',
    mr: 'तुमच्या निर्णयाची वाट पाहत आहे.',
  },
  'improvements.moment.nothingToCompare': {
    en: 'There is nothing to compare, because you did not make the change.',
    hi: 'तुलना करने के लिए कुछ नहीं है, क्योंकि आपने यह बदलाव नहीं किया।',
    mr: 'तुलना करण्यासाठी काही नाही, कारण तुम्ही हा बदल केला नाही.',
  },
  'improvements.moment.awaiting.one': {
    en: 'Not yet. Headway needs {need} new feedback entry to compare. It has {have} so far.',
    hi: 'अभी नहीं। तुलना करने के लिए Headway को {need} नया फ़ीडबैक चाहिए। अभी तक {have} मिले हैं।',
    mr: 'अजून नाही. तुलना करण्यासाठी Headway ला {need} नवीन फीडबॅक हवा आहे. आतापर्यंत {have} मिळाले आहेत.',
  },
  'improvements.moment.awaiting.other': {
    en: 'Not yet. Headway needs {need} new feedback entries to compare. It has {have} so far.',
    hi: 'अभी नहीं। तुलना करने के लिए Headway को {need} नए फ़ीडबैक चाहिए। अभी तक {have} मिले हैं।',
    mr: 'अजून नाही. तुलना करण्यासाठी Headway ला {need} नवीन फीडबॅक हवेत. आतापर्यंत {have} मिळाले आहेत.',
  },
  'improvements.moment.notMadeYet': {
    en: 'Not yet. Headway will compare after you make the change.',
    hi: 'अभी नहीं। आपके बदलाव करने के बाद Headway तुलना करेगा।',
    mr: 'अजून नाही. तुम्ही बदल केल्यानंतर Headway तुलना करेल.',
  },

  // -------------------------------------------------------------------------
  // The reading: what happened, what it means, what to do now
  //
  // "after the change" is not decoration. It states the order of events and
  // claims nothing about the cause, so it stays in all three languages.
  // -------------------------------------------------------------------------
  'improvements.reading.improved': {
    en: 'Customers mentioned it less often after the change.',
    hi: 'बदलाव के बाद ग्राहकों ने इसका ज़िक्र कम बार किया।',
    mr: 'बदलानंतर ग्राहकांनी याचा उल्लेख कमी वेळा केला.',
  },
  'improvements.reading.worsened': {
    en: 'Customers mentioned it more often after the change.',
    hi: 'बदलाव के बाद ग्राहकों ने इसका ज़िक्र ज़्यादा बार किया।',
    mr: 'बदलानंतर ग्राहकांनी याचा उल्लेख जास्त वेळा केला.',
  },
  'improvements.reading.noClearChange': {
    en: 'There is no clear difference after the change.',
    hi: 'बदलाव के बाद कोई साफ़ फ़र्क़ नहीं है।',
    mr: 'बदलानंतर स्पष्ट फरक नाही.',
  },
  'improvements.reading.notEnough': {
    en: 'There is not enough feedback after the change.',
    hi: 'बदलाव के बाद पर्याप्त फ़ीडबैक नहीं है।',
    mr: 'बदलानंतर पुरेसा फीडबॅक नाही.',
  },

  'improvements.row.whatHappened': {
    en: 'What happened',
    hi: 'क्या हुआ',
    mr: 'काय झालं',
  },
  'improvements.row.whatThisMeans': {
    en: 'What this means',
    hi: 'इसका क्या मतलब है',
    mr: 'याचा काय अर्थ आहे',
  },
  'improvements.row.whatToDoNow': {
    en: 'What to do now',
    hi: 'अब क्या करना है',
    mr: 'आता काय करायचं',
  },
  'improvements.row.whereThisStands': {
    en: 'Where this has reached',
    hi: 'यह कहाँ तक पहुँचा है',
    mr: 'हे कुठवर पोहोचलं आहे',
  },

  'improvements.next.improved': {
    en: 'Keep the change as it is.',
    hi: 'बदलाव को वैसे ही रहने दें।',
    mr: 'बदल तसाच राहू द्या.',
  },
  'improvements.next.worsened': {
    en: 'Before you undo the change, check what else changed.',
    hi: 'बदलाव वापस लेने से पहले, देखें कि और क्या बदला है।',
    mr: 'बदल मागे घेण्याआधी, आणखी काय बदललं आहे ते बघा.',
  },
  'improvements.next.noClearChange': {
    en: 'Keep collecting feedback.',
    hi: 'फ़ीडबैक इकट्ठा करते रहें।',
    mr: 'फीडबॅक गोळा करत राहा.',
  },

  'improvements.returning': {
    en: 'Customers are mentioning it more often again. Before you make another change, check what is different now.',
    hi: 'ग्राहक इसका ज़िक्र फिर से ज़्यादा बार कर रहे हैं। दूसरा बदलाव करने से पहले, देखें कि अब क्या अलग है।',
    mr: 'ग्राहक याचा उल्लेख पुन्हा जास्त वेळा करत आहेत. दुसरा बदल करण्याआधी, आता काय वेगळं आहे ते बघा.',
  },

  // -------------------------------------------------------------------------
  // What opens on request
  // -------------------------------------------------------------------------
  'improvements.reveal.numbers': {
    en: 'Show the numbers',
    hi: 'आँकड़े दिखाएँ',
    mr: 'आकडे दाखवा',
  },
  'improvements.reveal.evidence': {
    en: 'Show what customers wrote',
    hi: 'ग्राहकों ने क्या लिखा वह दिखाएँ',
    mr: 'ग्राहकांनी काय लिहिलं ते दाखवा',
  },
  'improvements.reveal.howStarted': {
    en: 'How this started',
    hi: 'यह कैसे शुरू हुआ',
    mr: 'हे कसं सुरू झालं',
  },
  'improvements.evidence.after': {
    en: 'After the change',
    hi: 'बदलाव के बाद',
    mr: 'बदलानंतर',
  },
  'improvements.evidence.before': {
    en: 'Before the change',
    hi: 'बदलाव से पहले',
    mr: 'बदलाच्या आधी',
  },
  'improvements.evidence.seeMentions': {
    en: 'See all the mentions',
    hi: 'सारे ज़िक्र देखें',
    mr: 'सर्व उल्लेख बघा',
  },
  'improvements.started.suggested': {
    en: 'Headway suggested',
    hi: 'Headway ने सुझाया',
    mr: 'Headway ने सुचवलं',
  },
  'improvements.started.decided': {
    en: 'You decided',
    hi: 'आपने तय किया',
    mr: 'तुम्ही ठरवलं',
  },
  'improvements.started.learning': {
    en: 'You told us afterwards',
    hi: 'आपने बाद में बताया',
    mr: 'तुम्ही नंतर सांगितलं',
  },
  'improvements.started.problemNumbers': {
    en: 'The problem, in numbers',
    hi: 'समस्या, आँकड़ों में',
    mr: 'अडचण, आकड्यांमध्ये',
  },
  'improvements.next.originalSuggestion': {
    en: 'The original suggestion still stands: {suggestion}',
    hi: 'पहली सलाह अब भी वही है: {suggestion}',
    mr: 'पहिला सल्ला अजूनही तोच आहे: {suggestion}',
  },

  // --- one change, on its own page ------------------------------------------
  'improvements.detail.evidence': {
    en: 'What customers said about this',
    hi: 'इस बारे में ग्राहकों ने क्या कहा',
    mr: 'याबद्दल ग्राहक काय म्हणाले',
  },
  // --- trends: what is changing in the business ------------------------------
  'improvements.trends.title': {
    en: 'Trends',
    hi: 'रुझान',
    mr: 'कल',
  },
  'improvements.trends.intro': {
    en: 'See what’s getting better, worse, or staying the same.',
    hi: 'देखें क्या बेहतर हो रहा है, क्या बिगड़ रहा है और क्या वैसा ही है।',
    mr: 'काय सुधारतंय, काय बिघडतंय आणि काय तसंच आहे ते पाहा.',
  },
  'improvements.trends.worse': {
    en: 'Getting worse',
    hi: 'बिगड़ रहा है',
    mr: 'बिघडत आहे',
  },
  'improvements.trends.worseNote': {
    en: 'Customers are mentioning these more than before.',
    hi: 'ग्राहक इनका ज़िक्र पहले से ज़्यादा कर रहे हैं।',
    mr: 'ग्राहक यांचा उल्लेख आधीपेक्षा जास्त करत आहेत.',
  },
  'improvements.trends.better': {
    en: 'Getting better',
    hi: 'बेहतर हो रहा है',
    mr: 'सुधारत आहे',
  },
  'improvements.trends.betterNote': {
    en: 'Customers are mentioning these less, or more positively.',
    hi: 'ग्राहक इनका ज़िक्र कम, या ज़्यादा अच्छे से कर रहे हैं।',
    mr: 'ग्राहक यांचा उल्लेख कमी, किंवा अधिक चांगल्या प्रकारे करत आहेत.',
  },
  'improvements.trends.stable': {
    en: 'Stable',
    hi: 'स्थिर',
    mr: 'स्थिर',
  },
  'improvements.trends.noChange': {
    en: 'About the same',
    hi: 'लगभग वैसा ही',
    mr: 'जवळपास तसंच',
  },
  'improvements.trends.moreMentions': {
    en: 'More often',
    hi: 'पहले से ज़्यादा',
    mr: 'आधीपेक्षा जास्त',
  },
  'improvements.trends.fewerMentions': {
    en: 'Less often',
    hi: 'पहले से कम',
    mr: 'आधीपेक्षा कमी',
  },
  'improvements.trends.morePraise': {
    en: 'Praised more than before',
    hi: 'पहले से ज़्यादा तारीफ़',
    mr: 'आधीपेक्षा जास्त कौतुक',
  },
  'improvements.trends.lessPraise': {
    en: 'Praised less than before',
    hi: 'पहले से कम तारीफ़',
    mr: 'आधीपेक्षा कमी कौतुक',
  },
  'improvements.trends.none': {
    en: 'Nothing has moved enough to call a trend yet.',
    hi: 'अभी कुछ भी इतना नहीं बदला कि उसे रुझान कहा जा सके।',
    mr: 'कल म्हणता येईल इतकं अजून काहीही बदललेलं नाही.',
  },
  'improvements.trends.notYet': {
    en: 'Trends appear after your second check-in.',
    hi: 'रुझान आपके दूसरे चेक-इन के बाद दिखेंगे।',
    mr: 'तुमच्या दुसऱ्या चेक-इननंतर कल दिसतील.',
  },

  // -------------------------------------------------------------------------
  // WHAT CUSTOMERS ARE SAYING NOW — kept apart from the trends
  //
  // A current pattern is counted over everything Headway has read and needs no
  // check-in. A trend is a comparison and needs two. The page says both, in
  // that order, so "no trend yet" is never mistaken for "nothing to say".
  // -------------------------------------------------------------------------
  'improvements.now.title': {
    en: 'What customers are saying now',
    hi: 'ग्राहक अभी क्या कह रहे हैं',
    mr: 'ग्राहक सध्या काय सांगत आहेत',
  },
  'improvements.now.note': {
    en: 'Counted across everything Headway has read. This is where things stand today, not which way they are moving.',
    hi: 'Headway ने जो कुछ पढ़ा है, उस सबमें से गिना गया। यह आज की स्थिति है, यह नहीं कि चीज़ें किस तरफ़ जा रही हैं।',
    mr: 'Headway ने वाचलेल्या सगळ्यातून मोजलेलं. ही आजची स्थिती आहे, गोष्टी कोणत्या दिशेने जात आहेत ते नाही.',
  },
  'improvements.now.none': {
    en: 'No strong pattern yet. Nothing has been raised by enough customers for Headway to call it a pattern.',
    hi: 'अभी कोई पक्का पैटर्न नहीं है। कोई भी बात इतने ग्राहकों ने नहीं कही कि Headway उसे पैटर्न कहे।',
    mr: 'अजून कोणताही ठोस पॅटर्न नाही. कोणतीही गोष्ट पुरेशा ग्राहकांनी सांगितलेली नाही की Headway तिला पॅटर्न म्हणेल.',
  },
  'improvements.now.early.title': {
    en: 'Early signs',
    hi: 'शुरुआती संकेत',
    mr: 'सुरुवातीचे संकेत',
  },
  'improvements.now.early.note': {
    en: 'Mentioned a few times. Headway is not calling these a pattern until more feedback confirms them.',
    hi: 'कुछ बार कहा गया। और फ़ीडबैक से पुष्टि होने तक Headway इन्हें पैटर्न नहीं कह रहा।',
    mr: 'काही वेळा सांगितलं गेलं. आणखी फीडबॅकने खात्री होईपर्यंत Headway यांना पॅटर्न म्हणत नाही.',
  },
  'improvements.now.all': {
    en: 'See every topic on Customers',
    hi: 'हर विषय ग्राहक पेज पर देखें',
    mr: 'प्रत्येक विषय ग्राहक पानावर पाहा',
  },

  // -------------------------------------------------------------------------
  // TRENDS AREN'T READY YET — why, with the counts, and what happens next
  //
  // Not an error and not an apology: a trend is a comparison, and this says
  // which half of the comparison is still missing.
  // -------------------------------------------------------------------------
  'improvements.notReady.eyebrow': {
    en: 'Trend comparison',
    hi: 'रुझान की तुलना',
    mr: 'कलांची तुलना',
  },
  'improvements.notReady.title': {
    en: 'Trends aren’t ready yet',
    hi: 'रुझान अभी तैयार नहीं हैं',
    mr: 'कल अजून तयार नाहीत',
  },
  'improvements.notReady.body': {
    en: 'Headway can already read your customer feedback. To tell whether something is getting better, worse, or staying about the same, we need two comparable periods with enough feedback in each.',
    hi: 'Headway आपके ग्राहकों का फ़ीडबैक अभी से पढ़ सकता है। कोई चीज़ बेहतर हो रही है, बिगड़ रही है या लगभग वैसी ही है, यह बताने के लिए हमें तुलना लायक़ दो अवधियाँ चाहिए, और दोनों में पर्याप्त फ़ीडबैक।',
    mr: 'Headway तुमच्या ग्राहकांचा फीडबॅक आत्ताच वाचू शकतं. एखादी गोष्ट सुधारत आहे, बिघडत आहे की जवळपास तशीच आहे हे सांगण्यासाठी आम्हाला तुलना करता येतील असे दोन कालावधी लागतात, आणि दोन्हींमध्ये पुरेसा फीडबॅक.',
  },
  'improvements.notReady.explain': {
    en: 'A check-in is a dated reading of your feedback that Headway records for you. Comparing two of them is what shows a trend.',
    hi: 'चेक-इन आपके फ़ीडबैक की एक तारीख़ वाली रीडिंग है, जो Headway आपके लिए दर्ज करता है। ऐसे दो की तुलना से ही रुझान दिखता है।',
    mr: 'चेक-इन म्हणजे तुमच्या फीडबॅकचं तारीख असलेलं वाचन, जे Headway तुमच्यासाठी नोंदवतं. अशा दोन वाचनांच्या तुलनेतूनच कल दिसतो.',
  },
  'improvements.notReady.fact.read': {
    en: 'Responses read',
    hi: 'पढ़े गए जवाब',
    mr: 'वाचलेले प्रतिसाद',
  },
  'improvements.notReady.fact.checkins': {
    en: 'Check-ins recorded',
    hi: 'दर्ज चेक-इन',
    mr: 'नोंदवलेले चेक-इन',
  },
  'improvements.notReady.fact.since': {
    en: 'New responses since your last check-in',
    hi: 'पिछले चेक-इन के बाद आए नए जवाब',
    mr: 'मागच्या चेक-इननंतर आलेले नवे प्रतिसाद',
  },
  'improvements.notReady.fact.waiting': {
    en: 'Responses waiting for your first check-in',
    hi: 'पहले चेक-इन का इंतज़ार कर रहे जवाब',
    mr: 'पहिल्या चेक-इनची वाट पाहणारे प्रतिसाद',
  },
  'improvements.notReady.checkins.none': {
    en: 'None yet',
    hi: 'अभी कोई नहीं',
    mr: 'अजून एकही नाही',
  },
  'improvements.notReady.checkins.single': {
    en: '1 — {label}',
    hi: '1 — {label}',
    mr: '1 — {label}',
  },
  'improvements.notReady.checkins.several': {
    en: '{count} — latest {label}',
    hi: '{count} — सबसे नया {label}',
    mr: '{count} — सर्वात नवा {label}',
  },
  'improvements.notReady.progress': {
    en: '{count} of {need}',
    hi: '{need} में से {count}',
    mr: '{need} पैकी {count}',
  },
  'improvements.notReady.next.title': {
    en: 'What happens next',
    hi: 'आगे क्या होगा',
    mr: 'पुढे काय होईल',
  },
  'improvements.notReady.next.none': {
    en: 'Headway records your first check-in, covering everything received so far. Trends appear after a second one.',
    hi: 'Headway आपका पहला चेक-इन दर्ज करेगा, जिसमें अब तक आया सब कुछ शामिल होगा। रुझान दूसरे चेक-इन के बाद दिखेंगे।',
    mr: 'Headway तुमचा पहिला चेक-इन नोंदवेल, ज्यात आतापर्यंत आलेलं सगळं असेल. दुसऱ्या चेक-इननंतर कल दिसतील.',
  },
  'improvements.notReady.next.oneWaiting': {
    en: 'A second check-in, once {need} new responses have arrived since the first. Then trends appear here.',
    hi: 'पहले चेक-इन के बाद {need} नए जवाब आने पर दूसरा चेक-इन होगा। फिर रुझान यहाँ दिखेंगे।',
    mr: 'पहिल्या चेक-इननंतर {need} नवे प्रतिसाद आले की दुसरा चेक-इन होईल. मग कल इथे दिसतील.',
  },
  'improvements.notReady.next.oneDue': {
    en: 'Enough new responses have arrived for a second check-in. Once Headway records it, trends appear here.',
    hi: 'दूसरे चेक-इन के लिए काफ़ी नए जवाब आ चुके हैं। Headway के उसे दर्ज करते ही रुझान यहाँ दिखेंगे।',
    mr: 'दुसऱ्या चेक-इनसाठी पुरेसे नवे प्रतिसाद आले आहेत. Headway ने तो नोंदवताच कल इथे दिसतील.',
  },
  'improvements.notReady.next.thin': {
    en: 'Your last two check-ins hold {previous} and {current} responses. Headway needs at least {need} in each before it compares them. Your next check-in will include everything received since.',
    hi: 'आपके पिछले दो चेक-इन में {previous} और {current} जवाब हैं। तुलना से पहले Headway को हर एक में कम से कम {need} चाहिए। अगले चेक-इन में उसके बाद आया सब कुछ शामिल होगा।',
    mr: 'तुमच्या मागच्या दोन चेक-इनमध्ये {previous} आणि {current} प्रतिसाद आहेत. तुलना करण्याआधी Headway ला प्रत्येकात किमान {need} लागतात. पुढच्या चेक-इनमध्ये त्यानंतर आलेलं सगळं असेल.',
  },
  'improvements.trends.changes': {
    en: 'Your changes',
    hi: 'आपके बदलाव',
    mr: 'तुमचे बदल',
  },
  'improvements.trends.mentions.one': {
    en: '{count} mention',
    hi: '{count} ज़िक्र',
    mr: '{count} उल्लेख',
  },
  'improvements.trends.mentions.other': {
    en: '{count} mentions',
    hi: '{count} ज़िक्र',
    mr: '{count} उल्लेख',
  },
  'improvements.said.after': {
    en: 'What customers said after',
    hi: 'बाद में ग्राहकों ने क्या कहा',
    mr: 'नंतर ग्राहक काय म्हणाले',
  },
} satisfies Namespace;
