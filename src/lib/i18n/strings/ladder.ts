import type { Namespace } from '../t';

/**
 * The evidence ladder — what Headway knows at every stage (Oct 2026)
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed.
 *
 * MORE EVIDENCE, STRONGER WORDS. Every phrase here belongs to one rung of the
 * ladder in `src/lib/portal/ladder.ts`, and says exactly as much as that rung
 * supports: one customer is "one customer", a repeat is "still early", three of
 * fourteen is an "emerging pattern", and only six of twenty-five or more is a
 * "strong recurring pattern". A phrase must never be moved to a rung above the
 * one it was written for.
 *
 * NO COUNTDOWNS. Nothing here says how many more responses unlock something.
 * The owner is told what is known now, what is not yet sure, what Headway is
 * watching and what more feedback will make clearer.
 *
 * NOTHING FOR THE OWNER TO RUN. Comparisons happen by themselves — Headway
 * draws the comparable periods from the feedback (`snapshots/periods.ts`) — so
 * no sentence asks the owner to record, schedule or wait on a check-in.
 *
 * "Customers" counts responses, as everywhere in the portal: customers are
 * anonymous, and one person may leave more than one.
 */
export const ladder = {
  // -------------------------------------------------------------------------
  // The stage, as a label
  // -------------------------------------------------------------------------
  'ladder.stage.NONE': {
    en: 'Getting started',
    hi: 'शुरुआत',
    mr: 'सुरुवात',
  },
  'ladder.stage.PULSE': {
    en: 'First responses',
    hi: 'पहले जवाब',
    mr: 'पहिले प्रतिसाद',
  },
  'ladder.stage.FIRST_READ': {
    en: 'First read',
    hi: 'पहली झलक',
    mr: 'पहिलं वाचन',
  },
  'ladder.stage.EMERGING_PICTURE': {
    en: 'Emerging picture',
    hi: 'उभरती तस्वीर',
    mr: 'आकार घेणारं चित्र',
  },
  'ladder.stage.STRONG_PATTERNS': {
    en: 'Established picture',
    hi: 'पक्की तस्वीर',
    mr: 'ठोस चित्र',
  },
  'ladder.read.one': {
    en: '{count} response read',
    hi: '{count} जवाब पढ़ा गया',
    mr: '{count} प्रतिसाद वाचला',
  },
  'ladder.read.other': {
    en: '{count} responses read',
    hi: '{count} जवाब पढ़े गए',
    mr: '{count} प्रतिसाद वाचले',
  },

  // -------------------------------------------------------------------------
  // The heading for each stage
  // -------------------------------------------------------------------------
  'ladder.title.none.empty': {
    en: 'Ready for your first customer',
    hi: 'आपके पहले ग्राहक के लिए तैयार',
    mr: 'तुमच्या पहिल्या ग्राहकासाठी तयार',
  },
  'ladder.title.none.reading.one': {
    en: 'Reading your first response',
    hi: 'आपका पहला जवाब पढ़ा जा रहा है',
    mr: 'तुमचा पहिला प्रतिसाद वाचला जात आहे',
  },
  'ladder.title.none.reading.other': {
    en: 'Reading your first responses',
    hi: 'आपके पहले जवाब पढ़े जा रहे हैं',
    mr: 'तुमचे पहिले प्रतिसाद वाचले जात आहेत',
  },
  'ladder.title.pulse.first': {
    en: 'Your first customer has been heard',
    hi: 'आपके पहले ग्राहक की बात सुन ली गई है',
    mr: 'तुमच्या पहिल्या ग्राहकाचं म्हणणं ऐकलं गेलं आहे',
  },
  'ladder.title.pulse.some.one': {
    en: '{count} customer has been heard',
    hi: '{count} ग्राहक की बात सुन ली गई है',
    mr: '{count} ग्राहकाचं म्हणणं ऐकलं गेलं आहे',
  },
  'ladder.title.pulse.some.other': {
    en: '{count} customers have been heard',
    hi: '{count} ग्राहकों की बात सुन ली गई है',
    mr: '{count} ग्राहकांचं म्हणणं ऐकलं गेलं आहे',
  },
  'ladder.title.firstRead': {
    en: 'Your first customer read is ready',
    hi: 'आपके ग्राहकों की पहली झलक तैयार है',
    mr: 'तुमच्या ग्राहकांचं पहिलं वाचन तयार आहे',
  },
  'ladder.title.emerging': {
    en: 'Your customer picture is taking shape',
    hi: 'आपके ग्राहकों की तस्वीर बनने लगी है',
    mr: 'तुमच्या ग्राहकांचं चित्र आकार घेऊ लागलं आहे',
  },
  'ladder.title.strong': {
    en: 'What your customers are telling you',
    hi: 'आपके ग्राहक आपसे क्या कह रहे हैं',
    mr: 'तुमचे ग्राहक तुम्हाला काय सांगत आहेत',
  },

  // -------------------------------------------------------------------------
  // The line under the heading
  // -------------------------------------------------------------------------
  'ladder.intro.none.empty': {
    en: 'Headway starts reading as soon as a customer uses your QR card or feedback link.',
    hi: 'जैसे ही कोई ग्राहक आपका QR कार्ड या फ़ीडबैक लिंक इस्तेमाल करता है, Headway पढ़ना शुरू कर देता है।',
    mr: 'ग्राहकाने तुमचं QR कार्ड किंवा फीडबॅक लिंक वापरताच Headway वाचायला सुरुवात करतं.',
  },
  'ladder.intro.none.reading.one': {
    en: 'It has arrived, and Headway is reading it now. What it finds appears here within moments.',
    hi: 'यह आ गया है, और Headway इसे अभी पढ़ रहा है। इसमें जो मिलेगा, वह कुछ ही पलों में यहाँ दिखेगा।',
    mr: 'तो आला आहे, आणि Headway तो आत्ता वाचत आहे. त्यात जे सापडेल ते काही क्षणांत इथे दिसेल.',
  },
  'ladder.intro.none.reading.other': {
    en: '{count} have arrived, and Headway is reading them now. What it finds appears here within moments.',
    hi: '{count} जवाब आ गए हैं, और Headway उन्हें अभी पढ़ रहा है। उनमें जो मिलेगा, वह कुछ ही पलों में यहाँ दिखेगा।',
    mr: '{count} प्रतिसाद आले आहेत, आणि Headway ते आत्ता वाचत आहे. त्यांत जे सापडेल ते काही क्षणांत इथे दिसेल.',
  },
  'ladder.intro.pulse.first': {
    en: 'Here is what Headway read in their response.',
    hi: 'Headway ने उनके जवाब में यह पढ़ा।',
    mr: 'Headway ने त्यांच्या प्रतिसादात हे वाचलं.',
  },
  'ladder.intro.pulse.some': {
    en: 'Here is what they have said so far. Headway is looking for anything that repeats, and keeps one-off comments separate.',
    hi: 'अब तक उन्होंने यह कहा है। Headway देख रहा है कि कोई बात दोहराई जा रही है या नहीं, और अकेली टिप्पणियों को अलग रखता है।',
    mr: 'आतापर्यंत त्यांनी हे सांगितलं आहे. एखादी गोष्ट पुन्हा येते का हे Headway पाहत आहे, आणि एकट्या टिप्पण्या वेगळ्या ठेवतं.',
  },
  'ladder.intro.firstRead.one': {
    en: 'Headway has read {count} response. Here’s what customers are telling you so far.',
    hi: 'Headway ने {count} जवाब पढ़ा है। अब तक ग्राहक आपसे यह कह रहे हैं।',
    mr: 'Headway ने {count} प्रतिसाद वाचला आहे. आतापर्यंत ग्राहक तुम्हाला हे सांगत आहेत.',
  },
  'ladder.intro.firstRead.other': {
    en: 'Headway has read {count} responses. Here’s what customers are telling you so far.',
    hi: 'Headway ने {count} जवाब पढ़े हैं। अब तक ग्राहक आपसे यह कह रहे हैं।',
    mr: 'Headway ने {count} प्रतिसाद वाचले आहेत. आतापर्यंत ग्राहक तुम्हाला हे सांगत आहेत.',
  },
  'ladder.intro.emerging.one': {
    en: 'Headway has read {count} response — enough to start spotting patterns. A pattern is named only when several customers raise the same thing.',
    hi: 'Headway ने {count} जवाब पढ़ा है — पैटर्न पहचानना शुरू करने के लिए काफ़ी। कोई बात पैटर्न तभी कहलाती है जब कई ग्राहक वही बात उठाएँ।',
    mr: 'Headway ने {count} प्रतिसाद वाचला आहे — पॅटर्न ओळखायला सुरुवात करण्याइतका. अनेक ग्राहकांनी तीच गोष्ट मांडली तरच तिला पॅटर्न म्हटलं जातं.',
  },
  'ladder.intro.emerging.other': {
    en: 'Headway has read {count} responses — enough to start spotting patterns. A pattern is named only when several customers raise the same thing.',
    hi: 'Headway ने {count} जवाब पढ़े हैं — पैटर्न पहचानना शुरू करने के लिए काफ़ी। कोई बात पैटर्न तभी कहलाती है जब कई ग्राहक वही बात उठाएँ।',
    mr: 'Headway ने {count} प्रतिसाद वाचले आहेत — पॅटर्न ओळखायला सुरुवात करण्याइतके. अनेक ग्राहकांनी तीच गोष्ट मांडली तरच तिला पॅटर्न म्हटलं जातं.',
  },
  'ladder.intro.strong.one': {
    en: 'Headway has read {count} response. A pattern is called strong only where the evidence has earned it.',
    hi: 'Headway ने {count} जवाब पढ़ा है। किसी पैटर्न को पक्का तभी कहा जाता है जब सबूत इसके लायक़ हों।',
    mr: 'Headway ने {count} प्रतिसाद वाचला आहे. पुरावा तितका असेल तरच पॅटर्नला ठोस म्हटलं जातं.',
  },
  'ladder.intro.strong.other': {
    en: 'Headway has read {count} responses. A pattern is called strong only where the evidence has earned it.',
    hi: 'Headway ने {count} जवाब पढ़े हैं। किसी पैटर्न को पक्का तभी कहा जाता है जब सबूत इसके लायक़ हों।',
    mr: 'Headway ने {count} प्रतिसाद वाचले आहेत. पुरावा तितका असेल तरच पॅटर्नला ठोस म्हटलं जातं.',
  },

  // -------------------------------------------------------------------------
  // The sections of the reading
  // -------------------------------------------------------------------------
  'ladder.section.first': {
    en: 'What they told you',
    hi: 'उन्होंने आपसे क्या कहा',
    mr: 'त्यांनी तुम्हाला काय सांगितलं',
  },
  'ladder.section.standsOut': {
    en: 'What stands out',
    hi: 'सबसे ख़ास बात',
    mr: 'सगळ्यात ठळक गोष्ट',
  },
  'ladder.section.likes': {
    en: 'Customers like',
    hi: 'ग्राहकों को पसंद है',
    mr: 'ग्राहकांना आवडतं',
  },
  'ladder.section.patterns': {
    en: 'Keeps coming up',
    hi: 'बार-बार आ रहा है',
    mr: 'वारंवार येत आहे',
  },
  'ladder.section.watching': {
    en: 'Worth watching',
    hi: 'नज़र रखने लायक़',
    mr: 'लक्ष ठेवण्यासारखं',
  },
  'ladder.section.everything': {
    en: 'Everything mentioned so far',
    hi: 'अब तक जिन बातों का ज़िक्र हुआ',
    mr: 'आतापर्यंत ज्या गोष्टींचा उल्लेख झाला',
  },
  'ladder.more.summary': {
    en: 'More from this read',
    hi: 'इस झलक में और',
    mr: 'या वाचनात आणखी',
  },
  'ladder.cta.kit': {
    en: 'Get your QR card and link',
    hi: 'अपना QR कार्ड और लिंक देखें',
    mr: 'तुमचं QR कार्ड आणि लिंक पाहा',
  },

  // -------------------------------------------------------------------------
  // The rung each topic stands on
  // -------------------------------------------------------------------------
  'ladder.level.observation.issue': {
    en: 'Mentioned once',
    hi: 'एक बार ज़िक्र',
    mr: 'एकदा उल्लेख',
  },
  'ladder.level.observation.praise': {
    en: 'Praised once',
    hi: 'एक बार तारीफ़',
    mr: 'एकदा कौतुक',
  },
  'ladder.level.EARLY_SIGNAL': {
    en: 'Early signal',
    hi: 'शुरुआती संकेत',
    mr: 'सुरुवातीचा संकेत',
  },
  'ladder.level.EMERGING_PATTERN': {
    en: 'Emerging pattern',
    hi: 'उभरता पैटर्न',
    mr: 'आकार घेणारा पॅटर्न',
  },
  'ladder.level.STRONG_PATTERN': {
    en: 'Strong pattern',
    hi: 'पक्का पैटर्न',
    mr: 'ठोस पॅटर्न',
  },

  // -------------------------------------------------------------------------
  // The evidence line under a topic. Never names the topic: the row is headed
  // with it, so each language keeps its own word order around the counts.
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // What to do, scaled to the evidence
  // -------------------------------------------------------------------------
  'ladder.action.check': {
    en: 'Worth checking',
    hi: 'जाँचने लायक़',
    mr: 'तपासून पाहण्यासारखं',
  },
  'ladder.action.act': {
    en: 'What to do',
    hi: 'क्या करना है',
    mr: 'काय करायचं',
  },
  'ladder.action.keep': {
    en: 'Keep doing this.',
    hi: 'ऐसे ही करते रहें।',
    mr: 'असंच करत राहा.',
  },

  // -------------------------------------------------------------------------
  // How customers felt, when nothing repeated stands out more
  // -------------------------------------------------------------------------
  'ladder.mood.allHappy': {
    en: 'Every customer so far was happy.',
    hi: 'अब तक हर ग्राहक ख़ुश था।',
    mr: 'आतापर्यंत प्रत्येक ग्राहक खूश होता.',
  },
  'ladder.mood.allUnhappy': {
    en: 'Every customer so far was unhappy.',
    hi: 'अब तक हर ग्राहक नाख़ुश था।',
    mr: 'आतापर्यंत प्रत्येक ग्राहक नाराज होता.',
  },
  'ladder.mood.happy': {
    en: 'Most customers are happy.',
    hi: 'ज़्यादातर ग्राहक ख़ुश हैं।',
    mr: 'बहुतेक ग्राहक खूश आहेत.',
  },
  'ladder.mood.unhappy': {
    en: 'Most customers are unhappy.',
    hi: 'ज़्यादातर ग्राहक नाख़ुश हैं।',
    mr: 'बहुतेक ग्राहक नाराज आहेत.',
  },
  'ladder.mood.mixed': {
    en: 'Most responses are mixed.',
    hi: 'ज़्यादातर जवाब मिले-जुले हैं।',
    mr: 'बहुतेक प्रतिसाद संमिश्र आहेत.',
  },
  'ladder.mood.split': {
    en: 'Customers are split.',
    hi: 'ग्राहकों की राय बँटी हुई है।',
    mr: 'ग्राहकांची मतं विभागलेली आहेत.',
  },

  // -------------------------------------------------------------------------
  // The very first response, line by line
  // -------------------------------------------------------------------------
  'ladder.first.rated': {
    en: 'Rated {stars}★',
    hi: '{stars}★ रेटिंग',
    mr: '{stars}★ रेटिंग',
  },
  'ladder.first.noRating': {
    en: 'No star rating',
    hi: 'कोई स्टार रेटिंग नहीं',
    mr: 'स्टार रेटिंग नाही',
  },
  'ladder.first.praised': {
    en: 'Praised: {things}',
    hi: 'तारीफ़: {things}',
    mr: 'कौतुक: {things}',
  },
  'ladder.first.mentioned': {
    en: 'Problem: {things}',
    hi: 'समस्या: {things}',
    mr: 'अडचण: {things}',
  },
  'ladder.first.nothingNamed': {
    en: 'Nothing specific named',
    hi: 'कोई ख़ास बात नहीं बताई',
    mr: 'विशिष्ट गोष्ट सांगितली नाही',
  },
  'ladder.first.noWords': {
    en: 'Rating only, no words',
    hi: 'सिर्फ़ रेटिंग, कुछ लिखा नहीं',
    mr: 'फक्त रेटिंग, काही लिहिलं नाही',
  },

  // -------------------------------------------------------------------------
  // When nothing has repeated
  // -------------------------------------------------------------------------
  'ladder.nothingRepeated': {
    en: 'Nothing has repeated yet. Each topic so far has come from one customer.',
    hi: 'अभी तक कोई बात दोहराई नहीं गई। अब तक हर विषय एक ही ग्राहक से आया है।',
    mr: 'अजून कोणतीही गोष्ट पुन्हा आलेली नाही. आतापर्यंत प्रत्येक विषय एकाच ग्राहकाकडून आला आहे.',
  },
  'ladder.noPatternYet': {
    en: 'You have enough feedback for Headway to start looking for patterns, but nothing has repeated enough yet to call a recurring problem.',
    hi: 'आपके पास इतना फ़ीडबैक है कि Headway पैटर्न ढूँढना शुरू कर सके, पर अभी कोई बात इतनी बार नहीं आई कि उसे बार-बार आने वाली समस्या कहा जाए।',
    mr: 'Headway ला पॅटर्न शोधायला सुरुवात करता येईल इतका फीडबॅक तुमच्याकडे आहे, पण वारंवार येणारी अडचण म्हणावी इतक्या वेळा अजून कोणतीही गोष्ट आलेली नाही.',
  },

  // -------------------------------------------------------------------------
  // What is not sure yet, and what more feedback will show
  // -------------------------------------------------------------------------
  'ladder.notSure.first': {
    en: 'One response is one customer’s view, so Headway draws no conclusion from it.',
    hi: 'एक जवाब एक ग्राहक की राय है, इसलिए Headway इससे कोई नतीजा नहीं निकालता।',
    mr: 'एक प्रतिसाद म्हणजे एका ग्राहकाचं मत, त्यामुळे Headway त्यातून कोणताही निष्कर्ष काढत नाही.',
  },
  'ladder.notSure.pulse': {
    en: 'Whether anything here is a pattern. A handful of responses is too few to tell.',
    hi: 'क्या इनमें से कोई बात पैटर्न है। इतने कम जवाबों से यह कहा नहीं जा सकता।',
    mr: 'यातली एखादी गोष्ट पॅटर्न आहे का. इतक्या कमी प्रतिसादांवरून हे सांगता येत नाही.',
  },
  'ladder.notSure.firstRead': {
    en: 'Whether any of this is a recurring pattern. Headway names a pattern only when several customers raise the same thing across enough feedback.',
    hi: 'क्या इनमें से कोई बात बार-बार आने वाला पैटर्न है। Headway किसी बात को पैटर्न तभी कहता है जब पर्याप्त फ़ीडबैक में कई ग्राहक वही बात उठाएँ।',
    mr: 'यातली एखादी गोष्ट वारंवार येणारा पॅटर्न आहे का. पुरेशा फीडबॅकमध्ये अनेक ग्राहकांनी तीच गोष्ट मांडली तरच Headway तिला पॅटर्न म्हणतं.',
  },
  'ladder.notSure.emerging': {
    en: 'How strong these patterns are. Headway calls a pattern strong only when many customers raise it across a larger sample.',
    hi: 'ये पैटर्न कितने पक्के हैं। Headway किसी पैटर्न को पक्का तभी कहता है जब ज़्यादा फ़ीडबैक में कई ग्राहक उसे उठाएँ।',
    mr: 'हे पॅटर्न किती ठोस आहेत. जास्त फीडबॅकमध्ये अनेक ग्राहकांनी मांडला तरच Headway पॅटर्नला ठोस म्हणतं.',
  },
  'ladder.notSure.direction': {
    en: 'Which way things are moving. That needs two comparable sets of feedback.',
    hi: 'चीज़ें किस तरफ़ जा रही हैं। इसके लिए फ़ीडबैक की दो तुलना लायक़ अवधियाँ चाहिए।',
    mr: 'गोष्टी कोणत्या दिशेने जात आहेत. त्यासाठी तुलना करता येतील असे फीडबॅकचे दोन कालावधी लागतात.',
  },
  'ladder.clearer.early': {
    en: 'With more responses, Headway can tell one-off comments from things several customers say.',
    hi: 'और जवाब आने पर Headway अकेली टिप्पणियों और कई ग्राहकों की कही बातों में फ़र्क़ कर पाएगा।',
    mr: 'आणखी प्रतिसाद आल्यावर Headway एकट्या टिप्पण्या आणि अनेक ग्राहक सांगत असलेल्या गोष्टी वेगळ्या ओळखू शकेल.',
  },
  'ladder.clearer.firstRead': {
    en: 'With more responses, Headway can confirm these early signals or drop them.',
    hi: 'और जवाब आने पर Headway इन शुरुआती संकेतों की पुष्टि कर पाएगा या इन्हें हटा देगा।',
    mr: 'आणखी प्रतिसाद आल्यावर Headway या सुरुवातीच्या संकेतांची खात्री करू शकेल किंवा ते काढून टाकेल.',
  },
  'ladder.clearer.emerging': {
    en: 'With more feedback, Headway can tell which patterns are strong and which fade.',
    hi: 'ज़्यादा फ़ीडबैक आने पर Headway बता पाएगा कि कौन से पैटर्न पक्के हैं और कौन से धीरे-धीरे ग़ायब हो जाते हैं।',
    mr: 'जास्त फीडबॅक आल्यावर कोणते पॅटर्न ठोस आहेत आणि कोणते ओसरतात हे Headway सांगू शकेल.',
  },
  'ladder.clearer.direction': {
    en: 'Once two comparable sets of feedback exist, Headway shows what is improving, worsening or staying about the same.',
    hi: 'फ़ीडबैक की दो तुलना लायक़ अवधियाँ होते ही Headway दिखाएगा कि क्या सुधर रहा है, क्या बिगड़ रहा है और क्या लगभग वैसा ही है।',
    mr: 'तुलना करता येतील असे फीडबॅकचे दोन कालावधी होताच काय सुधारत आहे, काय बिघडत आहे आणि काय साधारण तसंच आहे ते Headway दाखवेल.',
  },
  'ladder.clearer.strong': {
    en: 'Each new comparable set of feedback is compared with the one before, so you can see whether things are improving.',
    hi: 'फ़ीडबैक की हर नई तुलना लायक़ अवधि की तुलना पिछली से की जाती है, ताकि आप देख सकें कि चीज़ें सुधर रही हैं या नहीं।',
    mr: 'फीडबॅकच्या प्रत्येक नव्या तुलनायोग्य कालावधीची आधीच्याशी तुलना होते, म्हणजे गोष्टी सुधारत आहेत का ते तुम्हाला दिसेल.',
  },

  // -------------------------------------------------------------------------
  // What Headway is doing, as it does it
  // -------------------------------------------------------------------------
  'ladder.doing.reads': {
    en: 'Headway reads every response as it arrives.',
    hi: 'Headway हर जवाब आते ही पढ़ता है।',
    mr: 'प्रत्येक प्रतिसाद येताच Headway तो वाचतं.',
  },
  'ladder.doing.separate': {
    en: 'It keeps one-off comments separate from repeated patterns, so it doesn’t overreact to a small sample.',
    hi: 'यह अकेली टिप्पणियों को बार-बार आने वाले पैटर्न से अलग रखता है, ताकि थोड़े से जवाबों पर ज़रूरत से ज़्यादा प्रतिक्रिया न हो।',
    mr: 'ते एकट्या टिप्पण्या वारंवार येणाऱ्या पॅटर्नपासून वेगळ्या ठेवतं, म्हणजे थोड्या प्रतिसादांवरून घाईचा निष्कर्ष निघत नाही.',
  },
  'ladder.doing.patterns': {
    en: 'It names a pattern only when several customers raise the same thing, and calls one strong only across a larger sample.',
    hi: 'यह किसी बात को पैटर्न तभी कहता है जब कई ग्राहक वही बात उठाएँ, और पक्का तभी जब ज़्यादा फ़ीडबैक में ऐसा हो।',
    mr: 'अनेक ग्राहकांनी तीच गोष्ट मांडली तरच ते तिला पॅटर्न म्हणतं, आणि जास्त फीडबॅकमध्ये तसं असेल तरच ठोस म्हणतं.',
  },
  'ladder.doing.compares': {
    en: 'It compares each new comparable set of feedback with the one before, by itself.',
    hi: 'यह फ़ीडबैक की हर नई तुलना लायक़ अवधि की तुलना पिछली से अपने-आप करता है।',
    mr: 'ते फीडबॅकच्या प्रत्येक नव्या तुलनायोग्य कालावधीची आधीच्याशी तुलना आपोआप करतं.',
  },

  // -------------------------------------------------------------------------
  // How customers feel — with its denominators said out loud
  // -------------------------------------------------------------------------
  'ladder.pulse.basis.one': {
    en: 'Of {count} response read',
    hi: 'पढ़े गए {count} जवाब में से',
    mr: 'वाचलेल्या {count} प्रतिसादापैकी',
  },
  'ladder.pulse.basis.other': {
    en: 'Of {count} responses read',
    hi: 'पढ़े गए {count} जवाबों में से',
    mr: 'वाचलेल्या {count} प्रतिसादांपैकी',
  },
  'ladder.pulse.rated.one': {
    en: '{count} star rating: {average}★',
    hi: '{count} स्टार रेटिंग: {average}★',
    mr: '{count} स्टार रेटिंग: {average}★',
  },
  'ladder.pulse.rated.other': {
    en: '{count} star ratings · {average}★ average',
    hi: '{count} स्टार रेटिंग · औसत {average}★',
    mr: '{count} स्टार रेटिंग · सरासरी {average}★',
  },
  'ladder.pulse.noRatings': {
    en: 'No star ratings yet',
    hi: 'अभी कोई स्टार रेटिंग नहीं',
    mr: 'अजून एकही स्टार रेटिंग नाही',
  },

  // -------------------------------------------------------------------------
  // Which way things are moving — and what that waits for, done by Headway
  // -------------------------------------------------------------------------
  'ladder.direction.notStarted': {
    en: 'Once feedback arrives, Headway records where things stand and compares later feedback with it.',
    hi: 'फ़ीडबैक आते ही Headway मौजूदा स्थिति दर्ज करता है और बाद के फ़ीडबैक की तुलना उससे करता है।',
    mr: 'फीडबॅक आल्यावर Headway सध्याची स्थिती नोंदवतं आणि नंतरच्या फीडबॅकची तिच्याशी तुलना करतं.',
  },
  'ladder.direction.building': {
    en: 'Headway needs two comparable sets of feedback before it can show what is improving, worsening or staying about the same.',
    hi: 'क्या सुधर रहा है, क्या बिगड़ रहा है या लगभग वैसा ही है, यह दिखाने से पहले Headway को फ़ीडबैक की दो तुलना लायक़ अवधियाँ चाहिए।',
    mr: 'काय सुधारत आहे, काय बिघडत आहे किंवा साधारण तसंच आहे हे दाखवण्याआधी Headway ला फीडबॅकचे दोन तुलनायोग्य कालावधी लागतात.',
  },
  'ladder.direction.baselineSet.one': {
    en: 'Headway recorded where things stood as of {date} ({count} response). After the next comparable set, it will show what changed.',
    hi: 'Headway ने {date} तक की स्थिति दर्ज की ({count} जवाब)। अगली तुलना लायक़ अवधि के बाद वह दिखाएगा कि क्या बदला।',
    mr: 'Headway ने {date} पर्यंतची स्थिती नोंदवली ({count} प्रतिसाद). पुढच्या तुलनायोग्य कालावधीनंतर ते काय बदललं ते दाखवेल.',
  },
  'ladder.direction.baselineSet.other': {
    en: 'Headway recorded where things stood as of {date} ({count} responses). After the next comparable set, it will show what changed.',
    hi: 'Headway ने {date} तक की स्थिति दर्ज की ({count} जवाब)। अगली तुलना लायक़ अवधि के बाद वह दिखाएगा कि क्या बदला।',
    mr: 'Headway ने {date} पर्यंतची स्थिती नोंदवली ({count} प्रतिसाद). पुढच्या तुलनायोग्य कालावधीनंतर ते काय बदललं ते दाखवेल.',
  },
  'ladder.direction.tooThin': {
    en: 'At least one of the two sets of feedback is too small to compare fairly ({previous} and {current} responses).',
    hi: 'फ़ीडबैक की दो अवधियों में से कम से कम एक निष्पक्ष तुलना के लिए बहुत छोटी है ({previous} और {current} जवाब)।',
    mr: 'फीडबॅकच्या दोन कालावधींपैकी किमान एक योग्य तुलनेसाठी खूप लहान आहे ({previous} आणि {current} प्रतिसाद).',
  },
  'ladder.direction.ready': {
    en: 'Comparing {previous} responses up to {previousDate} with {current} up to {currentDate}.',
    hi: '{previousDate} तक के {previous} जवाबों की तुलना {currentDate} तक के {current} जवाबों से।',
    mr: '{previousDate} पर्यंतच्या {previous} प्रतिसादांची {currentDate} पर्यंतच्या {current} प्रतिसादांशी तुलना.',
  },
  'ladder.direction.automatic': {
    en: 'Headway keeps collecting feedback automatically.',
    hi: 'Headway अपने-आप फ़ीडबैक जमा करता रहता है।',
    mr: 'Headway आपोआप फीडबॅक गोळा करत राहतं.',
  },
  'ladder.direction.methodTitle': {
    en: 'How Headway decides',
    hi: 'Headway कैसे तय करता है',
    mr: 'Headway कसं ठरवतं',
  },
  'ladder.direction.method': {
    en: 'A comparable set is at least {min} read responses collected over at least {days} days. Headway compares the share of feedback that mentions each topic, never the raw count, and calls something better or worse only when the change is too large to be chance.',
    hi: 'तुलना लायक़ अवधि में कम से कम {days} दिनों में आए कम से कम {min} पढ़े गए जवाब होते हैं। Headway हर विषय का ज़िक्र करने वाले फ़ीडबैक का हिस्सा मिलाता है, सिर्फ़ गिनती नहीं, और किसी चीज़ को बेहतर या ख़राब तभी कहता है जब बदलाव इतना बड़ा हो कि वह संयोग न हो।',
    mr: 'तुलनायोग्य कालावधीत किमान {days} दिवसांत आलेले किमान {min} वाचलेले प्रतिसाद असतात. Headway प्रत्येक विषयाचा उल्लेख करणाऱ्या फीडबॅकचा वाटा तुलना करतं, फक्त संख्या नाही, आणि बदल योगायोग नसावा इतका मोठा असेल तरच एखादी गोष्ट चांगली किंवा वाईट म्हणतं.',
  },

  // -------------------------------------------------------------------------
  // What Headway compares next — for the check-in page and Home's reveal.
  // Said as what happens by itself, never as a chore.
  // -------------------------------------------------------------------------
  'ladder.next.none': {
    en: 'Once feedback starts coming in, Headway records where things stand by itself, to compare against later.',
    hi: 'फ़ीडबैक आना शुरू होते ही Headway तुलना का आधार अपने-आप बनाता है।',
    mr: 'फीडबॅक यायला सुरुवात झाली की Headway तुलनेचा आधार आपोआप तयार करतं.',
  },
  'ladder.next.building': {
    en: 'Headway has started recording where things stand, to compare against later. When there is enough comparable feedback, it will show which way things are moving.',
    hi: 'Headway ने तुलना का आधार बनाना शुरू कर दिया है। तुलना लायक़ पर्याप्त फ़ीडबैक होने पर यह दिखाएगा कि चीज़ें किस तरफ़ जा रही हैं।',
    mr: 'Headway ने तुलनेचा आधार तयार करायला सुरुवात केली आहे. तुलना करता येईल इतका फीडबॅक झाला की गोष्टी कोणत्या दिशेने जात आहेत ते ते दाखवेल.',
  },
  'ladder.next.baseline.one': {
    en: 'Headway has recorded where things stood, and is collecting the next comparable set by itself: {count} response read since {date}.',
    hi: 'Headway के पास तुलना का आधार है, और वह अगली तुलना लायक़ अवधि अपने-आप जमा कर रहा है: {date} के बाद {count} जवाब पढ़ा गया।',
    mr: 'Headway कडे तुलनेचा आधार आहे, आणि ते पुढचा तुलनायोग्य कालावधी आपोआप गोळा करत आहे: {date} नंतर {count} प्रतिसाद वाचला.',
  },
  'ladder.next.baseline.other': {
    en: 'Headway has recorded where things stood, and is collecting the next comparable set by itself: {count} responses read since {date}.',
    hi: 'Headway के पास तुलना का आधार है, और वह अगली तुलना लायक़ अवधि अपने-आप जमा कर रहा है: {date} के बाद {count} जवाब पढ़े गए।',
    mr: 'Headway कडे तुलनेचा आधार आहे, आणि ते पुढचा तुलनायोग्य कालावधी आपोआप गोळा करत आहे: {date} नंतर {count} प्रतिसाद वाचले.',
  },
  'ladder.next.baselineNone': {
    en: 'Headway has recorded where things stood, and is collecting the next comparable set by itself. Nothing new has been read since {date} yet.',
    hi: 'Headway के पास तुलना का आधार है, और वह अगली तुलना लायक़ अवधि अपने-आप जमा कर रहा है। {date} के बाद अभी कुछ नया नहीं पढ़ा गया।',
    mr: 'Headway कडे तुलनेचा आधार आहे, आणि ते पुढचा तुलनायोग्य कालावधी आपोआप गोळा करत आहे. {date} नंतर अजून नवं काही वाचलेलं नाही.',
  },
  'ladder.next.compares.one': {
    en: 'Headway compares each new set of feedback with the one before, by itself. {count} response read since {date} is part of the next comparison.',
    hi: 'Headway फ़ीडबैक की हर नई अवधि की तुलना पिछली से अपने-आप करता है। {date} के बाद पढ़ा गया {count} जवाब अगली तुलना का हिस्सा है।',
    mr: 'Headway फीडबॅकच्या प्रत्येक नव्या कालावधीची आधीच्याशी तुलना आपोआप करतं. {date} नंतर वाचलेला {count} प्रतिसाद पुढच्या तुलनेचा भाग आहे.',
  },
  'ladder.next.compares.other': {
    en: 'Headway compares each new set of feedback with the one before, by itself. {count} responses read since {date} are part of the next comparison.',
    hi: 'Headway फ़ीडबैक की हर नई अवधि की तुलना पिछली से अपने-आप करता है। {date} के बाद पढ़े गए {count} जवाब अगली तुलना का हिस्सा हैं।',
    mr: 'Headway फीडबॅकच्या प्रत्येक नव्या कालावधीची आधीच्याशी तुलना आपोआप करतं. {date} नंतर वाचलेले {count} प्रतिसाद पुढच्या तुलनेचा भाग आहेत.',
  },
  'ladder.next.comparesNone': {
    en: 'Headway compares each new set of feedback with the one before, by itself. Nothing new has been read since {date} yet.',
    hi: 'Headway फ़ीडबैक की हर नई अवधि की तुलना पिछली से अपने-आप करता है। {date} के बाद अभी कुछ नया नहीं पढ़ा गया।',
    mr: 'Headway फीडबॅकच्या प्रत्येक नव्या कालावधीची आधीच्याशी तुलना आपोआप करतं. {date} नंतर अजून नवं काही वाचलेलं नाही.',
  },
  // -------------------------------------------------------------------------
  // Quieter ladder pass (Oct 2026): one line per idea
  // -------------------------------------------------------------------------
  'ladder.line.of': {
    en: '{count} of {total} customers',
    hi: '{total} में से {count} ग्राहक',
    mr: '{total} पैकी {count} ग्राहक',
  },
  'ladder.line.ofPct': {
    en: '{count} of {total} customers · {pct}%',
    hi: '{total} में से {count} ग्राहक · {pct}%',
    mr: '{total} पैकी {count} ग्राहक · {pct}%',
  },
  'ladder.count.one': {
    en: '{count} response',
    hi: '{count} जवाब',
    mr: '{count} प्रतिसाद',
  },
  'ladder.count.other': {
    en: '{count} responses',
    hi: '{count} जवाब',
    mr: '{count} प्रतिसाद',
  },
  'ladder.pulse.from.one': {
    en: '{average}★ from 1 rating',
    hi: '1 रेटिंग: {average}★',
    mr: '1 रेटिंग: {average}★',
  },
  'ladder.pulse.from.other': {
    en: '{average}★ from {count} ratings',
    hi: '{count} रेटिंग का औसत {average}★',
    mr: '{count} रेटिंगची सरासरी {average}★',
  },
  'ladder.mood.early.happy': {
    en: 'Most customers so far were happy.',
    hi: 'अब तक ज़्यादातर ग्राहक ख़ुश थे।',
    mr: 'आतापर्यंत बहुतेक ग्राहक खूश होते.',
  },
  'ladder.mood.early.unhappy': {
    en: 'Most customers so far were unhappy.',
    hi: 'अब तक ज़्यादातर ग्राहक नाख़ुश थे।',
    mr: 'आतापर्यंत बहुतेक ग्राहक नाराज होते.',
  },
  'ladder.mood.early.mixed': {
    en: 'Most responses so far were mixed.',
    hi: 'अब तक ज़्यादातर जवाब मिले-जुले थे।',
    mr: 'आतापर्यंत बहुतेक प्रतिसाद संमिश्र होते.',
  },
  'ladder.mood.early.split': {
    en: 'Customers are split so far.',
    hi: 'अब तक ग्राहकों की राय बँटी हुई है।',
    mr: 'आतापर्यंत ग्राहकांची मतं विभागलेली आहेत.',
  },
  'ladder.note.single': {
    en: 'One customer’s view — not a pattern.',
    hi: 'यह एक ग्राहक की राय है — पैटर्न नहीं।',
    mr: 'हे एका ग्राहकाचं मत आहे — पॅटर्न नाही.',
  },
  'ladder.note.early': {
    en: 'Still early — nothing has repeated yet.',
    hi: 'अभी शुरुआत है — अब तक कुछ दोहराया नहीं गया।',
    mr: 'अजून सुरुवात आहे — आतापर्यंत काहीही पुन्हा आलेलं नाही.',
  },
  'ladder.note.earlyRepeat': {
    en: 'Still early — nothing is a pattern yet.',
    hi: 'अभी शुरुआत है — अभी कुछ भी पैटर्न नहीं है।',
    mr: 'अजून सुरुवात आहे — अजून काहीही पॅटर्न नाही.',
  },
  'ladder.note.noProblemPattern': {
    en: 'No recurring problem so far.',
    hi: 'अब तक कोई बार-बार आने वाली समस्या नहीं।',
    mr: 'आतापर्यंत कोणतीही वारंवार येणारी अडचण नाही.',
  },
  'ladder.how.title': {
    en: 'How Headway decides',
    hi: 'Headway कैसे तय करता है',
    mr: 'Headway कसं ठरवतं',
  },
  'ladder.more.topics.one': {
    en: '1 more topic on Customers',
    hi: '1 और विषय — ग्राहक पेज पर',
    mr: 'आणखी 1 विषय — ग्राहक पानावर',
  },
  'ladder.more.topics.other': {
    en: '{count} more topics on Customers',
    hi: '{count} और विषय — ग्राहक पेज पर',
    mr: 'आणखी {count} विषय — ग्राहक पानावर',
  },
  'ladder.trends.now': {
    en: 'Right now',
    hi: 'अभी',
    mr: 'सध्या',
  },
  'ladder.trends.nowLink': {
    en: 'See what customers are saying',
    hi: 'देखें ग्राहक क्या कह रहे हैं',
    mr: 'ग्राहक काय म्हणत आहेत ते पाहा',
  },
  'ladder.direction.title.notStarted': {
    en: 'No history yet',
    hi: 'अभी कोई इतिहास नहीं',
    mr: 'अजून इतिहास नाही',
  },
  'ladder.direction.title.building': {
    en: 'Not enough history yet',
    hi: 'अभी पर्याप्त इतिहास नहीं',
    mr: 'अजून पुरेसा इतिहास नाही',
  },
  'ladder.direction.title.baselineSet': {
    en: 'Starting point recorded',
    hi: 'शुरुआती स्थिति दर्ज हो गई',
    mr: 'सुरुवातीची स्थिती नोंदवली',
  },
  'ladder.direction.title.tooThin': {
    en: 'Not enough to compare yet',
    hi: 'अभी तुलना के लिए पर्याप्त नहीं',
    mr: 'अजून तुलनेसाठी पुरेसं नाही',
  },
  'ladder.direction.title.ready': {
    en: 'What changed',
    hi: 'क्या बदला',
    mr: 'काय बदललं',
  },
  'ladder.mood.leanHappy': {
    en: 'More customers are happy than unhappy.',
    hi: 'नाख़ुश से ज़्यादा ग्राहक ख़ुश हैं।',
    mr: 'नाराज ग्राहकांपेक्षा खूश ग्राहक जास्त आहेत.',
  },
  'ladder.mood.leanUnhappy': {
    en: 'More customers are unhappy than happy.',
    hi: 'ख़ुश से ज़्यादा ग्राहक नाख़ुश हैं।',
    mr: 'खूश ग्राहकांपेक्षा नाराज ग्राहक जास्त आहेत.',
  },
  'ladder.mood.early.leanHappy': {
    en: 'So far, more customers were happy than unhappy.',
    hi: 'अब तक नाख़ुश से ज़्यादा ग्राहक ख़ुश थे।',
    mr: 'आतापर्यंत नाराज ग्राहकांपेक्षा खूश ग्राहक जास्त होते.',
  },
  'ladder.mood.early.leanUnhappy': {
    en: 'So far, more customers were unhappy than happy.',
    hi: 'अब तक ख़ुश से ज़्यादा ग्राहक नाख़ुश थे।',
    mr: 'आतापर्यंत खूश ग्राहकांपेक्षा नाराज ग्राहक जास्त होते.',
  },
  'ladder.note.notYetPattern': {
    en: 'No problem is a pattern yet.',
    hi: 'अभी कोई समस्या पैटर्न नहीं बनी है।',
    mr: 'अजून कोणतीही अडचण पॅटर्न बनलेली नाही.',
  },
} satisfies Namespace;
