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
    en: 'Headway starts reading the moment a customer uses your QR card or feedback link. Put the card where customers can see it, or share the link with them.',
    hi: 'जैसे ही कोई ग्राहक आपका QR कार्ड या फ़ीडबैक लिंक इस्तेमाल करता है, Headway पढ़ना शुरू कर देता है। कार्ड ऐसी जगह रखें जहाँ ग्राहक उसे देख सकें, या लिंक उनके साथ शेयर करें।',
    mr: 'ग्राहकाने तुमचं QR कार्ड किंवा फीडबॅक लिंक वापरताच Headway वाचायला सुरुवात करतं. कार्ड ग्राहकांना दिसेल अशा ठिकाणी ठेवा, किंवा लिंक त्यांना पाठवा.',
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
    en: 'What customers seem to like',
    hi: 'ग्राहकों को क्या पसंद आ रहा है',
    mr: 'ग्राहकांना काय आवडताना दिसतं',
  },
  'ladder.section.patterns': {
    en: 'What customers keep raising',
    hi: 'ग्राहक बार-बार क्या कह रहे हैं',
    mr: 'ग्राहक पुन्हा पुन्हा काय सांगत आहेत',
  },
  'ladder.section.watching': {
    en: 'Worth watching',
    hi: 'नज़र रखने लायक़',
    mr: 'लक्ष ठेवण्यासारखं',
  },
  'ladder.section.notSure': {
    en: 'Not sure yet',
    hi: 'अभी पक्का नहीं',
    mr: 'अजून खात्री नाही',
  },
  'ladder.section.clearer': {
    en: 'What more feedback will show',
    hi: 'ज़्यादा फ़ीडबैक से क्या साफ़ होगा',
    mr: 'आणखी फीडबॅकने काय स्पष्ट होईल',
  },
  'ladder.section.doing': {
    en: 'What Headway is doing',
    hi: 'Headway क्या कर रहा है',
    mr: 'Headway काय करत आहे',
  },
  'ladder.section.everything': {
    en: 'Everything mentioned so far',
    hi: 'अब तक जिन बातों का ज़िक्र हुआ',
    mr: 'आतापर्यंत ज्या गोष्टींचा उल्लेख झाला',
  },
  'ladder.section.now': {
    en: 'What customers are saying now',
    hi: 'ग्राहक अभी क्या कह रहे हैं',
    mr: 'ग्राहक सध्या काय सांगत आहेत',
  },
  'ladder.section.nowNote': {
    en: 'Counted across everything Headway has read. This is where things stand today, not which way they are moving.',
    hi: 'Headway ने जो कुछ पढ़ा है, उस सबमें से गिना गया। यह आज की स्थिति है, यह नहीं कि चीज़ें किस तरफ़ जा रही हैं।',
    mr: 'Headway ने वाचलेल्या सगळ्यातून मोजलेलं. ही आजची स्थिती आहे, गोष्टी कोणत्या दिशेने जात आहेत ते नाही.',
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
  'ladder.reviews.cta': {
    en: 'Read what customers wrote',
    hi: 'पढ़ें ग्राहकों ने क्या लिखा',
    mr: 'ग्राहकांनी काय लिहिलं ते वाचा',
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
  'ladder.line.issue.observation.early': {
    en: 'One customer mentioned this. Headway is watching to see whether others mention it too.',
    hi: 'एक ग्राहक ने इसका ज़िक्र किया। Headway देख रहा है कि क्या दूसरे ग्राहक भी इसका ज़िक्र करते हैं।',
    mr: 'एका ग्राहकाने याचा उल्लेख केला. इतर ग्राहकही याचा उल्लेख करतात का हे Headway पाहत आहे.',
  },
  'ladder.line.issue.observation.later': {
    en: 'One customer mentioned this. A one-off so far.',
    hi: 'एक ग्राहक ने इसका ज़िक्र किया। अब तक यह एक अकेली बात है।',
    mr: 'एका ग्राहकाने याचा उल्लेख केला. आतापर्यंत ही एकच घटना आहे.',
  },
  'ladder.line.praise.observation': {
    en: 'One customer praised this so far.',
    hi: 'अब तक एक ग्राहक ने इसकी तारीफ़ की है।',
    mr: 'आतापर्यंत एका ग्राहकाने याचं कौतुक केलं आहे.',
  },
  'ladder.line.issue.signal.early': {
    en: '{count} of {total} customers mentioned this. Still early, so Headway is watching it rather than calling it a pattern.',
    hi: '{total} में से {count} ग्राहकों ने इसका ज़िक्र किया। अभी शुरुआत है, इसलिए Headway इसे पैटर्न कहने के बजाय इस पर नज़र रख रहा है।',
    mr: '{total} पैकी {count} ग्राहकांनी याचा उल्लेख केला. अजून सुरुवात आहे, म्हणून Headway याला पॅटर्न म्हणण्याऐवजी याकडे लक्ष ठेवत आहे.',
  },
  'ladder.line.issue.signal.later': {
    en: '{count} of {total} customers mentioned this. Not enough to call it a pattern yet, so Headway is watching it.',
    hi: '{total} में से {count} ग्राहकों ने इसका ज़िक्र किया। इसे पैटर्न कहने के लिए अभी इतना काफ़ी नहीं, इसलिए Headway इस पर नज़र रख रहा है।',
    mr: '{total} पैकी {count} ग्राहकांनी याचा उल्लेख केला. याला पॅटर्न म्हणण्यासाठी अजून इतकं पुरेसं नाही, म्हणून Headway याकडे लक्ष ठेवत आहे.',
  },
  'ladder.line.praise.signal': {
    en: '{count} of {total} customers praised this so far.',
    hi: 'अब तक {total} में से {count} ग्राहकों ने इसकी तारीफ़ की है।',
    mr: 'आतापर्यंत {total} पैकी {count} ग्राहकांनी याचं कौतुक केलं आहे.',
  },
  'ladder.line.issue.emerging': {
    en: 'Emerging pattern: {count} of {total} customers mentioned this ({pct}%).',
    hi: 'उभरता पैटर्न: {total} में से {count} ग्राहकों ने इसका ज़िक्र किया ({pct}%)।',
    mr: 'आकार घेणारा पॅटर्न: {total} पैकी {count} ग्राहकांनी याचा उल्लेख केला ({pct}%).',
  },
  'ladder.line.praise.emerging': {
    en: 'Emerging: {count} of {total} customers praised this ({pct}%).',
    hi: 'उभरता हुआ: {total} में से {count} ग्राहकों ने इसकी तारीफ़ की ({pct}%)।',
    mr: 'आकार घेत आहे: {total} पैकी {count} ग्राहकांनी याचं कौतुक केलं ({pct}%).',
  },
  'ladder.line.issue.strong': {
    en: 'Strong recurring pattern: {count} of {total} customers mentioned this ({pct}%).',
    hi: 'बार-बार आने वाला पक्का पैटर्न: {total} में से {count} ग्राहकों ने इसका ज़िक्र किया ({pct}%)।',
    mr: 'वारंवार येणारा ठोस पॅटर्न: {total} पैकी {count} ग्राहकांनी याचा उल्लेख केला ({pct}%).',
  },
  'ladder.line.praise.strong': {
    en: 'Consistently praised: {count} of {total} customers ({pct}%).',
    hi: 'लगातार तारीफ़: {total} में से {count} ग्राहक ({pct}%)।',
    mr: 'सातत्याने कौतुक: {total} पैकी {count} ग्राहक ({pct}%).',
  },

  // -------------------------------------------------------------------------
  // What to do, scaled to the evidence
  // -------------------------------------------------------------------------
  'ladder.action.watch': {
    en: 'Keep an eye on this.',
    hi: 'इस पर नज़र रखें।',
    mr: 'याकडे लक्ष ठेवा.',
  },
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
    en: 'All {count} responses so far were happy.',
    hi: 'अब तक के सभी {count} जवाब ख़ुश थे।',
    mr: 'आतापर्यंतचे सगळे {count} प्रतिसाद खूश होते.',
  },
  'ladder.mood.allUnhappy': {
    en: 'All {count} responses so far were unhappy.',
    hi: 'अब तक के सभी {count} जवाब नाख़ुश थे।',
    mr: 'आतापर्यंतचे सगळे {count} प्रतिसाद नाराज होते.',
  },
  'ladder.mood.happyNoneUnhappy': {
    en: '{happy} of {total} responses so far were happy, and none were unhappy.',
    hi: 'अब तक {total} में से {happy} जवाब ख़ुश थे, और कोई भी नाख़ुश नहीं था।',
    mr: 'आतापर्यंत {total} पैकी {happy} प्रतिसाद खूश होते, आणि एकही नाराज नव्हता.',
  },
  'ladder.mood.happy': {
    en: '{happy} of {total} responses so far were happy.',
    hi: 'अब तक {total} में से {happy} जवाब ख़ुश थे।',
    mr: 'आतापर्यंत {total} पैकी {happy} प्रतिसाद खूश होते.',
  },
  'ladder.mood.unhappy': {
    en: '{unhappy} of {total} responses so far were unhappy.',
    hi: 'अब तक {total} में से {unhappy} जवाब नाख़ुश थे।',
    mr: 'आतापर्यंत {total} पैकी {unhappy} प्रतिसाद नाराज होते.',
  },
  'ladder.mood.mixed': {
    en: '{mixed} of {total} responses so far were mixed or neutral.',
    hi: 'अब तक {total} में से {mixed} जवाब मिले-जुले या तटस्थ थे।',
    mr: 'आतापर्यंत {total} पैकी {mixed} प्रतिसाद संमिश्र किंवा तटस्थ होते.',
  },
  'ladder.mood.split': {
    en: 'Responses so far are split: {happy} happy, {mixed} mixed, {unhappy} unhappy.',
    hi: 'अब तक के जवाब बँटे हुए हैं: {happy} ख़ुश, {mixed} मिले-जुले, {unhappy} नाख़ुश।',
    mr: 'आतापर्यंतचे प्रतिसाद विभागलेले आहेत: {happy} खूश, {mixed} संमिश्र, {unhappy} नाराज.',
  },

  // -------------------------------------------------------------------------
  // The very first response, line by line
  // -------------------------------------------------------------------------
  'ladder.first.rated': {
    en: 'They rated you {stars}★.',
    hi: 'उन्होंने आपको {stars}★ दिए।',
    mr: 'त्यांनी तुम्हाला {stars}★ दिले.',
  },
  'ladder.first.noRating': {
    en: 'They didn’t leave a star rating.',
    hi: 'उन्होंने स्टार रेटिंग नहीं दी।',
    mr: 'त्यांनी स्टार रेटिंग दिली नाही.',
  },
  'ladder.first.tone.happy': {
    en: 'Headway reads it as a happy response.',
    hi: 'Headway इसे एक ख़ुश जवाब के रूप में पढ़ता है।',
    mr: 'Headway हा एक खूश प्रतिसाद म्हणून वाचतं.',
  },
  'ladder.first.tone.mixed': {
    en: 'Headway reads it as mixed.',
    hi: 'Headway इसे मिला-जुला जवाब मानता है।',
    mr: 'Headway हा संमिश्र प्रतिसाद मानतं.',
  },
  'ladder.first.tone.unhappy': {
    en: 'Headway reads it as an unhappy response.',
    hi: 'Headway इसे एक नाख़ुश जवाब के रूप में पढ़ता है।',
    mr: 'Headway हा एक नाराज प्रतिसाद म्हणून वाचतं.',
  },
  'ladder.first.praised': {
    en: 'They praised: {things}.',
    hi: 'उन्होंने इनकी तारीफ़ की: {things}।',
    mr: 'त्यांनी यांचं कौतुक केलं: {things}.',
  },
  'ladder.first.mentioned': {
    en: 'They mentioned a problem with: {things}.',
    hi: 'उन्होंने इनमें समस्या बताई: {things}।',
    mr: 'त्यांनी यांत अडचण सांगितली: {things}.',
  },
  'ladder.first.nothingNamed': {
    en: 'They didn’t name anything specific, so it is not filed under a topic.',
    hi: 'उन्होंने कोई ख़ास बात नहीं बताई, इसलिए इसे किसी विषय में नहीं रखा गया।',
    mr: 'त्यांनी कोणतीही विशिष्ट गोष्ट सांगितली नाही, म्हणून हा कोणत्याही विषयात ठेवलेला नाही.',
  },
  'ladder.first.noWords': {
    en: 'They left a rating without words.',
    hi: 'उन्होंने बिना कुछ लिखे रेटिंग दी।',
    mr: 'त्यांनी काही न लिहिता रेटिंग दिली.',
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
  'ladder.direction.title': {
    en: 'Which way things are moving',
    hi: 'चीज़ें किस तरफ़ जा रही हैं',
    mr: 'गोष्टी कोणत्या दिशेने जात आहेत',
  },
  'ladder.direction.notStarted': {
    en: 'Once feedback arrives, Headway records where things stand by itself, and compares later feedback with it to show what is improving, worsening or staying about the same.',
    hi: 'फ़ीडबैक आते ही Headway तुलना का आधार अपने-आप बनाता है। बाद का फ़ीडबैक उससे मिलाकर दिखाया जाता है कि क्या सुधर रहा है, क्या बिगड़ रहा है और क्या लगभग वैसा ही है।',
    mr: 'फीडबॅक आला की Headway तुलनेचा आधार आपोआप तयार करतं. नंतरचा फीडबॅक त्याच्याशी जुळवून काय सुधारत आहे, काय बिघडत आहे आणि काय साधारण तसंच आहे ते दाखवलं जातं.',
  },
  'ladder.direction.building': {
    en: 'Headway has started recording where things stand, to compare against later. When there is enough comparable feedback, Headway will show whether things are improving, worsening, or staying about the same.',
    hi: 'Headway ने आपके ग्राहकों के फ़ीडबैक से तुलना का आधार बनाना शुरू कर दिया है। जब तुलना लायक़ पर्याप्त फ़ीडबैक होगा, Headway दिखाएगा कि चीज़ें सुधर रही हैं, बिगड़ रही हैं या लगभग वैसी ही हैं।',
    mr: 'Headway ने तुमच्या ग्राहकांच्या फीडबॅकमधून तुलनेचा आधार तयार करायला सुरुवात केली आहे. तुलना करता येईल इतका फीडबॅक झाला की गोष्टी सुधारत आहेत, बिघडत आहेत की साधारण तशाच आहेत ते Headway दाखवेल.',
  },
  'ladder.direction.baselineSet.one': {
    en: 'Headway has recorded where things stood: {count} response up to {date}. Headway needs another comparable set of customer feedback before it can tell you whether something is improving, worsening, or staying about the same.',
    hi: 'Headway के पास तुलना का आधार है: {date} तक का {count} जवाब। कोई चीज़ सुधर रही है, बिगड़ रही है या लगभग वैसी ही है, यह बताने से पहले Headway को ग्राहक फ़ीडबैक की एक और तुलना लायक़ अवधि चाहिए।',
    mr: 'Headway कडे तुलनेचा आधार आहे: {date} पर्यंतचा {count} प्रतिसाद. एखादी गोष्ट सुधारत आहे, बिघडत आहे की साधारण तशीच आहे हे सांगण्याआधी Headway ला ग्राहक फीडबॅकचा आणखी एक तुलनायोग्य कालावधी लागतो.',
  },
  'ladder.direction.baselineSet.other': {
    en: 'Headway has recorded where things stood: {count} responses up to {date}. Headway needs another comparable set of customer feedback before it can tell you whether something is improving, worsening, or staying about the same.',
    hi: 'Headway के पास तुलना का आधार है: {date} तक के {count} जवाब। कोई चीज़ सुधर रही है, बिगड़ रही है या लगभग वैसी ही है, यह बताने से पहले Headway को ग्राहक फ़ीडबैक की एक और तुलना लायक़ अवधि चाहिए।',
    mr: 'Headway कडे तुलनेचा आधार आहे: {date} पर्यंतचे {count} प्रतिसाद. एखादी गोष्ट सुधारत आहे, बिघडत आहे की साधारण तशीच आहे हे सांगण्याआधी Headway ला ग्राहक फीडबॅकचा आणखी एक तुलनायोग्य कालावधी लागतो.',
  },
  'ladder.direction.tooThin': {
    en: 'Headway has two sets of feedback to compare, but one is too small to compare fairly ({previous} and {current} responses). It keeps collecting and compares again by itself.',
    hi: 'Headway के पास तुलना के लिए फ़ीडबैक की दो अवधियाँ हैं, पर एक इतनी छोटी है कि ठीक से तुलना नहीं हो सकती ({previous} और {current} जवाब)। यह फ़ीडबैक जमा करता रहता है और अपने-आप फिर तुलना करेगा।',
    mr: 'Headway कडे तुलनेसाठी फीडबॅकचे दोन कालावधी आहेत, पण एक इतका छोटा आहे की नीट तुलना होऊ शकत नाही ({previous} आणि {current} प्रतिसाद). ते फीडबॅक गोळा करत राहतं आणि आपोआप पुन्हा तुलना करेल.',
  },
  'ladder.direction.ready': {
    en: 'Compared by Headway: {previous} responses up to {previousDate}, and {current} up to {currentDate}.',
    hi: 'Headway ने तुलना की: {previousDate} तक के {previous} जवाब, और {currentDate} तक के {current}।',
    mr: 'Headway ने तुलना केली: {previousDate} पर्यंतचे {previous} प्रतिसाद, आणि {currentDate} पर्यंतचे {current}.',
  },
  'ladder.direction.automatic': {
    en: 'Headway keeps collecting and analysing feedback automatically. You don’t need to do anything.',
    hi: 'Headway अपने-आप फ़ीडबैक जमा करता और पढ़ता रहता है। आपको कुछ करने की ज़रूरत नहीं।',
    mr: 'Headway आपोआप फीडबॅक गोळा करत आणि वाचत राहतं. तुम्हाला काहीही करायची गरज नाही.',
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
  'ladder.direction.see': {
    en: 'See trends',
    hi: 'रुझान देखें',
    mr: 'कल पाहा',
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
} satisfies Namespace;
