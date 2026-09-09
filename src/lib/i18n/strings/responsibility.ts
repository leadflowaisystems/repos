import type { Namespace } from '../t';

/**
 * What needs the owner, why, and what Headway will check next (src/lib/responsibility/engine.ts)
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
 * WHAT IS NOT TRANSLATED HERE. A theme label arrives as `{theme}` from the
 * pack, a decision or a note arrives as `{decision}` / `{note}` in the owner's
 * own words, a reading from another engine arrives as `{movement}`, and every
 * count and date arrives as a number. Those are values. Only the sentence
 * around them belongs to this file.
 */
export const responsibility = {
  // -------------------------------------------------------------------------
  // The six states, as the badge above an item
  // -------------------------------------------------------------------------
  'responsibility.state.doNow': {
    en: 'Do this first',
    hi: 'यह पहले करें',
    mr: 'हे आधी करा',
  },
  'responsibility.state.followUp': {
    en: 'Follow through',
    hi: 'इसे पूरा करें',
    mr: 'हे पूर्ण करा',
  },
  'responsibility.state.watch': {
    en: 'Watching',
    hi: 'नज़र रखी जा रही है',
    mr: 'लक्ष ठेवत आहोत',
  },
  'responsibility.state.keepDoing': {
    en: 'Keep doing this',
    hi: 'यह करते रहें',
    mr: 'हे करत राहा',
  },
  'responsibility.state.waiting': {
    en: 'Waiting for more feedback',
    hi: 'और फ़ीडबैक का इंतज़ार',
    mr: 'अधिक फीडबॅकची वाट पाहत आहोत',
  },
  'responsibility.state.clear': {
    en: 'Nothing needed',
    hi: 'कुछ करने की ज़रूरत नहीं',
    mr: 'काही करण्याची गरज नाही',
  },

  // -------------------------------------------------------------------------
  // How sure the evidence lets Headway be, and which pile it read
  // -------------------------------------------------------------------------
  'responsibility.certainty.strong': {
    en: 'enough feedback to be sure',
    hi: 'पक्का कहने लायक़ फ़ीडबैक है',
    mr: 'खात्रीने सांगण्याइतका फीडबॅक आहे',
  },
  'responsibility.certainty.moderate': {
    en: 'a clear pattern, but still worth confirming',
    hi: 'साफ़ पैटर्न है, फिर भी पक्का कर लेना बेहतर',
    mr: 'स्पष्ट पॅटर्न आहे, तरी खात्री करून घेणं चांगलं',
  },
  'responsibility.certainty.early': {
    en: 'an early sign, based on little feedback',
    hi: 'शुरुआती संकेत, थोड़े फ़ीडबैक पर आधारित',
    mr: 'सुरुवातीचं चिन्ह, थोड्या फीडबॅकवर आधारित',
  },
  'responsibility.evidence.scope': {
    en: 'across everything Headway has read so far',
    hi: 'Headway ने अब तक जो कुछ पढ़ा है, उस सब में',
    mr: 'Headway ने आतापर्यंत वाचलेल्या सगळ्यामध्ये',
  },

  // -------------------------------------------------------------------------
  // The short instruction under the state
  // -------------------------------------------------------------------------
  'responsibility.instruction.lookAgain': {
    en: 'Look at this again',
    hi: 'इसे दोबारा देखें',
    mr: 'हे पुन्हा बघा',
  },
  'responsibility.instruction.notDoing': {
    en: 'Not doing this',
    hi: 'यह नहीं कर रहे हैं',
    mr: 'हे करत नाही आहात',
  },
  'responsibility.instruction.decideChange': {
    en: 'Decide what to change',
    hi: 'तय करें कि क्या बदलना है',
    mr: 'काय बदलायचं ते ठरवा',
  },
  'responsibility.instruction.actOrWait': {
    en: 'Decide: act now or wait',
    hi: 'तय करें: अभी करें या इंतज़ार करें',
    mr: 'ठरवा: आत्ता करायचं की थांबायचं',
  },
  'responsibility.instruction.restart': {
    en: 'Decide whether to restart it',
    hi: 'तय करें कि इसे फिर शुरू करना है या नहीं',
    mr: 'हे पुन्हा सुरू करायचं का ते ठरवा',
  },
  'responsibility.instruction.finishChange': {
    en: 'Finish the change you agreed',
    hi: 'जो बदलाव आपने तय किया था, उसे पूरा करें',
    mr: 'तुम्ही ठरवलेला बदल पूर्ण करा',
  },
  'responsibility.instruction.readyToCompare': {
    en: 'Ready to compare',
    hi: 'तुलना करने के लिए तैयार',
    mr: 'तुलना करण्यासाठी तयार',
  },
  'responsibility.instruction.notYetChecked': {
    en: 'Change made, not yet checked',
    hi: 'बदलाव हो गया, अभी जाँचा नहीं गया',
    mr: 'बदल झाला, अजून तपासलेला नाही',
  },
  'responsibility.instruction.keepChange': {
    en: 'Keep the change in place',
    hi: 'बदलाव को ऐसे ही बनाए रखें',
    mr: 'बदल तसाच ठेवा',
  },
  'responsibility.instruction.keepAsIs': {
    en: 'Keep it as it is',
    hi: 'इसे ऐसे ही रहने दें',
    mr: 'हे असंच राहू द्या',
  },
  'responsibility.instruction.nothingYet': {
    en: 'Nothing to do yet',
    hi: 'अभी कुछ करने की ज़रूरत नहीं',
    mr: 'अजून काही करायची गरज नाही',
  },
  'responsibility.instruction.notEnoughSince': {
    en: 'Change made, not enough feedback since',
    hi: 'बदलाव हो गया, उसके बाद फ़ीडबैक कम है',
    mr: 'बदल झाला, त्यानंतरचा फीडबॅक कमी आहे',
  },
  'responsibility.instruction.keepCollecting': {
    en: 'Keep collecting feedback',
    hi: 'फ़ीडबैक जमा करते रहें',
    mr: 'फीडबॅक गोळा करत राहा',
  },
  'responsibility.instruction.importantNotUrgent': {
    en: 'Important, not urgent',
    hi: 'ज़रूरी है, पर जल्दी नहीं',
    mr: 'महत्त्वाचं आहे, पण तातडीचं नाही',
  },
  'responsibility.instruction.answerYourself': {
    en: 'Answer these yourself',
    hi: 'इनका जवाब ख़ुद दें',
    mr: 'यांना उत्तर तुम्हीच द्या',
  },

  // -------------------------------------------------------------------------
  // One sentence saying what the item is. {theme} is the pack's own label.
  // -------------------------------------------------------------------------
  'responsibility.headline.returning': {
    en: '{theme} is coming back after your change.',
    hi: 'आपके बदलाव के बाद {theme} फिर से लौट रहा है।',
    mr: 'तुमच्या बदलानंतर {theme} पुन्हा येऊ लागलं आहे.',
  },
  'responsibility.headline.declinedFirst': {
    en: '{theme} is still what customers complain about most. You decided not to make this change.',
    hi: 'ग्राहक अब भी सबसे ज़्यादा {theme} की शिकायत करते हैं। आपने यह बदलाव न करने का फ़ैसला किया था।',
    mr: 'ग्राहक अजूनही सर्वात जास्त {theme} बद्दल तक्रार करतात. तुम्ही हा बदल न करण्याचं ठरवलं होतं.',
  },
  'responsibility.headline.declinedPattern': {
    en: '{theme} is still a pattern. You decided not to make this change.',
    hi: '{theme} अब भी एक पैटर्न है। आपने यह बदलाव न करने का फ़ैसला किया था।',
    mr: '{theme} अजूनही एक पॅटर्न आहे. तुम्ही हा बदल न करण्याचं ठरवलं होतं.',
  },
  'responsibility.headline.start': {
    en: '{theme} is the main problem customers are unhappy about.',
    hi: 'ग्राहक जिससे नाख़ुश हैं, उसमें मुख्य समस्या {theme} है।',
    mr: 'ग्राहक नाराज आहेत त्यातली मुख्य अडचण {theme} आहे.',
  },
  'responsibility.headline.hold': {
    en: '{theme} is still what customers complain about most. But it came up less at your last check-in.',
    hi: 'ग्राहक अब भी सबसे ज़्यादा {theme} की शिकायत करते हैं। पर आपके पिछले चेक-इन पर यह कम बार आया।',
    mr: 'ग्राहक अजूनही सर्वात जास्त {theme} बद्दल तक्रार करतात. पण तुमच्या मागच्या चेक-इनला ते कमी वेळा आलं.',
  },
  'responsibility.headline.continuePaused': {
    en: 'The change you agreed for {theme} is on hold.',
    hi: '{theme} के लिए आपने जो बदलाव तय किया था, वह रोका गया है।',
    mr: '{theme} साठी तुम्ही ठरवलेला बदल थांबवला आहे.',
  },
  'responsibility.headline.continue': {
    en: 'The change you agreed for {theme} has not been made yet.',
    hi: '{theme} के लिए आपने जो बदलाव तय किया था, वह अभी तक किया नहीं गया है।',
    mr: '{theme} साठी तुम्ही ठरवलेला बदल अजून केलेला नाही.',
  },
  'responsibility.headline.comparisonDue': {
    en: 'Enough new feedback has come in. Headway can now check what happened after your change for {theme}.',
    hi: 'काफ़ी नया फ़ीडबैक आ गया है। Headway अब देख सकता है कि {theme} के लिए आपके बदलाव के बाद क्या हुआ।',
    mr: 'पुरेसा नवा फीडबॅक आला आहे. {theme} साठी तुमच्या बदलानंतर काय झालं हे Headway आता तपासू शकतं.',
  },
  'responsibility.headline.checking': {
    en: 'Your change for {theme} is in place. Headway is waiting for enough new feedback to compare.',
    hi: '{theme} के लिए आपका बदलाव लागू है। तुलना करने लायक़ नया फ़ीडबैक आने का Headway इंतज़ार कर रहा है।',
    mr: '{theme} साठी तुमचा बदल लागू आहे. तुलना करण्याइतका नवा फीडबॅक येण्याची Headway वाट पाहत आहे.',
  },
  'responsibility.headline.keepChange': {
    en: 'Customers mentioned {theme} less often after your change.',
    hi: 'आपके बदलाव के बाद ग्राहकों ने {theme} का कम बार ज़िक्र किया।',
    mr: 'तुमच्या बदलानंतर ग्राहकांनी {theme} चा कमी वेळा उल्लेख केला.',
  },
  'responsibility.headline.reviewChange': {
    en: 'Customers mentioned {theme} more often after your change.',
    hi: 'आपके बदलाव के बाद ग्राहकों ने {theme} का ज़्यादा बार ज़िक्र किया।',
    mr: 'तुमच्या बदलानंतर ग्राहकांनी {theme} चा जास्त वेळा उल्लेख केला.',
  },
  'responsibility.headline.protectRecurring': {
    en: 'Customers keep praising your {theme}.',
    hi: 'ग्राहक आपके {theme} की तारीफ़ करते रहते हैं।',
    mr: 'ग्राहक तुमच्या {theme} चं कौतुक करत राहतात.',
  },
  'responsibility.headline.protect': {
    en: 'Customers praise your {theme}.',
    hi: 'ग्राहक आपके {theme} की तारीफ़ करते हैं।',
    mr: 'ग्राहक तुमच्या {theme} चं कौतुक करतात.',
  },
  'responsibility.headline.waitIssue': {
    en: '{theme} has come up, but not often enough to act on.',
    hi: '{theme} सामने आया है, पर इतनी बार नहीं कि उस पर कुछ किया जाए।',
    mr: '{theme} समोर आलं आहे, पण त्यावर काही करण्याइतक्या वेळा नाही.',
  },
  'responsibility.headline.waitPraise': {
    en: 'Customers praise {theme}, but not often enough yet to call it a strength.',
    hi: 'ग्राहक {theme} की तारीफ़ करते हैं, पर अभी इतनी बार नहीं कि इसे मज़बूती कहा जाए।',
    mr: 'ग्राहक {theme} चं कौतुक करतात, पण याला ताकद म्हणण्याइतक्या वेळा अजून नाही.',
  },
  'responsibility.headline.praiseFading': {
    en: 'Customers praised your {theme} less at your last check-in.',
    hi: 'आपके पिछले चेक-इन पर ग्राहकों ने आपके {theme} की कम तारीफ़ की।',
    mr: 'तुमच्या मागच्या चेक-इनला ग्राहकांनी तुमच्या {theme} चं कमी कौतुक केलं.',
  },
  'responsibility.headline.insufficient': {
    en: 'Headway cannot compare yet. Not enough new feedback has come in since your change for {theme}.',
    hi: 'Headway अभी तुलना नहीं कर सकता। {theme} के लिए आपके बदलाव के बाद से इतना नया फ़ीडबैक नहीं आया है।',
    mr: 'Headway अजून तुलना करू शकत नाही. {theme} साठी तुमच्या बदलानंतर पुरेसा नवा फीडबॅक आलेला नाही.',
  },
  'responsibility.headline.noClearChange': {
    en: '{theme} is coming up about as often as before your change.',
    hi: '{theme} लगभग उतनी ही बार आ रहा है जितना आपके बदलाव से पहले आता था।',
    mr: 'तुमच्या बदलाआधी येत होतं साधारण तितक्याच वेळा {theme} येत आहे.',
  },
  'responsibility.headline.worsening': {
    en: '{theme} came up more at your last check-in.',
    hi: 'आपके पिछले चेक-इन पर {theme} ज़्यादा बार आया।',
    mr: 'तुमच्या मागच्या चेक-इनला {theme} जास्त वेळा आलं.',
  },
  'responsibility.headline.secondary': {
    en: '{theme} is a pattern, but not the main problem to fix first.',
    hi: '{theme} एक पैटर्न है, पर सबसे पहले ठीक करने वाली मुख्य समस्या नहीं।',
    mr: '{theme} एक पॅटर्न आहे, पण सर्वात आधी सोडवायची मुख्य अडचण नाही.',
  },

  // -------------------------------------------------------------------------
  // Why an item ranks where it does, each line with its source
  // -------------------------------------------------------------------------
  'responsibility.reason.returning': {
    en: 'It came up less often after your change. Now it is coming up more again.',
    hi: 'आपके बदलाव के बाद यह कम बार आ रहा था। अब यह फिर ज़्यादा बार आ रहा है।',
    mr: 'तुमच्या बदलानंतर हे कमी वेळा येत होतं. आता ते पुन्हा जास्त वेळा येत आहे.',
  },
  'responsibility.reason.agreedPaused': {
    en: 'You agreed a change and then put it on hold.',
    hi: 'आपने एक बदलाव तय किया और फिर उसे रोक दिया।',
    mr: 'तुम्ही एक बदल ठरवला आणि नंतर तो थांबवला.',
  },
  'responsibility.reason.agreedNotDone': {
    en: 'You agreed a change that has not been made yet.',
    hi: 'आपने एक बदलाव तय किया था, जो अभी तक किया नहीं गया है।',
    mr: 'तुम्ही ठरवलेला बदल अजून केलेला नाही.',
  },
  'responsibility.reason.comparisonDue': {
    en: 'Enough new feedback has come in since your change to compare before and after.',
    hi: 'आपके बदलाव के बाद इतना नया फ़ीडबैक आ गया है कि पहले और बाद की तुलना की जा सके।',
    mr: 'तुमच्या बदलानंतर आधी आणि नंतरची तुलना करण्याइतका नवा फीडबॅक आला आहे.',
  },
  'responsibility.reason.measuredWorsened': {
    en: 'Customers mentioned it more often after your change.',
    hi: 'आपके बदलाव के बाद ग्राहकों ने इसका ज़्यादा बार ज़िक्र किया।',
    mr: 'तुमच्या बदलानंतर ग्राहकांनी याचा जास्त वेळा उल्लेख केला.',
  },
  'responsibility.reason.ownerPriority': {
    en: 'You told us this is what matters most right now.',
    hi: 'आपने हमें बताया कि अभी सबसे ज़्यादा यही मायने रखता है।',
    mr: 'तुम्ही आम्हाला सांगितलं की आत्ता हेच सर्वात महत्त्वाचं आहे.',
  },

  // -------------------------------------------------------------------------
  // The thread: what customers said, what you decided, what happened, next
  // -------------------------------------------------------------------------
  'responsibility.thread.observed': {
    en: 'Customers said',
    hi: 'ग्राहकों ने कहा',
    mr: 'ग्राहक म्हणाले',
  },
  'responsibility.thread.decided': {
    en: 'You decided',
    hi: 'आपने तय किया',
    mr: 'तुम्ही ठरवलं',
  },
  'responsibility.thread.changed': {
    en: 'You changed it',
    hi: 'आपने इसे बदला',
    mr: 'तुम्ही ते बदललं',
  },
  'responsibility.thread.result': {
    en: 'What the feedback did',
    hi: 'फ़ीडबैक ने क्या दिखाया',
    mr: 'फीडबॅकने काय दाखवलं',
  },
  'responsibility.thread.now': {
    en: 'Now',
    hi: 'अभी',
    mr: 'आता',
  },
  'responsibility.thread.next': {
    en: 'Headway will watch',
    hi: 'Headway नज़र रखेगा',
    mr: 'Headway लक्ष ठेवेल',
  },
  'responsibility.thread.notDoing': {
    en: 'Not to make this change.',
    hi: 'यह बदलाव नहीं करना।',
    mr: 'हा बदल करायचा नाही.',
  },
  // {note} is the owner's own decision note, reproduced as they wrote it.
  'responsibility.thread.notDoingWithNote': {
    en: 'Not to make this change. {note}',
    hi: 'यह बदलाव नहीं करना। {note}',
    mr: 'हा बदल करायचा नाही. {note}',
  },
  'responsibility.thread.toAct': {
    en: 'To act on this.',
    hi: 'इस पर कुछ करना।',
    mr: 'यावर काहीतरी करायचं.',
  },
  // {decision} is the change in the owner's own words.
  'responsibility.thread.made': {
    en: 'Made: {decision}',
    hi: 'किया: {decision}',
    mr: 'केलं: {decision}',
  },
  'responsibility.thread.madeUnnamed': {
    en: 'You told us the change was in place.',
    hi: 'आपने हमें बताया कि बदलाव लागू हो गया है।',
    mr: 'बदल लागू झाल्याचं तुम्ही आम्हाला सांगितलं.',
  },
  'responsibility.thread.awaitingEnough': {
    en: 'Not compared yet. {have} new feedback entries have come in. That is enough to compare before and after.',
    hi: 'अभी तुलना नहीं की गई। {have} नए फ़ीडबैक आ चुके हैं। पहले और बाद की तुलना के लिए यह काफ़ी है।',
    mr: 'अजून तुलना केलेली नाही. {have} नवे फीडबॅक आले आहेत. आधी आणि नंतरची तुलना करण्यासाठी हे पुरेसं आहे.',
  },
  'responsibility.thread.awaitingShort': {
    en: 'Not compared yet. {have} of the {need} new feedback entries needed have come in.',
    hi: 'अभी तुलना नहीं की गई। ज़रूरी {need} नए फ़ीडबैक में से {have} आ चुके हैं।',
    mr: 'अजून तुलना केलेली नाही. लागणाऱ्या {need} नव्या फीडबॅकपैकी {have} आले आहेत.',
  },
  'responsibility.thread.nowReturning': {
    en: 'It came up less often after your earlier change. Now it is coming up more again.',
    hi: 'आपके पिछले बदलाव के बाद यह कम बार आ रहा था। अब यह फिर ज़्यादा बार आ रहा है।',
    mr: 'तुमच्या आधीच्या बदलानंतर हे कमी वेळा येत होतं. आता ते पुन्हा जास्त वेळा येत आहे.',
  },
  // {movement} is the reading the intelligence engine already wrote.
  'responsibility.thread.nowMovement': {
    en: 'At your last two check-ins: {movement}',
    hi: 'आपके पिछले दो चेक-इन पर: {movement}',
    mr: 'तुमच्या मागच्या दोन चेक-इनला: {movement}',
  },

  // -------------------------------------------------------------------------
  // What this page cannot say
  // -------------------------------------------------------------------------
  'responsibility.limit.early': {
    en: 'This is based on little feedback. Treat it as an early sign, not a conclusion.',
    hi: 'यह थोड़े फ़ीडबैक पर आधारित है। इसे शुरुआती संकेत मानें, नतीजा नहीं।',
    mr: 'हे थोड्या फीडबॅकवर आधारित आहे. हे सुरुवातीचं चिन्ह माना, निष्कर्ष नाही.',
  },
  'responsibility.limit.gatewayPaused': {
    en: 'Your feedback page is paused. Nothing new will come in through the QR code until you switch it back on.',
    hi: 'आपका फ़ीडबैक पेज रोका गया है। जब तक आप इसे दोबारा चालू नहीं करते, QR कोड से कुछ नया नहीं आएगा।',
    mr: 'तुमचं फीडबॅक पेज थांबवलं आहे. तुम्ही ते पुन्हा सुरू करेपर्यंत QR कोडमधून काहीही नवं येणार नाही.',
  },
  'responsibility.limit.archived': {
    en: 'This account is no longer active. Headway is not collecting anything new for it.',
    hi: 'यह अकाउंट अब चालू नहीं है। Headway इसके लिए कुछ नया इकट्ठा नहीं कर रहा।',
    mr: 'हे अकाउंट आता चालू नाही. Headway यासाठी काहीही नवं गोळा करत नाही.',
  },

  // -------------------------------------------------------------------------
  // Feedback the reply engine will not answer: it needs the owner's own words
  // -------------------------------------------------------------------------
  'responsibility.words.reason.one': {
    en: '{count} feedback entry mentions harm, money back or taking things further.',
    hi: '{count} फ़ीडबैक में नुक़सान, पैसे वापसी या बात आगे बढ़ाने का ज़िक्र है।',
    mr: '{count} फीडबॅकमध्ये नुकसान, पैसे परत किंवा पुढे तक्रार नेण्याचा उल्लेख आहे.',
  },
  'responsibility.words.reason.other': {
    en: '{count} feedback entries mention harm, money back or taking things further.',
    hi: '{count} फ़ीडबैक में नुक़सान, पैसे वापसी या बात आगे बढ़ाने का ज़िक्र है।',
    mr: '{count} फीडबॅकमध्ये नुकसान, पैसे परत किंवा पुढे तक्रार नेण्याचा उल्लेख आहे.',
  },
  'responsibility.words.headline.one': {
    en: '{count} feedback entry needs your own words.',
    hi: '{count} फ़ीडबैक के लिए आपके अपने शब्द चाहिए।',
    mr: '{count} फीडबॅकसाठी तुमचे स्वतःचे शब्द हवेत.',
  },
  'responsibility.words.headline.other': {
    en: '{count} feedback entries need your own words.',
    hi: '{count} फ़ीडबैक के लिए आपके अपने शब्द चाहिए।',
    mr: '{count} फीडबॅकसाठी तुमचे स्वतःचे शब्द हवेत.',
  },
  'responsibility.words.why': {
    en: 'Headway does not write a reply when someone mentions harm, safety, money back or taking things further.',
    hi: 'जब कोई नुक़सान, सुरक्षा, पैसे वापसी या बात आगे बढ़ाने की बात करता है, तब Headway जवाब नहीं लिखता।',
    mr: 'कोणी नुकसान, सुरक्षा, पैसे परत किंवा पुढे तक्रार नेण्याबद्दल बोलत असेल, तेव्हा Headway उत्तर लिहीत नाही.',
  },
  'responsibility.words.next': {
    en: 'Open Feedback and answer them. Or tell your Headway contact how you want them handled.',
    hi: 'फ़ीडबैक खोलें और उनका जवाब दें। या अपने Headway संपर्क को बताएँ कि इन्हें कैसे संभालना है।',
    mr: 'फीडबॅक उघडा आणि त्यांना उत्तर द्या. किंवा तुमच्या Headway संपर्काला सांगा की ते कसे हाताळायचे.',
  },
  'responsibility.words.watching': {
    en: 'Headway will flag any new feedback like this as soon as it reads it.',
    hi: 'ऐसा कोई भी नया फ़ीडबैक पढ़ते ही Headway उसे आपके सामने रखेगा।',
    mr: 'असा कोणताही नवा फीडबॅक वाचताच Headway तो तुमच्या समोर आणेल.',
  },

  // -------------------------------------------------------------------------
  // Everything below the evidence floor, as one calm item
  // -------------------------------------------------------------------------
  'responsibility.early.joined': {
    en: '{head} and {last}',
    hi: '{head} और {last}',
    mr: '{head} आणि {last}',
  },
  'responsibility.early.headline': {
    en: '{themes} have come up, but not often enough to act on.',
    hi: '{themes} सामने आए हैं, पर इतनी बार नहीं कि उन पर कुछ किया जाए।',
    mr: '{themes} समोर आले आहेत, पण त्यांवर काही करण्याइतक्या वेळा नाही.',
  },
  'responsibility.early.why': {
    en: 'Headway names a topic once it has come up {min} or more times. Below that it would be guessing.',
    hi: 'कोई बात {min} या उससे ज़्यादा बार आने पर ही Headway उसका नाम लेता है। उससे कम पर वह अंदाज़ा लगा रहा होगा।',
    mr: 'एखादी गोष्ट {min} किंवा त्याहून जास्त वेळा आल्यावरच Headway तिचं नाव घेतं. त्याहून कमी असेल तर तो अंदाज ठरेल.',
  },
  'responsibility.early.next': {
    en: 'Headway will tell you when one of these comes up often enough.',
    hi: 'इनमें से कोई जब काफ़ी बार आने लगेगा, तब Headway आपको बता देगा।',
    mr: 'यांपैकी एखादं पुरेशा वेळा येऊ लागलं की Headway तुम्हाला सांगेल.',
  },
  'responsibility.early.watching': {
    en: 'Headway is watching to see whether these come up again.',
    hi: 'Headway देख रहा है कि ये फिर आते हैं या नहीं।',
    mr: 'हे पुन्हा येतात का ते Headway पाहत आहे.',
  },

  // -------------------------------------------------------------------------
  // The work done since the last check-in
  // -------------------------------------------------------------------------
  'responsibility.since.checkin': {
    en: 'Since your check-in on {date}',
    hi: '{date} के आपके चेक-इन के बाद से',
    mr: '{date} च्या तुमच्या चेक-इननंतर',
  },
  'responsibility.since.start': {
    en: 'Since feedback started coming in',
    hi: 'फ़ीडबैक आना शुरू होने के बाद से',
    mr: 'फीडबॅक येऊ लागल्यापासून',
  },
  'responsibility.did.direct': {
    en: '{count} of them came through your feedback page.',
    hi: 'इनमें से {count} आपके फ़ीडबैक पेज से आए।',
    mr: 'त्यांपैकी {count} तुमच्या फीडबॅक पेजवरून आले.',
  },
  'responsibility.did.read.one': {
    en: 'Since your check-in on {date}, read {count} feedback entry.',
    hi: '{date} के आपके चेक-इन के बाद से {count} फ़ीडबैक पढ़ा।',
    mr: '{date} च्या तुमच्या चेक-इननंतर {count} फीडबॅक वाचला.',
  },
  'responsibility.did.read.other': {
    en: 'Since your check-in on {date}, read {count} feedback entries.',
    hi: '{date} के आपके चेक-इन के बाद से {count} फ़ीडबैक पढ़े।',
    mr: '{date} च्या तुमच्या चेक-इननंतर {count} फीडबॅक वाचले.',
  },
  'responsibility.did.unread.one': {
    en: 'Since your check-in on {date}, {count} feedback entry has come in. Headway is reading it now.',
    hi: '{date} के आपके चेक-इन के बाद से {count} फ़ीडबैक आया है। Headway उसे अभी पढ़ रहा है।',
    mr: '{date} च्या तुमच्या चेक-इननंतर {count} फीडबॅक आला आहे. Headway तो आत्ता वाचत आहे.',
  },
  'responsibility.did.unread.other': {
    en: 'Since your check-in on {date}, {count} feedback entries have come in. Headway is reading them now.',
    hi: '{date} के आपके चेक-इन के बाद से {count} फ़ीडबैक आए हैं। Headway उन्हें अभी पढ़ रहा है।',
    mr: '{date} च्या तुमच्या चेक-इननंतर {count} फीडबॅक आले आहेत. Headway ते आत्ता वाचत आहे.',
  },
  'responsibility.did.none': {
    en: 'No new feedback has come in since your check-in on {date}.',
    hi: '{date} के आपके चेक-इन के बाद से कोई नया फ़ीडबैक नहीं आया।',
    mr: '{date} च्या तुमच्या चेक-इननंतर नवा फीडबॅक आलेला नाही.',
  },
  'responsibility.did.readingMore': {
    en: 'Reading {count} more now.',
    hi: '{count} और अभी पढ़े जा रहे हैं।',
    mr: 'आणखी {count} आत्ता वाचत आहोत.',
  },
  'responsibility.did.readTotal.one': {
    en: 'Read {count} feedback entry.',
    hi: '{count} फ़ीडबैक पढ़ा।',
    mr: '{count} फीडबॅक वाचला.',
  },
  'responsibility.did.readTotal.other': {
    en: 'Read {count} feedback entries.',
    hi: '{count} फ़ीडबैक पढ़े।',
    mr: '{count} फीडबॅक वाचले.',
  },
  'responsibility.did.readingNow.one': {
    en: 'Reading {count} feedback entry now.',
    hi: '{count} फ़ीडबैक अभी पढ़ा जा रहा है।',
    mr: '{count} फीडबॅक आत्ता वाचत आहोत.',
  },
  'responsibility.did.readingNow.other': {
    en: 'Reading {count} feedback entries now.',
    hi: '{count} फ़ीडबैक अभी पढ़े जा रहे हैं।',
    mr: '{count} फीडबॅक आत्ता वाचत आहोत.',
  },
  'responsibility.did.checkedSince': {
    en: 'Checked whether {theme} is still coming up in the new feedback.',
    hi: 'जाँचा कि नए फ़ीडबैक में {theme} अब भी आ रहा है या नहीं।',
    mr: 'नव्या फीडबॅकमध्ये {theme} अजूनही येत आहे का ते तपासलं.',
  },
  'responsibility.did.checkedAll': {
    en: 'Checked whether {theme} keeps coming up across everything read.',
    hi: 'जाँचा कि जो कुछ पढ़ा गया है, उस सब में {theme} बार-बार आता है या नहीं।',
    mr: 'वाचलेल्या सगळ्यामध्ये {theme} वारंवार येत आहे का ते तपासलं.',
  },
  'responsibility.did.noProblem': {
    en: 'Found no new problem big enough to act on.',
    hi: 'ऐसी कोई नई समस्या नहीं मिली जो कुछ करने लायक़ बड़ी हो।',
    mr: 'काही करण्याइतकी मोठी नवी अडचण आढळली नाही.',
  },

  // -------------------------------------------------------------------------
  // The next useful check: a condition, never a countdown
  // -------------------------------------------------------------------------
  'responsibility.next.compareOne': {
    en: 'Headway can now compare your change before and after.',
    hi: 'Headway अब आपके बदलाव की पहले और बाद की तुलना कर सकता है।',
    mr: 'Headway आता तुमच्या बदलाची आधी आणि नंतरची तुलना करू शकतं.',
  },
  'responsibility.next.compareMany': {
    en: 'Headway can now compare {count} of your changes before and after.',
    hi: 'Headway अब आपके {count} बदलावों की पहले और बाद की तुलना कर सकता है।',
    mr: 'Headway आता तुमच्या {count} बदलांची आधी आणि नंतरची तुलना करू शकतं.',
  },
  'responsibility.next.firstCheckin': {
    en: 'Once feedback starts coming in, do a first check-in. It gives Headway something to compare against later.',
    hi: 'फ़ीडबैक आना शुरू हो जाए, तो पहला चेक-इन कर लें। इससे Headway को बाद में तुलना करने के लिए कुछ मिल जाता है।',
    mr: 'फीडबॅक येऊ लागल्यावर पहिलं चेक-इन करा. त्यामुळे Headway ला नंतर तुलना करण्यासाठी काहीतरी मिळतं.',
  },
  'responsibility.next.firstNow': {
    en: 'A first check-in now would give Headway something to compare your next one against.',
    hi: 'अभी पहला चेक-इन कर लेने से Headway को आपके अगले चेक-इन से तुलना करने के लिए कुछ मिल जाएगा।',
    mr: 'आत्ता पहिलं चेक-इन केलं तर तुमच्या पुढच्या चेक-इनशी तुलना करण्यासाठी Headway ला काहीतरी मिळेल.',
  },
  'responsibility.next.secondReady.one': {
    en: 'A second check-in now would show what changed. {count} feedback entry has come in since the first.',
    hi: 'अभी दूसरा चेक-इन करने से पता चलेगा कि क्या बदला। पहले चेक-इन के बाद से {count} फ़ीडबैक आया है।',
    mr: 'आत्ता दुसरं चेक-इन केलं तर काय बदललं ते दिसेल. पहिल्या चेक-इननंतर {count} फीडबॅक आला आहे.',
  },
  'responsibility.next.secondReady.other': {
    en: 'A second check-in now would show what changed. {count} feedback entries have come in since the first.',
    hi: 'अभी दूसरा चेक-इन करने से पता चलेगा कि क्या बदला। पहले चेक-इन के बाद से {count} फ़ीडबैक आए हैं।',
    mr: 'आत्ता दुसरं चेक-इन केलं तर काय बदललं ते दिसेल. पहिल्या चेक-इननंतर {count} फीडबॅक आले आहेत.',
  },
  'responsibility.next.secondWaiting.one': {
    en: 'A second check-in will show what changed. Headway needs {need} new feedback entries to compare. {count} has come in so far.',
    hi: 'दूसरा चेक-इन दिखाएगा कि क्या बदला। तुलना के लिए Headway को {need} नए फ़ीडबैक चाहिए। अब तक {count} आया है।',
    mr: 'दुसरं चेक-इन काय बदललं ते दाखवेल. तुलनेसाठी Headway ला {need} नवे फीडबॅक लागतात. आतापर्यंत {count} आला आहे.',
  },
  'responsibility.next.secondWaiting.other': {
    en: 'A second check-in will show what changed. Headway needs {need} new feedback entries to compare. {count} have come in so far.',
    hi: 'दूसरा चेक-इन दिखाएगा कि क्या बदला। तुलना के लिए Headway को {need} नए फ़ीडबैक चाहिए। अब तक {count} आए हैं।',
    mr: 'दुसरं चेक-इन काय बदललं ते दाखवेल. तुलनेसाठी Headway ला {need} नवे फीडबॅक लागतात. आतापर्यंत {count} आले आहेत.',
  },
  'responsibility.next.worthNow.one': {
    en: 'Worth a check-in now. {count} feedback entry has come in since {date}. That is enough to show what changed.',
    hi: 'अभी चेक-इन करना ठीक रहेगा। {date} के बाद से {count} फ़ीडबैक आया है। यह दिखाने के लिए काफ़ी है कि क्या बदला।',
    mr: 'आत्ता चेक-इन करणं योग्य ठरेल. {date} नंतर {count} फीडबॅक आला आहे. काय बदललं हे दाखवण्यासाठी हे पुरेसं आहे.',
  },
  'responsibility.next.worthNow.other': {
    en: 'Worth a check-in now. {count} feedback entries have come in since {date}. That is enough to show what changed.',
    hi: 'अभी चेक-इन करना ठीक रहेगा। {date} के बाद से {count} फ़ीडबैक आए हैं। यह दिखाने के लिए काफ़ी है कि क्या बदला।',
    mr: 'आत्ता चेक-इन करणं योग्य ठरेल. {date} नंतर {count} फीडबॅक आले आहेत. काय बदललं हे दाखवण्यासाठी हे पुरेसं आहे.',
  },
  'responsibility.next.stale.one': {
    en: 'Worth a check-in now. It has been {days} days since your last one. Only {count} feedback entry has come in since then.',
    hi: 'अभी चेक-इन करना ठीक रहेगा। आपके पिछले चेक-इन को {days} दिन हो गए हैं। तब से सिर्फ़ {count} फ़ीडबैक आया है।',
    mr: 'आत्ता चेक-इन करणं योग्य ठरेल. तुमच्या मागच्या चेक-इनला {days} दिवस झाले आहेत. तेव्हापासून फक्त {count} फीडबॅक आला आहे.',
  },
  'responsibility.next.stale.other': {
    en: 'Worth a check-in now. It has been {days} days since your last one. Only {count} feedback entries have come in since then.',
    hi: 'अभी चेक-इन करना ठीक रहेगा। आपके पिछले चेक-इन को {days} दिन हो गए हैं। तब से सिर्फ़ {count} फ़ीडबैक आए हैं।',
    mr: 'आत्ता चेक-इन करणं योग्य ठरेल. तुमच्या मागच्या चेक-इनला {days} दिवस झाले आहेत. तेव्हापासून फक्त {count} फीडबॅक आले आहेत.',
  },
  'responsibility.next.notYetNone': {
    en: 'Not yet. No new feedback has come in since your check-in on {date}. Headway will tell you when another check-in would show something new.',
    hi: 'अभी नहीं। {date} के आपके चेक-इन के बाद से कोई नया फ़ीडबैक नहीं आया। जब एक और चेक-इन से कुछ नया दिखेगा, तब Headway आपको बता देगा।',
    mr: 'अजून नाही. {date} च्या तुमच्या चेक-इननंतर नवा फीडबॅक आलेला नाही. आणखी एका चेक-इनमधून काही नवं दिसेल तेव्हा Headway तुम्हाला सांगेल.',
  },
  'responsibility.next.notYet.one': {
    en: 'Not yet. {count} feedback entry has come in since your check-in on {date}. Headway will tell you when another check-in would show something new.',
    hi: 'अभी नहीं। {date} के आपके चेक-इन के बाद से {count} फ़ीडबैक आया है। जब एक और चेक-इन से कुछ नया दिखेगा, तब Headway आपको बता देगा।',
    mr: 'अजून नाही. {date} च्या तुमच्या चेक-इननंतर {count} फीडबॅक आला आहे. आणखी एका चेक-इनमधून काही नवं दिसेल तेव्हा Headway तुम्हाला सांगेल.',
  },
  'responsibility.next.notYet.other': {
    en: 'Not yet. {count} feedback entries have come in since your check-in on {date}. Headway will tell you when another check-in would show something new.',
    hi: 'अभी नहीं। {date} के आपके चेक-इन के बाद से {count} फ़ीडबैक आए हैं। जब एक और चेक-इन से कुछ नया दिखेगा, तब Headway आपको बता देगा।',
    mr: 'अजून नाही. {date} च्या तुमच्या चेक-इननंतर {count} फीडबॅक आले आहेत. आणखी एका चेक-इनमधून काही नवं दिसेल तेव्हा Headway तुम्हाला सांगेल.',
  },

  // -------------------------------------------------------------------------
  // The answer to the one question: do I need to do anything?
  // -------------------------------------------------------------------------
  'responsibility.answer.none': {
    en: 'Nothing to decide yet.',
    hi: 'अभी कुछ तय करने को नहीं है।',
    mr: 'अजून काही ठरवायचं नाही.',
  },
  'responsibility.answer.arriving.one': {
    en: '{count} feedback entry has arrived. Headway is reading it now. This usually takes less than a minute. Reload the page to see what it found.',
    hi: '{count} फ़ीडबैक आया है। Headway उसे अभी पढ़ रहा है। इसमें आम तौर पर एक मिनट से कम लगता है। उसने क्या पाया, यह देखने के लिए पेज दोबारा लोड करें।',
    mr: '{count} फीडबॅक आला आहे. Headway तो आत्ता वाचत आहे. यासाठी सहसा एका मिनिटापेक्षा कमी वेळ लागतो. त्याला काय आढळलं ते पाहण्यासाठी पेज पुन्हा लोड करा.',
  },
  'responsibility.answer.arriving.other': {
    en: '{count} feedback entries have arrived. Headway is reading them now. This usually takes less than a minute. Reload the page to see what it found.',
    hi: '{count} फ़ीडबैक आए हैं। Headway उन्हें अभी पढ़ रहा है। इसमें आम तौर पर एक मिनट से कम लगता है। उसने क्या पाया, यह देखने के लिए पेज दोबारा लोड करें।',
    mr: '{count} फीडबॅक आले आहेत. Headway ते आत्ता वाचत आहे. यासाठी सहसा एका मिनिटापेक्षा कमी वेळ लागतो. त्याला काय आढळलं ते पाहण्यासाठी पेज पुन्हा लोड करा.',
  },
  'responsibility.answer.noneYet': {
    en: 'Headway has no customer feedback yet. Once it starts coming in, this page will tell you what needs your attention.',
    hi: 'Headway के पास अभी ग्राहकों का कोई फ़ीडबैक नहीं है। जैसे ही वह आना शुरू होगा, यह पेज बताएगा कि आपको किस पर ध्यान देना है।',
    mr: 'Headway कडे अजून ग्राहकांचा फीडबॅक नाही. तो येऊ लागला की हे पेज तुम्हाला कशाकडे लक्ष द्यायचं ते सांगेल.',
  },
  'responsibility.answer.oneDoNow': {
    en: 'Yes — one thing needs a decision from you.',
    hi: 'हाँ — एक बात पर आपका फ़ैसला चाहिए।',
    mr: 'होय — एका गोष्टीवर तुमचा निर्णय हवा आहे.',
  },
  'responsibility.answer.oneFollow': {
    en: 'Yes — one thing to follow through on.',
    hi: 'हाँ — एक बात पूरी करनी है।',
    mr: 'होय — एक गोष्ट पूर्ण करायची आहे.',
  },
  'responsibility.answer.some': {
    en: 'Yes — {bits}.',
    hi: 'हाँ — {bits}।',
    mr: 'होय — {bits}.',
  },
  'responsibility.answer.bit.doNow.one': {
    en: '{count} thing needs a decision',
    hi: '{count} बात पर फ़ैसला चाहिए',
    mr: '{count} गोष्टीवर निर्णय हवा',
  },
  'responsibility.answer.bit.doNow.other': {
    en: '{count} things need decisions',
    hi: '{count} बातों पर फ़ैसले चाहिए',
    mr: '{count} गोष्टींवर निर्णय हवेत',
  },
  // English says it the same way either way; Marathi does not, which is why
  // this is a plural pair with two identical English sides.
  'responsibility.answer.bit.follow.one': {
    en: '{count} to follow through on',
    hi: '{count} को पूरा करना है',
    mr: '{count} पूर्ण करायची आहे',
  },
  'responsibility.answer.bit.follow.other': {
    en: '{count} to follow through on',
    hi: '{count} को पूरा करना है',
    mr: '{count} पूर्ण करायच्या आहेत',
  },
  'responsibility.answer.watchingOther.one': {
    en: 'Headway is watching {count} other thing for you. None of them needs your attention right now.',
    hi: 'Headway आपके लिए {count} और बात पर नज़र रखे हुए है। अभी उनमें से किसी पर आपका ध्यान देने की ज़रूरत नहीं है।',
    mr: 'Headway तुमच्यासाठी आणखी {count} गोष्टीवर लक्ष ठेवत आहे. आत्ता त्यांपैकी कशाकडेही तुमचं लक्ष द्यायची गरज नाही.',
  },
  'responsibility.answer.watchingOther.other': {
    en: 'Headway is watching {count} other things for you. None of them needs your attention right now.',
    hi: 'Headway आपके लिए {count} और बातों पर नज़र रखे हुए है। अभी उनमें से किसी पर आपका ध्यान देने की ज़रूरत नहीं है।',
    mr: 'Headway तुमच्यासाठी आणखी {count} गोष्टींवर लक्ष ठेवत आहे. आत्ता त्यांपैकी कशाकडेही तुमचं लक्ष द्यायची गरज नाही.',
  },
  'responsibility.answer.nothingElse': {
    en: 'Nothing else needs your attention.',
    hi: 'और किसी चीज़ पर आपका ध्यान देने की ज़रूरत नहीं है।',
    mr: 'बाकी कशाकडेही तुमचं लक्ष द्यायची गरज नाही.',
  },
  'responsibility.answer.notEnough': {
    en: 'Not enough feedback yet to say.',
    hi: 'कुछ कहने के लिए अभी इतना फ़ीडबैक नहीं है।',
    mr: 'काही सांगण्याइतका फीडबॅक अजून नाही.',
  },
  'responsibility.answer.notEnoughDetail.one': {
    en: 'Headway has read {count} feedback entry. That is enough to start looking, but not enough to be sure of anything. Headway will not suggest anything until more feedback comes in.',
    hi: 'Headway ने {count} फ़ीडबैक पढ़ा है। देखना शुरू करने के लिए यह काफ़ी है, पर किसी बात का पक्का होने के लिए नहीं। जब तक और फ़ीडबैक नहीं आता, Headway कुछ नहीं सुझाएगा।',
    mr: 'Headway ने {count} फीडबॅक वाचला आहे. बघायला सुरुवात करण्यासाठी हे पुरेसं आहे, पण कशाचीही खात्री देण्यासाठी नाही. आणखी फीडबॅक येईपर्यंत Headway काहीही सुचवणार नाही.',
  },
  'responsibility.answer.notEnoughDetail.other': {
    en: 'Headway has read {count} feedback entries. That is enough to start looking, but not enough to be sure of anything. Headway will not suggest anything until more feedback comes in.',
    hi: 'Headway ने {count} फ़ीडबैक पढ़े हैं। देखना शुरू करने के लिए यह काफ़ी है, पर किसी बात का पक्का होने के लिए नहीं। जब तक और फ़ीडबैक नहीं आता, Headway कुछ नहीं सुझाएगा।',
    mr: 'Headway ने {count} फीडबॅक वाचले आहेत. बघायला सुरुवात करण्यासाठी हे पुरेसं आहे, पण कशाचीही खात्री देण्यासाठी नाही. आणखी फीडबॅक येईपर्यंत Headway काहीही सुचवणार नाही.',
  },
  'responsibility.answer.clear': {
    en: 'Nothing needs your attention right now.',
    hi: 'अभी किसी चीज़ पर आपका ध्यान देने की ज़रूरत नहीं है।',
    mr: 'आत्ता कशाकडेही तुमचं लक्ष द्यायची गरज नाही.',
  },
  'responsibility.answer.watchingClear.one': {
    en: 'Headway is watching {count} thing for you. It will tell you when one of them needs a decision.',
    hi: 'Headway आपके लिए {count} बात पर नज़र रखे हुए है। जब उनमें से किसी पर फ़ैसला चाहिए होगा, तब वह आपको बता देगा।',
    mr: 'Headway तुमच्यासाठी {count} गोष्टीवर लक्ष ठेवत आहे. त्यांपैकी कशावर निर्णय हवा असेल तेव्हा ते तुम्हाला सांगेल.',
  },
  'responsibility.answer.watchingClear.other': {
    en: 'Headway is watching {count} things for you. It will tell you when one of them needs a decision.',
    hi: 'Headway आपके लिए {count} बातों पर नज़र रखे हुए है। जब उनमें से किसी पर फ़ैसला चाहिए होगा, तब वह आपको बता देगा।',
    mr: 'Headway तुमच्यासाठी {count} गोष्टींवर लक्ष ठेवत आहे. त्यांपैकी कशावर निर्णय हवा असेल तेव्हा ते तुम्हाला सांगेल.',
  },
  'responsibility.answer.clearDetail': {
    en: 'Nothing is coming up often enough to act on. Headway will tell you when that changes.',
    hi: 'कुछ भी इतनी बार नहीं आ रहा कि उस पर कुछ किया जाए। जब यह बदलेगा, तब Headway आपको बता देगा।',
    mr: 'काहीही करण्याइतक्या वेळा येत नाही. हे बदलेल तेव्हा Headway तुम्हाला सांगेल.',
  },
} satisfies Namespace;
