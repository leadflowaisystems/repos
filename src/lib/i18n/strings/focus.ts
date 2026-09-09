import type { Namespace } from '../t';

/**
 * The sentences Headway writes about the evidence: headline, why, evidence lines
 *
 * GENERATED SENTENCES (src/lib/portal/focus.ts). These are written by pure
 * builder functions that are handed a translator, never a locale — so a phrase
 * here may be assembled from placeholders the builder fills, and the
 * placeholders must be identical in all three languages. Word order is not:
 * Hindi and Marathi put a total before its count, and the verb last, which is
 * exactly why every entry below is a WHOLE SENTENCE and not a fragment.
 *
 * The WHY line an owner reads first — "Customers like your food — 32 praised
 * it. The main problem they mention is slow service." — used to be built in
 * English by gluing a keep clause, a verb and a why clause together. Glue only
 * works in English. Each of those sentences is one key here, and the two verb
 * forms ("mention" / "keep mentioning") are two whole sentences rather than a
 * word dropped into a hole, because in Hindi and Marathi the verb sits at the
 * end and the theme in the middle.
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 *
 * NEVER TRANSLATED, ONLY INTERPOLATED: {theme} (a pack label, from
 * packs/*.json), {suggestion} (the pack's own words, frozen on the action),
 * {share}, {before}, {after}, {counts}, {average}, {date} and every count.
 */
