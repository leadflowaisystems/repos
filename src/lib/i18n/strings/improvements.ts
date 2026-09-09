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
    hi: 'यहाँ अभी कुछ नहीं है। हेडवे ने जो बदलाव सुझाया है वह करें, और यह पेज उससे पहले और बाद के फ़ीडबैक की तुलना करेगा।',
    mr: 'इथे अजून काही नाही. हेडवेने सुचवलेला बदल करा, आणि हे पान त्याआधीच्या आणि नंतरच्या फीडबॅकची तुलना करेल.',
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
    hi: 'हेडवे ने एक बदलाव सुझाया है',
    mr: 'हेडवेने एक बदल सुचवला आहे',
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
    hi: 'हेडवे ने फिर से जाँचा',
    mr: 'हेडवेने पुन्हा तपासलं',
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
    hi: 'अभी नहीं। तुलना करने के लिए हेडवे को {need} नया फ़ीडबैक चाहिए। अभी तक {have} मिले हैं।',
    mr: 'अजून नाही. तुलना करण्यासाठी हेडवेला {need} नवीन फीडबॅक हवा आहे. आतापर्यंत {have} मिळाले आहेत.',
  },
  'improvements.moment.awaiting.other': {
    en: 'Not yet. Headway needs {need} new feedback entries to compare. It has {have} so far.',
    hi: 'अभी नहीं। तुलना करने के लिए हेडवे को {need} नए फ़ीडबैक चाहिए। अभी तक {have} मिले हैं।',
    mr: 'अजून नाही. तुलना करण्यासाठी हेडवेला {need} नवीन फीडबॅक हवेत. आतापर्यंत {have} मिळाले आहेत.',
  },
  'improvements.moment.notMadeYet': {
    en: 'Not yet. Headway will compare after you make the change.',
    hi: 'अभी नहीं। आपके बदलाव करने के बाद हेडवे तुलना करेगा।',
    mr: 'अजून नाही. तुम्ही बदल केल्यानंतर हेडवे तुलना करेल.',
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
    hi: 'हेडवे ने सुझाया',
    mr: 'हेडवेने सुचवलं',
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
} satisfies Namespace;
