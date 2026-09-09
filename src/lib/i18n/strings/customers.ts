import type { Namespace } from '../t';

/**
 * Customers (route: analysis) — who is walking in and what they say
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 */
export const customers = {
  // ---- the page itself -----------------------------------------------------
  'customers.page.eyebrow': {
    en: 'Customers',
    hi: 'ग्राहक',
    mr: 'ग्राहक',
  },
  'customers.page.title': {
    en: 'What your customers are telling you',
    hi: 'आपके ग्राहक आपको क्या बता रहे हैं',
    mr: 'तुमचे ग्राहक तुम्हाला काय सांगत आहेत',
  },
  'customers.page.empty': {
    en: 'No feedback yet. Once customers give feedback through your QR code, this page will show what they keep mentioning and what needs your attention first.',
    hi: 'अभी तक कोई फ़ीडबैक नहीं आया है। जब ग्राहक आपके QR कोड से फ़ीडबैक देंगे, तब यह पेज बताएगा कि वे किस बात का बार-बार ज़िक्र करते हैं और सबसे पहले किस बात पर आपका ध्यान चाहिए।',
    mr: 'अजून कोणताही फीडबॅक आलेला नाही. ग्राहकांनी तुमच्या QR कोडमधून फीडबॅक दिल्यावर, हे पेज सांगेल की ते कशाचा वारंवार उल्लेख करतात आणि सर्वात आधी कशाकडे तुमचं लक्ष हवं आहे.',
  },
  'customers.page.everything': {
    en: 'Everything customers mentioned, pattern or not',
    hi: 'ग्राहकों ने जो भी कहा, चाहे उसमें कोई पैटर्न बने या न बने',
    mr: 'ग्राहकांनी जे काही सांगितलं, त्यात पॅटर्न असो वा नसो',
  },

  // ---- the four piles, by importance --------------------------------------
  'customers.group.needsAttention.label': {
    en: 'Needs your attention',
    hi: 'आपका ध्यान चाहिए',
    mr: 'तुमचं लक्ष हवं आहे',
  },
  'customers.group.needsAttention.note': {
    en: 'These need a decision from you.',
    hi: 'इन पर आपको फ़ैसला लेना है।',
    mr: 'यावर तुम्हाला निर्णय घ्यायचा आहे.',
  },
  'customers.group.watching.label': {
    en: 'Watching',
    hi: 'नज़र रखी जा रही है',
    mr: 'लक्ष ठेवलं आहे',
  },
  'customers.group.watching.note': {
    en: 'Customers keep mentioning these. Nothing to decide yet.',
    hi: 'ग्राहक इनका ज़िक्र बार-बार करते हैं। अभी कुछ तय करने की ज़रूरत नहीं है।',
    mr: 'ग्राहक यांचा उल्लेख वारंवार करतात. अजून काही ठरवायची गरज नाही.',
  },
  'customers.group.goingWell.label': {
    en: 'Going well',
    hi: 'अच्छा चल रहा है',
    mr: 'चांगलं चाललं आहे',
  },
  'customers.group.goingWell.note': {
    en: 'Customers praised these 3 or more times.',
    hi: 'ग्राहकों ने इनकी 3 या उससे ज़्यादा बार तारीफ़ की है।',
    mr: 'ग्राहकांनी यांचं 3 किंवा त्याहून जास्त वेळा कौतुक केलं आहे.',
  },
  'customers.group.notClear.label': {
    en: 'Not yet clear',
    hi: 'अभी साफ़ नहीं है',
    mr: 'अजून स्पष्ट नाही',
  },
  'customers.group.notClear.note': {
    en: 'Customers mentioned these, but not often enough to act on.',
    hi: 'ग्राहकों ने इनका ज़िक्र किया है, लेकिन कुछ करने लायक इतनी बार नहीं।',
    mr: 'ग्राहकांनी यांचा उल्लेख केला आहे, पण काही करण्याइतक्या वेळा नाही.',
  },

  // ---- what tapping a card does -------------------------------------------
  'customers.cta.seeWhy': {
    en: 'See why',
    hi: 'वजह देखें',
    mr: 'कारण पाहा',
  },
  'customers.cta.seeMentions': {
    en: 'See the mentions',
    hi: 'ज़िक्र देखें',
    mr: 'उल्लेख पाहा',
  },
  'customers.cta.close': {
    en: 'Close',
    hi: 'बंद करें',
    mr: 'बंद करा',
  },

  // ---- the figures on the face of a card ----------------------------------
  'customers.card.mentions.one': {
    en: '{count} mention',
    hi: '{count} बार ज़िक्र',
    mr: '{count} वेळा उल्लेख',
  },
  'customers.card.mentions.other': {
    en: '{count} mentions',
    hi: '{count} बार ज़िक्र',
    mr: '{count} वेळा उल्लेख',
  },
  'customers.trend.same': {
    en: 'about the same',
    hi: 'लगभग वैसा ही',
    mr: 'साधारण तसंच',
  },
  'customers.trend.mentioned': {
    en: 'Mentioned',
    hi: 'ज़िक्र',
    mr: 'उल्लेख',
  },
  'customers.trend.moreOften': {
    en: 'more often',
    hi: 'ज़्यादा बार',
    mr: 'जास्त वेळा',
  },
  'customers.trend.lessOften': {
    en: 'less often',
    hi: 'कम बार',
    mr: 'कमी वेळा',
  },

  // ---- what came next after a change. Never what the change caused. -------
  'customers.outcome.improved': {
    en: 'Mentioned less often after the change',
    hi: 'बदलाव के बाद कम बार ज़िक्र हुआ',
    mr: 'बदलानंतर कमी वेळा उल्लेख झाला',
  },
  'customers.outcome.worsened': {
    en: 'Mentioned more often after the change',
    hi: 'बदलाव के बाद ज़्यादा बार ज़िक्र हुआ',
    mr: 'बदलानंतर जास्त वेळा उल्लेख झाला',
  },
  'customers.outcome.noChange': {
    en: 'No clear difference after the change',
    hi: 'बदलाव के बाद कोई साफ़ फ़र्क़ नहीं दिखा',
    mr: 'बदलानंतर स्पष्ट फरक दिसला नाही',
  },
  'customers.outcome.notEnough': {
    en: 'Not enough feedback after the change',
    hi: 'बदलाव के बाद इतना फ़ीडबैक नहीं आया',
    mr: 'बदलानंतर पुरेसा फीडबॅक आला नाही',
  },

  // ---- what customers tapped on the feedback page -------------------------
  'customers.tapped.label': {
    en: 'What customers tapped',
    hi: 'ग्राहकों ने क्या टैप किया',
    mr: 'ग्राहकांनी काय टॅप केलं',
  },
  'customers.tapped.single': {
    en: 'One customer rated {topic} on your feedback page: {score} out of 5.',
    hi: 'एक ग्राहक ने आपके फ़ीडबैक पेज पर {topic} को रेटिंग दी: 5 में से {score}।',
    mr: 'एका ग्राहकाने तुमच्या फीडबॅक पेजवर {topic} ला रेटिंग दिली: 5 पैकी {score}.',
  },
  'customers.tapped.none': {
    en: '{rated} customers rated {topic} on your feedback page: {average} out of 5 on average. None of them rated it 3 or below.',
    hi: '{rated} ग्राहकों ने आपके फ़ीडबैक पेज पर {topic} को रेटिंग दी: औसतन 5 में से {average}। इनमें से किसी ने भी 3 या उससे कम रेटिंग नहीं दी।',
    mr: '{rated} ग्राहकांनी तुमच्या फीडबॅक पेजवर {topic} ला रेटिंग दिली: सरासरी 5 पैकी {average}. यांपैकी कोणीही 3 किंवा त्याहून कमी रेटिंग दिली नाही.',
  },
  'customers.tapped.all': {
    en: '{rated} customers rated {topic} on your feedback page: {average} out of 5 on average. All of them rated it 3 or below.',
    hi: '{rated} ग्राहकों ने आपके फ़ीडबैक पेज पर {topic} को रेटिंग दी: औसतन 5 में से {average}। इनमें से सभी ने 3 या उससे कम रेटिंग दी।',
    mr: '{rated} ग्राहकांनी तुमच्या फीडबॅक पेजवर {topic} ला रेटिंग दिली: सरासरी 5 पैकी {average}. यांपैकी सर्वांनी 3 किंवा त्याहून कमी रेटिंग दिली.',
  },
  'customers.tapped.some': {
    en: '{rated} customers rated {topic} on your feedback page: {average} out of 5 on average. {low} of them rated it 3 or below.',
    hi: '{rated} ग्राहकों ने आपके फ़ीडबैक पेज पर {topic} को रेटिंग दी: औसतन 5 में से {average}। इनमें से {low} ने 3 या उससे कम रेटिंग दी।',
    mr: '{rated} ग्राहकांनी तुमच्या फीडबॅक पेजवर {topic} ला रेटिंग दिली: सरासरी 5 पैकी {average}. यांपैकी {low} जणांनी 3 किंवा त्याहून कमी रेटिंग दिली.',
  },

  // ---- the rows an opened card is made of ---------------------------------
  'customers.card.saying': {
    en: 'What customers are saying',
    hi: 'ग्राहक क्या कह रहे हैं',
    mr: 'ग्राहक काय म्हणत आहेत',
  },
  'customers.card.noWordsIssue': {
    en: 'Nobody has written about this yet. This comes from what customers tapped on your feedback page.',
    hi: 'इस बारे में अभी तक किसी ने कुछ लिखा नहीं है। यह ग्राहकों ने आपके फ़ीडबैक पेज पर जो टैप किया, उससे आया है।',
    mr: 'याबद्दल अजून कोणीही काही लिहिलेलं नाही. ग्राहकांनी तुमच्या फीडबॅक पेजवर जे टॅप केलं, त्यातून हे आलं आहे.',
  },
  'customers.card.noWords': {
    en: 'Nobody has written about this yet.',
    hi: 'इस बारे में अभी तक किसी ने कुछ लिखा नहीं है।',
    mr: 'याबद्दल अजून कोणीही काही लिहिलेलं नाही.',
  },
  'customers.card.sees': {
    en: 'What Headway sees',
    hi: 'Headway को क्या दिख रहा है',
    mr: 'Headway ला काय दिसतं',
  },
  'customers.card.youToldUs': {
    en: 'You told us',
    hi: 'आपने हमें बताया',
    mr: 'तुम्ही आम्हाला सांगितलं',
  },
  'customers.card.afterChangeLink': {
    en: 'See what happened after the change',
    hi: 'बदलाव के बाद क्या हुआ, वह देखें',
    mr: 'बदलानंतर काय झालं ते पाहा',
  },
  'customers.card.whatToDo': {
    en: 'What to do',
    hi: 'क्या करना है',
    mr: 'काय करायचं',
  },
  'customers.card.whatToKeep': {
    en: 'What to keep doing',
    hi: 'क्या करते रहना है',
    mr: 'काय करत राहायचं',
  },
  'customers.card.why': {
    en: 'Why',
    hi: 'क्यों',
    mr: 'का',
  },
  'customers.card.checkNext': {
    en: 'Headway will check next',
    hi: 'Headway आगे क्या देखेगा',
    mr: 'Headway पुढे काय पाहील',
  },
  'customers.card.basedOn': {
    en: 'What Headway based this on',
    hi: 'Headway ने यह किस आधार पर कहा',
    mr: 'Headway ने हे कशाच्या आधारावर सांगितलं',
  },
  'customers.card.basis.one': {
    en: '{count} of {total} feedback entry Headway has read.',
    hi: 'Headway ने जो {total} फ़ीडबैक पढ़ा है, उसमें से {count}।',
    mr: 'Headway ने जो {total} फीडबॅक वाचला आहे, त्यातील {count}.',
  },
  'customers.card.basis.other': {
    en: '{count} of {total} feedback entries Headway has read.',
    hi: 'Headway ने जो {total} फ़ीडबैक पढ़े हैं, उनमें से {count}।',
    mr: 'Headway ने जे {total} फीडबॅक वाचले आहेत, त्यांपैकी {count}.',
  },
  'customers.card.lastTwoCheckins': {
    en: 'At your last two check-ins: {line}',
    hi: 'आपके पिछले दो चेक-इन पर: {line}',
    mr: 'तुमच्या मागच्या दोन चेक-इनला: {line}',
  },

  // ---- what changed between two check-ins ---------------------------------
  'customers.changed.summary': {
    en: 'Show what changed between your check-ins',
    hi: 'आपके चेक-इन के बीच क्या बदला, वह दिखाएँ',
    mr: 'तुमच्या चेक-इनमध्ये काय बदललं ते दाखवा',
  },
  'customers.changed.worse': {
    en: 'Getting worse',
    hi: 'बिगड़ रहा है',
    mr: 'बिघडत आहे',
  },
  'customers.changed.better': {
    en: 'Getting better',
    hi: 'सुधर रहा है',
    mr: 'सुधारत आहे',
  },
  'customers.changed.steady': {
    en: 'About the same: {themes}.',
    hi: 'लगभग वैसा ही: {themes}।',
    mr: 'साधारण तसंच: {themes}.',
  },

  // ---- how Headway read the feedback --------------------------------------
  'customers.method.summary': {
    en: 'How Headway read this',
    hi: 'Headway ने इसे कैसे पढ़ा',
    mr: 'Headway ने हे कसं वाचलं',
  },
} satisfies Namespace;
