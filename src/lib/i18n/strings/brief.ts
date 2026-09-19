import type { Namespace } from '../t';

/**
 * The owner's brief — the first screen on a phone
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 *
 * SHORT ON PURPOSE. Every phrase here sits under a number or beside an arrow
 * on a 375px screen, so the rule while writing these was one line at that
 * width in all three languages. Anything that needed a second line was the
 * wrong phrase, not a layout problem — Devanagari sets wider than Latin, and a
 * label that wraps in Marathi and not in English makes the same screen two
 * different designs.
 *
 * HEADINGS ARE WHAT HEADWAY IS DOING, NOT WHAT THE SECTION CONTAINS. "Needs
 * your attention" and "What to do" are instructions; "Feedback overview" and
 * "Customer intelligence" are filing labels. The owner is here for the first
 * kind.
 */
export const brief = {
  // -------------------------------------------------------------------------
  // TODAY — the pile, and how it split
  // -------------------------------------------------------------------------
  'brief.today.title': {
    en: 'Today',
    hi: 'आज',
    mr: 'आज',
  },
  'brief.today.read.one': {
    en: '{count} feedback entry read',
    hi: '{count} फ़ीडबैक पढ़ा गया',
    mr: '{count} फीडबॅक वाचला',
  },
  'brief.today.read.other': {
    en: '{count} feedback entries read',
    hi: '{count} फ़ीडबैक पढ़े गए',
    mr: '{count} फीडबॅक वाचले',
  },
  'brief.today.happy': {
    en: 'Happy',
    hi: 'ख़ुश',
    mr: 'खूश',
  },
  'brief.today.mixed': {
    en: 'Mixed',
    hi: 'मिला-जुला',
    mr: 'संमिश्र',
  },
  'brief.today.unhappy': {
    en: 'Unhappy',
    hi: 'नाख़ुश',
    mr: 'नाराज',
  },
  'brief.today.waiting.one': {
    en: '{count} more arrived, being read now',
    hi: '{count} और आया है, अभी पढ़ा जा रहा है',
    mr: '{count} आणखी आला आहे, आत्ता वाचला जात आहे',
  },
  'brief.today.waiting.other': {
    en: '{count} more arrived, being read now',
    hi: '{count} और आए हैं, अभी पढ़े जा रहे हैं',
    mr: '{count} आणखी आले आहेत, आत्ता वाचले जात आहेत',
  },

  // -------------------------------------------------------------------------
  // The two cards
  //
  // "Needs your attention" rather than "Needs you": software does not need a
  // person. Home has said it that way since the launch pass and this is the
  // same pile, so it keeps the same words.
  // -------------------------------------------------------------------------
  'brief.attention.title': {
    en: 'Needs your attention',
    hi: 'इस पर ध्यान दें',
    mr: 'याकडे लक्ष द्या',
  },
  'brief.loved.title': {
    en: 'Customers like this',
    hi: 'ग्राहकों को यह पसंद है',
    mr: 'ग्राहकांना हे आवडतं',
  },
  'brief.action.title': {
    en: 'Do this next',
    hi: 'आगे यह करें',
    mr: 'पुढे हे करा',
  },
  'brief.keep.title': {
    en: 'Keep doing this',
    hi: 'यही करते रहें',
    mr: 'हेच करत राहा',
  },

  // The count against the pile it came from: "18 of 87".
  'brief.basis': {
    en: '{count} of {total}',
    hi: '{total} में से {count}',
    mr: '{total} पैकी {count}',
  },

  // -------------------------------------------------------------------------
  // Movement between the last two check-ins
  //
  // The words say WHICH WAY, never whether that is good. A complaint coming up
  // and praise coming up are the same arrow and opposite news, so the colour
  // carries the judgement and the phrase stays neutral in all three languages.
  // -------------------------------------------------------------------------
  'brief.trend.up': {
    en: 'more than last check-in',
    hi: 'पिछले चेक-इन से ज़्यादा',
    mr: 'मागच्या चेक-इनपेक्षा जास्त',
  },
  'brief.trend.down': {
    en: 'less than last check-in',
    hi: 'पिछले चेक-इन से कम',
    mr: 'मागच्या चेक-इनपेक्षा कमी',
  },
  'brief.trend.steady': {
    en: 'about the same',
    hi: 'लगभग वैसा ही',
    mr: 'साधारण तसंच',
  },

  // -------------------------------------------------------------------------
  // Evidence — customers in their own words
  // -------------------------------------------------------------------------
  'brief.evidence.title': {
    en: 'What customers said',
    hi: 'ग्राहकों ने क्या कहा',
    mr: 'ग्राहक काय म्हणाले',
  },
  'brief.evidence.all.one': {
    en: 'Read the {count} feedback entry',
    hi: '{count} फ़ीडबैक पढ़ें',
    mr: '{count} फीडबॅक वाचा',
  },
  'brief.evidence.all.other': {
    en: 'Read all {count} feedback entries',
    hi: 'सभी {count} फ़ीडबैक पढ़ें',
    mr: 'सर्व {count} फीडबॅक वाचा',
  },

  // -------------------------------------------------------------------------
  // What changed
  // -------------------------------------------------------------------------
  'brief.changed.title': {
    en: 'What changed',
    hi: 'क्या बदला',
    mr: 'काय बदललं',
  },

  // -------------------------------------------------------------------------
  // Nothing to say yet
  //
  // One honest line, not four empty headings. A first week with no feedback is
  // a normal state of this product, not an error, and it should read like one.
  // -------------------------------------------------------------------------
  'brief.early.title': {
    en: 'Nothing to report yet',
    hi: 'अभी बताने लायक़ कुछ नहीं',
    mr: 'अजून सांगण्यासारखं काही नाही',
  },
  'brief.early.body': {
    en: 'Headway will brief you here as soon as customers start giving feedback.',
    hi: 'ग्राहकों के फ़ीडबैक देते ही Headway आपको यहाँ बता देगा।',
    mr: 'ग्राहकांनी फीडबॅक द्यायला सुरुवात करताच Headway तुम्हाला इथे सांगेल.',
  },
  // Feedback has arrived, but not enough of it to be a pattern. The customers'
  // words are on the page below this; the brief only says why it is quiet.
  'brief.early.someTitle': {
    en: 'Too early to tell',
    hi: 'अभी कुछ कहना जल्दबाज़ी होगी',
    mr: 'आत्ताच काही सांगणं घाईचं होईल',
  },
  'brief.early.someBody': {
    en: 'Headway has read what customers sent so far. It will brief you here once a topic comes up often enough to be a pattern.',
    hi: 'ग्राहकों ने अब तक जो भेजा, Headway ने पढ़ लिया है। कोई विषय बार-बार आने पर Headway आपको यहाँ बताएगा।',
    mr: 'ग्राहकांनी आतापर्यंत जे पाठवलं ते Headway ने वाचलं आहे. एखादा विषय वारंवार आला की Headway तुम्हाला इथे सांगेल.',
  },

  // -------------------------------------------------------------------------
  // The rest of Home, moved behind one tap
  // -------------------------------------------------------------------------
  'brief.more.summary': {
    en: 'More detail',
    hi: 'और जानकारी',
    mr: 'अधिक माहिती',
  },

  // -------------------------------------------------------------------------
  // The band (final experience pass)
  //
  // Said on the owner's own clock — see components/workspace/greeting.tsx.
  // -------------------------------------------------------------------------
  'brief.greeting.morning': {
    en: 'Good morning',
    hi: 'सुप्रभात',
    mr: 'सुप्रभात',
  },
  'brief.greeting.afternoon': {
    en: 'Good afternoon',
    hi: 'शुभ दोपहर',
    mr: 'शुभ दुपार',
  },
  'brief.greeting.evening': {
    en: 'Good evening',
    hi: 'शुभ संध्या',
    mr: 'शुभ संध्याकाळ',
  },

  // What Headway is doing for this business, in counts it already keeps. A
  // statement of work, never a claim about results.
  'brief.status.watching.one': {
    en: 'Headway is watching {count} topic for you',
    hi: 'Headway आपके लिए {count} विषय पर नज़र रख रहा है',
    mr: 'Headway तुमच्यासाठी {count} विषयावर लक्ष ठेवत आहे',
  },
  'brief.status.watching.other': {
    en: 'Headway is watching {count} topics for you',
    hi: 'Headway आपके लिए {count} विषयों पर नज़र रख रहा है',
    mr: 'Headway तुमच्यासाठी {count} विषयांवर लक्ष ठेवत आहे',
  },
  'brief.status.arrived.one': {
    en: '{count} new since your last visit',
    hi: 'आपकी पिछली विज़िट के बाद {count} नया',
    mr: 'तुमच्या मागच्या भेटीनंतर {count} नवा',
  },
  'brief.status.arrived.other': {
    en: '{count} new since your last visit',
    hi: 'आपकी पिछली विज़िट के बाद {count} नए',
    mr: 'तुमच्या मागच्या भेटीनंतर {count} नवे',
  },
  // Feedback is arriving but no topic has come up often enough to follow yet.
  // Saying "watching 0 topics" would read as Headway doing nothing.
  'brief.status.patterns': {
    en: 'Headway is watching for patterns in your feedback',
    hi: 'Headway आपके फ़ीडबैक में बार-बार आने वाली बातों पर नज़र रख रहा है',
    mr: 'Headway तुमच्या फीडबॅकमध्ये वारंवार येणाऱ्या गोष्टींवर लक्ष ठेवत आहे',
  },
  'brief.status.ready': {
    en: 'Headway is ready for your first feedback',
    hi: 'Headway आपके पहले फ़ीडबैक के लिए तैयार है',
    mr: 'Headway तुमच्या पहिल्या फीडबॅकसाठी तयार आहे',
  },

  // THE LIVE LINE — the newest feedback, and where Headway is with it. Every
  // variant is a count of stored rows in a stored state: "is reading" only
  // while rows are genuinely waiting for the pipeline, "just read" only for
  // rows read in the last few minutes, and "waiting" when reading is paused.
  'brief.live.reading.one': {
    en: '{count} new customer response · Headway is reading it',
    hi: 'ग्राहक का {count} नया जवाब · Headway इसे पढ़ रहा है',
    mr: 'ग्राहकाचा {count} नवा प्रतिसाद · Headway तो वाचत आहे',
  },
  'brief.live.reading.other': {
    en: '{count} new customer responses · Headway is reading them',
    hi: 'ग्राहकों के {count} नए जवाब · Headway इन्हें पढ़ रहा है',
    mr: 'ग्राहकांचे {count} नवे प्रतिसाद · Headway ते वाचत आहे',
  },
  'brief.live.held.one': {
    en: '{count} new customer response · waiting to be read',
    hi: 'ग्राहक का {count} नया जवाब · पढ़े जाने का इंतज़ार',
    mr: 'ग्राहकाचा {count} नवा प्रतिसाद · वाचला जाण्याची वाट',
  },
  'brief.live.held.other': {
    en: '{count} new customer responses · waiting to be read',
    hi: 'ग्राहकों के {count} नए जवाब · पढ़े जाने का इंतज़ार',
    mr: 'ग्राहकांचे {count} नवे प्रतिसाद · वाचले जाण्याची वाट',
  },
  'brief.live.justRead.one': {
    en: 'Headway just read {count} new customer response',
    hi: 'Headway ने अभी ग्राहक का {count} नया जवाब पढ़ा',
    mr: 'Headway ने आत्ताच ग्राहकाचा {count} नवा प्रतिसाद वाचला',
  },
  'brief.live.justRead.other': {
    en: 'Headway just read {count} new customer responses',
    hi: 'Headway ने अभी ग्राहकों के {count} नए जवाब पढ़े',
    mr: 'Headway ने आत्ताच ग्राहकांचे {count} नवे प्रतिसाद वाचले',
  },

  // LATEST FROM CUSTOMERS — the newest few, in their own words, read or not.
  'brief.latest.title': {
    en: 'Latest from customers',
    hi: 'ग्राहकों की ताज़ा बातें',
    mr: 'ग्राहकांचं ताजं म्हणणं',
  },
  'brief.latest.all.one': {
    en: 'See the {count} response',
    hi: '{count} जवाब देखें',
    mr: '{count} प्रतिसाद पाहा',
  },
  'brief.latest.all.other': {
    en: 'See all {count} responses',
    hi: 'सभी {count} जवाब देखें',
    mr: 'सर्व {count} प्रतिसाद पाहा',
  },
  'brief.latest.new': {
    en: 'New · being read',
    hi: 'नया · पढ़ा जा रहा है',
    mr: 'नवा · वाचला जात आहे',
  },
  'brief.latest.held': {
    en: 'New · waiting to be read',
    hi: 'नया · पढ़े जाने का इंतज़ार',
    mr: 'नवा · वाचला जाण्याची वाट',
  },
  'brief.latest.failed': {
    en: 'Not read yet · Headway will try again',
    hi: 'अभी पढ़ा नहीं गया · Headway फिर कोशिश करेगा',
    mr: 'अजून वाचलं नाही · Headway पुन्हा प्रयत्न करेल',
  },
  'brief.latest.noWords': {
    en: 'Rated without writing anything',
    hi: 'कुछ लिखे बिना रेटिंग दी',
    mr: 'काही न लिहिता रेटिंग दिली',
  },

  // A change Headway checked while the owner was away. "after", never
  // "because of": the count moved and the change came first, and that is all.
  'brief.away.better': {
    en: 'came up less often after your change.',
    hi: 'आपके बदलाव के बाद कम बार आया।',
    mr: 'तुमच्या बदलानंतर कमी वेळा आलं.',
  },
  'brief.away.worse': {
    en: 'came up more often after your change.',
    hi: 'आपके बदलाव के बाद ज़्यादा बार आया।',
    mr: 'तुमच्या बदलानंतर जास्त वेळा आलं.',
  },
  'brief.away.checked': {
    en: 'was checked against new feedback.',
    hi: 'की नए फ़ीडबैक से जाँच हुई।',
    mr: 'ची नव्या फीडबॅकशी तपासणी झाली.',
  },

  // How customers feel: the three counts, and the pile they come from. Not
  // "today" — the counts cover everything Headway has read, and a heading
  // that said "today" over them would be a small lie on the first screen.
  'brief.mood.title': {
    en: 'How customers feel',
    hi: 'ग्राहक कैसा महसूस करते हैं',
    mr: 'ग्राहकांना कसं वाटतं',
  },
  'brief.mood.basis.one': {
    en: 'From {count} customer',
    hi: '{count} ग्राहक से',
    mr: '{count} ग्राहकाकडून',
  },
  'brief.mood.basis.other': {
    en: 'From {count} customers',
    hi: '{count} ग्राहकों से',
    mr: '{count} ग्राहकांकडून',
  },

  // -------------------------------------------------------------------------
  // The story
  // -------------------------------------------------------------------------
  'brief.meaning.title': {
    en: 'Why',
    hi: 'क्यों',
    mr: 'का',
  },
  // What unhappy customers themselves tapped, never an inference.
  'brief.meaning.tapped.one': {
    en: 'The reason customers picked most: “{specific}” ({count} customer).',
    hi: 'ग्राहकों ने सबसे ज़्यादा यह वजह चुनी: “{specific}” ({count} ग्राहक)।',
    mr: 'ग्राहकांनी सर्वात जास्त हे कारण निवडलं: “{specific}” ({count} ग्राहक).',
  },
  'brief.meaning.tapped.other': {
    en: 'The reason customers picked most: “{specific}” ({count} customers).',
    hi: 'ग्राहकों ने सबसे ज़्यादा यह वजह चुनी: “{specific}” ({count} ग्राहक)।',
    mr: 'ग्राहकांनी सर्वात जास्त हे कारण निवडलं: “{specific}” ({count} ग्राहक).',
  },
  // Headway speaks as Headway. Not "what I would do": the product does not
  // pretend to be a person.
  'brief.suggest.title': {
    en: 'What to do',
    hi: 'क्या करें',
    mr: 'काय करावं',
  },

  // -------------------------------------------------------------------------
  // Nothing needs the owner — said plainly, and meant
  // -------------------------------------------------------------------------
  'brief.calm.eyebrow': {
    en: 'Headway is watching',
    hi: 'Headway नज़र रख रहा है',
    mr: 'Headway लक्ष ठेवत आहे',
  },
  'brief.calm.title': {
    en: 'Nothing needs your attention',
    hi: 'अभी किसी बात पर ध्यान देने की ज़रूरत नहीं',
    mr: 'आत्ता कशाकडेही लक्ष द्यायची गरज नाही',
  },
  'brief.calm.body': {
    en: 'Headway is not seeing a strong problem right now.',
    hi: 'Headway को अभी कोई बड़ी समस्या नहीं दिख रही।',
    mr: 'Headway ला आत्ता कोणतीही मोठी अडचण दिसत नाही.',
  },
  'brief.calm.reading': {
    en: 'New feedback is still coming in, and Headway is reading it.',
    hi: 'नया फ़ीडबैक अभी आ रहा है, और Headway उसे पढ़ रहा है।',
    mr: 'नवा फीडबॅक अजून येत आहे, आणि Headway तो वाचत आहे.',
  },

  // -------------------------------------------------------------------------
  // What follows the story
  // -------------------------------------------------------------------------
  'brief.love.title': {
    en: 'Customers love',
    hi: 'ग्राहकों को पसंद है',
    mr: 'ग्राहकांना आवडतं',
  },
  'brief.changed.count.one': {
    en: '{count} change since your last check-in',
    hi: 'पिछले चेक-इन के बाद {count} बदलाव',
    mr: 'मागच्या चेक-इननंतर {count} बदल',
  },
  'brief.changed.count.other': {
    en: '{count} changes since your last check-in',
    hi: 'पिछले चेक-इन के बाद {count} बदलाव',
    mr: 'मागच्या चेक-इननंतर {count} बदल',
  },

  // The owner's record. Counts of what they changed and what customers did
  // after it — no score, no money, no streak.
  'brief.memory.title': {
    en: 'Your changes',
    hi: 'आपके बदलाव',
    mr: 'तुमचे बदल',
  },
  'brief.memory.all': {
    en: 'All changes',
    hi: 'सारे बदलाव',
    mr: 'सर्व बदल',
  },
  // The month's clearest result, when there is a measured one. "After", as
  // everywhere: the counts moved after the change, and that is all it claims.
  'brief.memory.biggest': {
    en: 'Biggest change this month',
    hi: 'इस महीने का सबसे बड़ा बदलाव',
    mr: 'या महिन्यातला सर्वात मोठा बदल',
  },
  'brief.memory.last30': {
    en: 'Last 30 days:',
    hi: 'पिछले 30 दिन:',
    mr: 'मागचे 30 दिवस:',
  },
  'brief.memory.made.one': {
    en: '{count} change made',
    hi: '{count} बदलाव किया',
    mr: '{count} बदल केला',
  },
  'brief.memory.made.other': {
    en: '{count} changes made',
    hi: '{count} बदलाव किए',
    mr: '{count} बदल केले',
  },
  'brief.memory.better.one': {
    en: '{count} looked better after',
    hi: '{count} बाद में बेहतर दिखा',
    mr: '{count} नंतर चांगला दिसला',
  },
  'brief.memory.better.other': {
    en: '{count} looked better after',
    hi: '{count} बाद में बेहतर दिखे',
    mr: '{count} नंतर चांगले दिसले',
  },
  'brief.memory.watching.one': {
    en: '{count} being watched',
    hi: '{count} पर नज़र है',
    mr: '{count} वर लक्ष आहे',
  },
  'brief.memory.watching.other': {
    en: '{count} being watched',
    hi: '{count} पर नज़र है',
    mr: '{count} वर लक्ष आहे',
  },
  'brief.memory.state.better': {
    en: 'Looks better after the change',
    hi: 'बदलाव के बाद बेहतर दिख रहा है',
    mr: 'बदलानंतर चांगलं दिसत आहे',
  },
  'brief.memory.state.worse': {
    en: 'Mentioned more after the change',
    hi: 'बदलाव के बाद ज़्यादा ज़िक्र हुआ',
    mr: 'बदलानंतर जास्त उल्लेख झाला',
  },
  'brief.memory.state.noChange': {
    en: 'No clear change yet',
    hi: 'अभी कोई साफ़ बदलाव नहीं',
    mr: 'अजून स्पष्ट बदल नाही',
  },
  'brief.memory.state.notEnough': {
    en: 'Too early to tell',
    hi: 'अभी कुछ कहना जल्दबाज़ी होगी',
    mr: 'आत्ताच काही सांगणं घाईचं होईल',
  },
  'brief.memory.state.watching': {
    en: 'Headway is watching',
    hi: 'Headway नज़र रख रहा है',
    mr: 'Headway लक्ष ठेवत आहे',
  },
  // -------------------------------------------------------------------------
  // Owner UX pass: the conclusion in the owner's words
  // -------------------------------------------------------------------------
  // Which way a topic is going, as good or bad news for the owner. The arrow
  // beside it still shows which way the COUNT moved.
  'brief.trend.worse': {
    en: 'Getting worse',
    hi: 'बिगड़ रहा है',
    mr: 'बिघडत आहे',
  },
  'brief.trend.better': {
    en: 'Getting better',
    hi: 'सुधर रहा है',
    mr: 'सुधारत आहे',
  },
  'brief.trend.same': {
    en: 'About the same',
    hi: 'लगभग वैसा ही',
    mr: 'साधारण तसंच',
  },
  // The band's status: how many things need the owner, not how busy Headway is.
  'brief.status.needs.one': {
    en: '{count} thing needs your attention',
    hi: '{count} बात पर आपका ध्यान चाहिए',
    mr: '{count} गोष्टीकडे तुमचं लक्ष हवं',
  },
  'brief.status.needs.other': {
    en: '{count} things need your attention',
    hi: '{count} बातों पर आपका ध्यान चाहिए',
    mr: '{count} गोष्टींकडे तुमचं लक्ष हवं',
  },
  // A count of people, not of rows.
  'brief.mentioned.one': {
    en: '{count} customer mentioned it',
    hi: '{count} ग्राहक ने इसका ज़िक्र किया',
    mr: '{count} ग्राहकाने याचा उल्लेख केला',
  },
  'brief.mentioned.other': {
    en: '{count} customers mentioned it',
    hi: '{count} ग्राहकों ने इसका ज़िक्र किया',
    mr: '{count} ग्राहकांनी याचा उल्लेख केला',
  },
  'brief.praised.one': {
    en: '{count} customer praised it',
    hi: '{count} ग्राहक ने इसकी तारीफ़ की',
    mr: '{count} ग्राहकाने याचं कौतुक केलं',
  },
  'brief.praised.other': {
    en: '{count} customers praised it',
    hi: '{count} ग्राहकों ने इसकी तारीफ़ की',
    mr: '{count} ग्राहकांनी याचं कौतुक केलं',
  },
  'brief.love.keep': {
    en: 'Keep doing this.',
    hi: 'ऐसे ही करते रहें।',
    mr: 'असंच करत राहा.',
  },
  'brief.evidence.cta': {
    en: 'See what customers said',
    hi: 'देखें ग्राहकों ने क्या कहा',
    mr: 'ग्राहक काय म्हणाले ते पाहा',
  },
  // What changed, one row per topic: the topic's name, its two counts, and
  // which kind of change it is. The same noun in red and green is the point.
  'brief.changed.moreComplaints': {
    en: 'More complaints',
    hi: 'ज़्यादा शिकायतें',
    mr: 'जास्त तक्रारी',
  },
  'brief.changed.fewerComplaints': {
    en: 'Fewer complaints',
    hi: 'कम शिकायतें',
    mr: 'कमी तक्रारी',
  },
  'brief.changed.morePraise': {
    en: 'More praise',
    hi: 'ज़्यादा तारीफ़',
    mr: 'जास्त कौतुक',
  },
  'brief.changed.lessPraise': {
    en: 'Less praise',
    hi: 'कम तारीफ़',
    mr: 'कमी कौतुक',
  },
  // --- mobile polish pass ------------------------------------------------------
  'brief.why': {
    en: 'See why',
    hi: 'वजह देखें',
    mr: 'कारण पाहा',
  },
  'brief.changed.see': {
    en: 'See what’s getting better or worse',
    hi: 'देखें क्या बेहतर हो रहा है और क्या बिगड़ रहा है',
    mr: 'काय सुधारतंय आणि काय बिघडतंय ते पाहा',
  },
} satisfies Namespace;