export const focus = {
  // -------------------------------------------------------------------------
  // The headline: the largest text on the page
  // -------------------------------------------------------------------------
  'focus.headline.reading': {
    en: 'Feedback has arrived. Headway is reading it now.',
    hi: 'फ़ीडबैक आ चुका है। Headway उसे अभी पढ़ रहा है।',
    mr: 'फीडबॅक आलेला आहे. Headway तो आता वाचत आहे.',
  },
  'focus.headline.none': {
    en: 'No customer feedback yet.',
    hi: 'अभी तक कोई ग्राहक फ़ीडबैक नहीं आया।',
    mr: 'अजून कोणताही ग्राहक फीडबॅक आलेला नाही.',
  },
  'focus.headline.tooEarly': {
    en: 'Too early to say what needs your attention.',
    hi: 'किस बात पर आपका ध्यान चाहिए, यह कहना अभी जल्दबाज़ी होगी।',
    mr: 'कशाकडे तुमचं लक्ष हवं आहे हे सांगणं अजून खूप लवकर आहे.',
  },
  'focus.headline.fix': {
    en: '{theme} is the main thing to fix.',
    hi: '{theme} सबसे पहले ठीक करने वाली बात है।',
    mr: '{theme} ही सर्वात आधी दुरुस्त करण्याची गोष्ट आहे.',
  },
  'focus.headline.look': {
    en: '{theme} is the main thing to look at.',
    hi: '{theme} सबसे पहले देखने वाली बात है।',
    mr: '{theme} ही सर्वात आधी बघण्याची गोष्ट आहे.',
  },
  'focus.headline.nothing': {
    en: 'Nothing needs your attention right now.',
    hi: 'अभी किसी बात पर आपका ध्यान ज़रूरी नहीं है।',
    mr: 'सध्या कशाकडेही तुमचं लक्ष देण्याची गरज नाही.',
  },

  // -------------------------------------------------------------------------
  // WHY: the strength, the main problem, and what your change did to it
  //
  // Three whole sentences that sit next to each other. The English reads
  // "Customers like your food — 32 praised it. The main problem they mention
  // is slow service. Customers have mentioned it more often since your change."
  // -------------------------------------------------------------------------
  'focus.why.keep': {
    en: 'Customers like your {theme} — {count} praised it.',
    hi: 'ग्राहकों को आपका {theme} पसंद है — {count} ने इसकी तारीफ़ की।',
    mr: 'ग्राहकांना तुमचं {theme} आवडतं — {count} जणांनी याचं कौतुक केलं.',
  },
  'focus.why.noStrength': {
    en: 'No single thing is praised often enough yet to call it a strength.',
    hi: 'अभी किसी एक बात की इतनी बार तारीफ़ नहीं हुई कि उसे आपकी ख़ूबी कहा जा सके।',
    mr: 'अजून कोणत्याही एका गोष्टीचं इतक्या वेळा कौतुक झालेलं नाही की तिला तुमची जमेची बाजू म्हणता येईल.',
  },
  'focus.why.main.mention': {
    en: 'The main problem they mention is {theme}.',
    hi: 'जिस मुख्य समस्या का वे ज़िक्र करते हैं वह {theme} है।',
    mr: 'ते उल्लेख करत असलेली मुख्य अडचण म्हणजे {theme}.',
  },
  'focus.why.main.keepMentioning': {
    en: 'The main problem they keep mentioning is {theme}.',
    hi: 'जिस मुख्य समस्या का वे बार-बार ज़िक्र करते हैं वह {theme} है।',
    mr: 'ते वारंवार उल्लेख करत असलेली मुख्य अडचण म्हणजे {theme}.',
  },
  'focus.why.mainCustomers.mention': {
    en: 'The main problem customers mention is {theme}.',
    hi: 'जिस मुख्य समस्या का ग्राहक ज़िक्र करते हैं वह {theme} है।',
    mr: 'ग्राहक उल्लेख करत असलेली मुख्य अडचण म्हणजे {theme}.',
  },
  'focus.why.mainCustomers.keepMentioning': {
    en: 'The main problem customers keep mentioning is {theme}.',
    hi: 'जिस मुख्य समस्या का ग्राहक बार-बार ज़िक्र करते हैं वह {theme} है।',
    mr: 'ग्राहक वारंवार उल्लेख करत असलेली मुख्य अडचण म्हणजे {theme}.',
  },
  'focus.why.change.worsened': {
    en: 'Customers have mentioned it more often since your change.',
    hi: 'आपके बदलाव के बाद से ग्राहकों ने इसका ज़िक्र ज़्यादा बार किया है।',
    mr: 'तुमच्या बदलानंतर ग्राहकांनी याचा उल्लेख जास्त वेळा केला आहे.',
  },
  'focus.why.change.improved': {
    en: 'Customers have mentioned it less often since your change.',
    hi: 'आपके बदलाव के बाद से ग्राहकों ने इसका ज़िक्र कम बार किया है।',
    mr: 'तुमच्या बदलानंतर ग्राहकांनी याचा उल्लेख कमी वेळा केला आहे.',
  },
  'focus.why.movement.worsening': {
    en: 'Customers mentioned it more often at your latest check-in.',
    hi: 'आपके ताज़ा चेक-इन में ग्राहकों ने इसका ज़िक्र ज़्यादा बार किया।',
    mr: 'तुमच्या ताज्या चेक-इनमध्ये ग्राहकांनी याचा उल्लेख जास्त वेळा केला.',
  },
  'focus.why.movement.improving': {
    en: 'Customers mentioned it less often at your latest check-in.',
    hi: 'आपके ताज़ा चेक-इन में ग्राहकों ने इसका ज़िक्र कम बार किया।',
    mr: 'तुमच्या ताज्या चेक-इनमध्ये ग्राहकांनी याचा उल्लेख कमी वेळा केला.',
  },

  // -------------------------------------------------------------------------
  // WHY, when nothing needs the owner: the strength, and what is left over
  // -------------------------------------------------------------------------
  'focus.synthesis.praiseMost.one': {
    en: 'Customers praise your {theme} most — {mentions} of {count} feedback entry.',
    hi: 'ग्राहक आपके {theme} की सबसे ज़्यादा तारीफ़ करते हैं — {count} फ़ीडबैक में से {mentions} में।',
    mr: 'ग्राहक तुमच्या {theme} चं सर्वात जास्त कौतुक करतात — {count} फीडबॅकपैकी {mentions} मध्ये.',
  },
  'focus.synthesis.praiseMost.other': {
    en: 'Customers praise your {theme} most — {mentions} of {count} feedback entries.',
    hi: 'ग्राहक आपके {theme} की सबसे ज़्यादा तारीफ़ करते हैं — {count} फ़ीडबैक में से {mentions} में।',
    mr: 'ग्राहक तुमच्या {theme} चं सर्वात जास्त कौतुक करतात — {count} फीडबॅकपैकी {mentions} मध्ये.',
  },
  'focus.synthesis.stillEased': {
    en: 'Customers still mention {theme}, but less often since your change.',
    hi: 'ग्राहक अब भी {theme} का ज़िक्र करते हैं, पर आपके बदलाव के बाद से कम बार।',
    mr: 'ग्राहक अजूनही {theme} चा उल्लेख करतात, पण तुमच्या बदलानंतर कमी वेळा.',
  },
  'focus.synthesis.stillMention': {
    en: 'Customers still mention {theme}.',
    hi: 'ग्राहक अब भी {theme} का ज़िक्र करते हैं।',
    mr: 'ग्राहक अजूनही {theme} चा उल्लेख करतात.',
  },
  'focus.synthesis.watching': {
    en: 'Headway is watching it and will tell you if it needs your attention.',
    hi: 'Headway इस पर नज़र रख रहा है और अगर इस पर आपका ध्यान ज़रूरी हुआ तो आपको बता देगा।',
    mr: 'Headway यावर लक्ष ठेवून आहे आणि याकडे तुमचं लक्ष देण्याची गरज पडली तर तुम्हाला सांगेल.',
  },
  'focus.synthesis.nothingElse': {
    en: 'Nothing else comes up often enough to call it a problem.',
    hi: 'और कोई बात इतनी बार नहीं आती कि उसे समस्या कहा जा सके।',
    mr: 'दुसरी कोणतीही गोष्ट तिला अडचण म्हणता येईल इतक्या वेळा येत नाही.',
  },
  'focus.synthesis.noPattern': {
    en: 'Nothing has come up often enough yet for Headway to call it a pattern.',
    hi: 'अभी तक कोई बात इतनी बार नहीं आई कि Headway उसे पैटर्न कह सके।',
    mr: 'अजून कोणतीही गोष्ट इतक्या वेळा आलेली नाही की Headway तिला पॅटर्न म्हणू शकेल.',
  },

  // -------------------------------------------------------------------------
  // The evidence chips, and the line that opens under each one
  // -------------------------------------------------------------------------
  'focus.chip.share': {
    en: '{share} of feedback',
    hi: 'फ़ीडबैक का {share}',
    mr: 'फीडबॅकपैकी {share}',
  },
  'focus.proof.share.detail.one': {
    en: '{mentions} of {count} feedback entry mention {theme}.',
    hi: '{count} फ़ीडबैक में से {mentions} में {theme} का ज़िक्र है।',
    mr: '{count} फीडबॅकपैकी {mentions} मध्ये {theme} चा उल्लेख आहे.',
  },
  'focus.proof.share.detail.other': {
    en: '{mentions} of {count} feedback entries mention {theme}.',
    hi: '{count} फ़ीडबैक में से {mentions} में {theme} का ज़िक्र है।',
    mr: '{count} फीडबॅकपैकी {mentions} मध्ये {theme} चा उल्लेख आहे.',
  },
  'focus.proof.share.seeAll.one': {
    en: 'See all {count} mention',
    hi: 'सभी {count} ज़िक्र देखें',
    mr: 'सर्व {count} उल्लेख पाहा',
  },
  'focus.proof.share.seeAll.other': {
    en: 'See all {count} mentions',
    hi: 'सभी {count} ज़िक्र देखें',
    mr: 'सर्व {count} उल्लेख पाहा',
  },

  'focus.chip.outcome.improved': {
    en: 'Less often after the change',
    hi: 'बदलाव के बाद कम बार',
    mr: 'बदलानंतर कमी वेळा',
  },
  'focus.chip.outcome.worsened': {
    en: 'More often after the change',
    hi: 'बदलाव के बाद ज़्यादा बार',
    mr: 'बदलानंतर जास्त वेळा',
  },
  'focus.chip.outcome.noChange': {
    en: 'No clear difference after the change',
    hi: 'बदलाव के बाद कोई साफ़ फ़र्क़ नहीं',
    mr: 'बदलानंतर स्पष्ट फरक नाही',
  },
  'focus.chip.outcome.tooEarly': {
    en: 'Too early to compare',
    hi: 'तुलना करने के लिए अभी बहुत जल्दी है',
    mr: 'तुलना करण्यासाठी अजून खूप लवकर आहे',
  },
  'focus.proof.outcome.detail': {
    en: '{before} of feedback before the change, {after} after.',
    hi: 'बदलाव से पहले फ़ीडबैक का {before}, बदलाव के बाद {after}।',
    mr: 'बदलाच्या आधी फीडबॅकपैकी {before}, बदलानंतर {after}.',
  },

  // The same four results, said as a reading rather than as a chip.
  'focus.outcome.reading.improved': {
    en: 'Mentioned less often after the change',
    hi: 'बदलाव के बाद इसका ज़िक्र कम बार हुआ',
    mr: 'बदलानंतर याचा उल्लेख कमी वेळा झाला',
  },
  'focus.outcome.reading.worsened': {
    en: 'Mentioned more often after the change',
    hi: 'बदलाव के बाद इसका ज़िक्र ज़्यादा बार हुआ',
    mr: 'बदलानंतर याचा उल्लेख जास्त वेळा झाला',
  },
  'focus.outcome.reading.noChange': {
    en: 'No clear difference after the change',
    hi: 'बदलाव के बाद कोई साफ़ फ़र्क़ नहीं',
    mr: 'बदलानंतर स्पष्ट फरक नाही',
  },
  'focus.outcome.reading.tooEarly': {
    en: 'Not enough feedback after the change',
    hi: 'बदलाव के बाद इतना फ़ीडबैक नहीं आया कि कुछ कहा जा सके',
    mr: 'बदलानंतर काही सांगण्याइतका फीडबॅक आलेला नाही',
  },

  'focus.chip.movement.stable': {
    en: 'About the same at your check-ins',
    hi: 'आपके चेक-इन में लगभग वैसा ही',
    mr: 'तुमच्या चेक-इनमध्ये साधारण तसंच',
  },
  'focus.chip.movement.more': {
    en: 'More often at your latest check-in',
    hi: 'आपके ताज़ा चेक-इन में ज़्यादा बार',
    mr: 'तुमच्या ताज्या चेक-इनमध्ये जास्त वेळा',
  },
  'focus.chip.movement.less': {
    en: 'Less often at your latest check-in',
    hi: 'आपके ताज़ा चेक-इन में कम बार',
    mr: 'तुमच्या ताज्या चेक-इनमध्ये कमी वेळा',
  },
  'focus.proof.movement.comparison': {
    en: '{counts} at your last two check-ins',
    hi: 'आपके पिछले दो चेक-इन में {counts}',
    mr: 'तुमच्या मागच्या दोन चेक-इनमध्ये {counts}',
  },

  'focus.chip.recurrence.both': {
    en: 'At both recent check-ins',
    hi: 'पिछले दोनों चेक-इन में',
    mr: 'मागच्या दोन्ही चेक-इनमध्ये',
  },
  'focus.chip.recurrence.some': {
    en: 'At {raised} of your last {of} check-ins',
    hi: 'आपके पिछले {of} चेक-इन में से {raised} में',
    mr: 'तुमच्या मागच्या {of} चेक-इनपैकी {raised} मध्ये',
  },
  'focus.chip.recurrence.new': {
    en: 'New at your latest check-in',
    hi: 'आपके ताज़ा चेक-इन में नया',
    mr: 'तुमच्या ताज्या चेक-इनमध्ये नवीन',
  },

  'focus.chip.rated.one': {
    en: 'Rated {average}/5 by {count} customer',
    hi: '{count} ग्राहक ने {average}/5 रेटिंग दी',
    mr: '{count} ग्राहकाने {average}/5 रेटिंग दिली',
  },
  'focus.chip.rated.other': {
    en: 'Rated {average}/5 by {count} customers',
    hi: '{count} ग्राहकों ने {average}/5 रेटिंग दी',
    mr: '{count} ग्राहकांनी {average}/5 रेटिंग दिली',
  },
  'focus.proof.rated.detail.one': {
    en: '{low} of the {count} customer who rated {theme} gave it 3 stars or less.',
    hi: '{theme} को रेटिंग देने वाले {count} ग्राहक में से {low} ने इसे 3 स्टार या उससे कम दिए।',
    mr: '{theme} ला रेटिंग देणाऱ्या {count} ग्राहकांपैकी {low} जणांनी 3 स्टार किंवा त्याहून कमी दिले.',
  },
  'focus.proof.rated.detail.other': {
    en: '{low} of the {count} customers who rated {theme} gave it 3 stars or less.',
    hi: '{theme} को रेटिंग देने वाले {count} ग्राहकों में से {low} ने इसे 3 स्टार या उससे कम दिए।',
    mr: '{theme} ला रेटिंग देणाऱ्या {count} ग्राहकांपैकी {low} जणांनी 3 स्टार किंवा त्याहून कमी दिले.',
  },

  // -------------------------------------------------------------------------
  // WHAT TO DO
  // -------------------------------------------------------------------------
  'focus.next.undo': {
    en: 'Before you undo the change, check what else changed.',
    hi: 'बदलाव वापस लेने से पहले देखें कि और क्या बदला था।',
    mr: 'बदल मागे घेण्याआधी आणखी काय बदललं होतं ते तपासा.',
  },
  'focus.next.suggestionStands': {
    en: 'The original suggestion still stands: {suggestion}',
    hi: 'पहला सुझाव अब भी लागू है: {suggestion}',
    mr: 'पहिली सूचना अजूनही लागू आहे: {suggestion}',
  },
  'focus.next.returning': {
    en: 'Before you make another change, check whether the old problem is back.',
    hi: 'कोई और बदलाव करने से पहले देखें कि पुरानी समस्या फिर से तो नहीं आ गई।',
    mr: 'आणखी एक बदल करण्याआधी जुनी अडचण पुन्हा आली आहे का ते तपासा.',
  },
  'focus.next.originalSuggestion': {
    en: 'The original suggestion: {suggestion}',
    hi: 'पहला सुझाव: {suggestion}',
    mr: 'पहिली सूचना: {suggestion}',
  },
  'focus.next.hold': {
    en: 'Decide whether to act now or wait. Customers are mentioning it less on their own.',
    hi: 'तय करें कि अभी कुछ करना है या रुकना है। ग्राहक अपने आप ही इसका ज़िक्र कम कर रहे हैं।',
    mr: 'आता काही करायचं की थांबायचं ते ठरवा. ग्राहक आपोआपच याचा उल्लेख कमी करत आहेत.',
  },
  'focus.next.holdDetail': {
    en: 'If it comes up more often again, start here: {suggestion}',
    hi: 'अगर यह फिर से ज़्यादा बार आने लगे, तो यहाँ से शुरू करें: {suggestion}',
    mr: 'हे पुन्हा जास्त वेळा येऊ लागलं, तर इथून सुरुवात करा: {suggestion}',
  },
  'focus.next.decide': {
    en: 'Decide what to change, and tell your Headway contact.',
    hi: 'तय करें कि क्या बदलना है, और अपने Headway संपर्क को बताएँ।',
    mr: 'काय बदलायचं ते ठरवा, आणि तुमच्या Headway संपर्काला सांगा.',
  },
  'focus.next.keepDoing': {
    en: 'Nothing to do. Keep doing what customers praise you for: {theme}.',
    hi: 'कुछ करने की ज़रूरत नहीं। जिस बात के लिए ग्राहक आपकी तारीफ़ करते हैं, वह करते रहें: {theme}।',
    mr: 'काही करण्याची गरज नाही. ज्यासाठी ग्राहक तुमचं कौतुक करतात ते करत राहा: {theme}.',
  },

  // -------------------------------------------------------------------------
  // The one gold button
  // -------------------------------------------------------------------------
  'focus.cta.seeEverything': {
    en: 'See everything on {theme}',
    hi: '{theme} पर सब कुछ देखें',
    mr: '{theme} बद्दल सर्व काही पाहा',
  },
  'focus.cta.whatChanged': {
    en: 'See what changed',
    hi: 'क्या बदला, यह देखें',
    mr: 'काय बदललं ते पाहा',
  },
  'focus.cta.needsReply': {
    en: 'Read what needs a reply',
    hi: 'जिनका जवाब देना है, वे पढ़ें',
    mr: 'ज्यांना उत्तर द्यायचं आहे ते वाचा',
  },
  'focus.cta.goingWell': {
    en: 'See what is going well',
    hi: 'क्या अच्छा चल रहा है, यह देखें',
    mr: 'काय चांगलं चाललं आहे ते पाहा',
  },

  // -------------------------------------------------------------------------
  // The check-in, in one sentence
  //
  // The counts are spelled out as words in all three languages — "One thing
  // needs your attention", "एक बात", "एक गोष्ट" — so the word is interpolated
  // like a number and the sentence around it is written out per language.
  // -------------------------------------------------------------------------
  'focus.count.0': { en: 'No', hi: 'कोई', mr: 'एकही' },
  'focus.count.1': { en: 'One', hi: 'एक', mr: 'एक' },
  'focus.count.2': { en: 'Two', hi: 'दो', mr: 'दोन' },
  'focus.count.3': { en: 'Three', hi: 'तीन', mr: 'तीन' },
  'focus.count.4': { en: 'Four', hi: 'चार', mr: 'चार' },
  'focus.count.5': { en: 'Five', hi: 'पाँच', mr: 'पाच' },
  'focus.count.6': { en: 'Six', hi: 'छह', mr: 'सहा' },
  'focus.count.7': { en: 'Seven', hi: 'सात', mr: 'सात' },
  'focus.count.8': { en: 'Eight', hi: 'आठ', mr: 'आठ' },
  'focus.count.9': { en: 'Nine', hi: 'नौ', mr: 'नऊ' },

  'focus.pulse.attention.none': {
    en: 'Nothing needs your attention.',
    hi: 'किसी बात पर आपका ध्यान ज़रूरी नहीं है।',
    mr: 'कशाकडेही तुमचं लक्ष देण्याची गरज नाही.',
  },
  'focus.pulse.attention.one': {
    en: '{word} thing needs your attention.',
    hi: '{word} बात पर आपका ध्यान चाहिए।',
    mr: '{word} गोष्टीकडे तुमचं लक्ष हवं आहे.',
  },
  'focus.pulse.attention.other': {
    en: '{word} things need your attention.',
    hi: '{word} बातों पर आपका ध्यान चाहिए।',
    mr: '{word} गोष्टींकडे तुमचं लक्ष हवं आहे.',
  },
  'focus.pulse.watching.one': {
    en: '{word} thing needs watching.',
    hi: '{word} बात पर नज़र रखनी है।',
    mr: '{word} गोष्टीवर लक्ष ठेवायचं आहे.',
  },
  'focus.pulse.watching.other': {
    en: '{word} things need watching.',
    hi: '{word} बातों पर नज़र रखनी है।',
    mr: '{word} गोष्टींवर लक्ष ठेवायचं आहे.',
  },
  'focus.pulse.steady.none': {
    en: 'Nothing is holding steady.',
    hi: 'कोई भी बात जस की तस नहीं है।',
    mr: 'कोणतीही गोष्ट तशीच राहिलेली नाही.',
  },
  'focus.pulse.steady.one': {
    en: '{word} thing is holding steady.',
    hi: '{word} बात जस की तस है।',
    mr: '{word} गोष्ट तशीच आहे.',
  },
  'focus.pulse.steady.other': {
    en: '{word} things are holding steady.',
    hi: '{word} बातें जस की तस हैं।',
    mr: '{word} गोष्टी तशाच आहेत.',
  },
  'focus.pulse.secondCheckin': {
    en: 'A second check-in will show what is holding steady.',
    hi: 'दूसरे चेक-इन से पता चलेगा कि क्या जस का तस है।',
    mr: 'दुसऱ्या चेक-इननंतर काय तसंच आहे ते कळेल.',
  },

  // -------------------------------------------------------------------------
  // Account: what Headway has done, as four facts. Labels beside a figure.
  // -------------------------------------------------------------------------
  'focus.activity.read': {
    en: 'Feedback entries read',
    hi: 'पढ़े गए फ़ीडबैक',
    mr: 'वाचलेले फीडबॅक',
  },
  'focus.activity.recurring': {
    en: 'What keeps coming up',
    hi: 'जो बार-बार आ रहा है',
    mr: 'जे वारंवार येत आहे',
  },
  'focus.activity.problems.one': {
    en: 'Problem that needs your attention',
    hi: 'आपके ध्यान की ज़रूरत वाली समस्या',
    mr: 'तुमचं लक्ष हवं असलेली अडचण',
  },
  'focus.activity.problems.other': {
    en: 'Problems that need your attention',
    hi: 'आपके ध्यान की ज़रूरत वाली समस्याएँ',
    mr: 'तुमचं लक्ष हवं असलेल्या अडचणी',
  },
  'focus.activity.compared.one': {
    en: 'Change compared',
    hi: 'तुलना किया गया बदलाव',
    mr: 'तुलना केलेला बदल',
  },
  'focus.activity.compared.other': {
    en: 'Changes compared',
    hi: 'तुलना किए गए बदलाव',
    mr: 'तुलना केलेले बदल',
  },
  'focus.activity.checking.one': {
    en: 'Change being checked',
    hi: 'जाँचा जा रहा बदलाव',
    mr: 'तपासला जात असलेला बदल',
  },
  'focus.activity.checking.other': {
    en: 'Changes being checked',
    hi: 'जाँचे जा रहे बदलाव',
    mr: 'तपासले जात असलेले बदल',
  },

  // -------------------------------------------------------------------------
  // The service section: when the trial ends
  // -------------------------------------------------------------------------
  'focus.trial.ends': {
    en: 'Ends {date}',
    hi: '{date} को ख़त्म होगा',
    mr: '{date} रोजी संपेल',
  },
  'focus.trial.ended': {
    en: 'Ended {date}',
    hi: '{date} को ख़त्म हुआ',
    mr: '{date} रोजी संपला',
  },
} satisfies Namespace;
