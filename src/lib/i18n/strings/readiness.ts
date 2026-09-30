import type { Namespace } from '../t';

/**
 * Before there is enough feedback to read — the one state, said once.
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed.
 *
 * EVERY PAGE THAT READS FEEDBACK SAYS THIS IN THESE WORDS. Home, Customers,
 * the check-in family and Improvements all render the same component from the
 * same builder (`src/lib/portal/readiness.ts`), so an owner with three
 * responses is never told "too early" on one page and shown a trend on the
 * next. A page that wants to say something different here is a page that has
 * started to disagree with the others.
 *
 * NOT AN ERROR, AND NOT AN APOLOGY. A new business with no feedback is the
 * normal first week of this product. The copy says what has arrived, that
 * Headway is working, how far there is to go, and the one thing the owner can
 * do about it.
 */
export const readiness = {
  // -------------------------------------------------------------------------
  // Nothing has arrived yet
  // -------------------------------------------------------------------------
  'readiness.none.eyebrow': {
    en: 'Getting started',
    hi: 'शुरुआत',
    mr: 'सुरुवात',
  },
  'readiness.none.title': {
    en: 'Waiting for your first feedback',
    hi: 'आपके पहले फ़ीडबैक का इंतज़ार है',
    mr: 'तुमच्या पहिल्या फीडबॅकची वाट पाहत आहोत',
  },
  'readiness.none.body': {
    en: 'Headway starts reading as soon as a customer uses your QR card or feedback link. Put the card where customers can see it, or share the link with them.',
    hi: 'जैसे ही कोई ग्राहक आपके QR कार्ड या फ़ीडबैक लिंक का इस्तेमाल करता है, Headway पढ़ना शुरू कर देता है। कार्ड ऐसी जगह रखें जहाँ ग्राहक उसे देख सकें, या लिंक उनके साथ शेयर करें।',
    mr: 'ग्राहकाने तुमचं QR कार्ड किंवा फीडबॅक लिंक वापरताच Headway वाचायला सुरुवात करतं. कार्ड ग्राहकांना दिसेल अशा ठिकाणी ठेवा, किंवा लिंक त्यांना पाठवा.',
  },

  // -------------------------------------------------------------------------
  // Some has arrived, not yet enough for a pattern
  // -------------------------------------------------------------------------
  'readiness.building.eyebrow': {
    en: 'Insights building',
    hi: 'जानकारी तैयार हो रही है',
    mr: 'माहिती तयार होत आहे',
  },
  'readiness.building.title': {
    en: 'Your insights are still building',
    hi: 'आपकी जानकारी अभी तैयार हो रही है',
    mr: 'तुमची माहिती अजून तयार होत आहे',
  },
  'readiness.building.body.one': {
    en: "You've received {count} response so far. Headway needs a little more customer feedback before it can show meaningful patterns and trends.",
    hi: 'अब तक आपको {count} जवाब मिला है। सही पैटर्न और रुझान दिखाने से पहले Headway को ग्राहकों से थोड़ा और फ़ीडबैक चाहिए।',
    mr: 'आतापर्यंत तुम्हाला {count} प्रतिसाद मिळाला आहे. ठोस पॅटर्न आणि ट्रेंड दाखवण्याआधी Headway ला ग्राहकांकडून थोडा आणखी फीडबॅक हवा आहे.',
  },
  'readiness.building.body.other': {
    en: "You've received {count} responses so far. Headway needs a little more customer feedback before it can show meaningful patterns and trends.",
    hi: 'अब तक आपको {count} जवाब मिले हैं। सही पैटर्न और रुझान दिखाने से पहले Headway को ग्राहकों से थोड़ा और फ़ीडबैक चाहिए।',
    mr: 'आतापर्यंत तुम्हाला {count} प्रतिसाद मिळाले आहेत. ठोस पॅटर्न आणि ट्रेंड दाखवण्याआधी Headway ला ग्राहकांकडून थोडा आणखी फीडबॅक हवा आहे.',
  },

  // One short of the line. Its own words, because "still building" at four of
  // five undersells how close the owner is.
  'readiness.almost.title': {
    en: 'Almost there',
    hi: 'बस थोड़ा और',
    mr: 'जवळजवळ पूर्ण',
  },
  'readiness.almost.body.one': {
    en: "You've received {count} response. Headway will start showing your strongest customer patterns and trends once you reach {target} responses.",
    hi: 'आपको {count} जवाब मिला है। {target} जवाब पूरे होते ही Headway आपके ग्राहकों के सबसे साफ़ पैटर्न और रुझान दिखाना शुरू कर देगा।',
    mr: 'तुम्हाला {count} प्रतिसाद मिळाला आहे. {target} प्रतिसाद पूर्ण होताच Headway तुमच्या ग्राहकांचे सर्वात ठळक पॅटर्न आणि ट्रेंड दाखवायला सुरुवात करेल.',
  },
  'readiness.almost.body.other': {
    en: "You've received {count} responses. Headway will start showing your strongest customer patterns and trends once you reach {target} responses.",
    hi: 'आपको {count} जवाब मिले हैं। {target} जवाब पूरे होते ही Headway आपके ग्राहकों के सबसे साफ़ पैटर्न और रुझान दिखाना शुरू कर देगा।',
    mr: 'तुम्हाला {count} प्रतिसाद मिळाले आहेत. {target} प्रतिसाद पूर्ण होताच Headway तुमच्या ग्राहकांचे सर्वात ठळक पॅटर्न आणि ट्रेंड दाखवायला सुरुवात करेल.',
  },

  // -------------------------------------------------------------------------
  // The progress, as counts. Never a percentage: "40%" of five responses is a
  // number that looks like a finding and is not one.
  // -------------------------------------------------------------------------
  'readiness.progress': {
    en: '{count} / {target} responses',
    hi: '{count} / {target} जवाब',
    mr: '{count} / {target} प्रतिसाद',
  },
  'readiness.remaining.one': {
    en: '{count} more response to go',
    hi: 'बस {count} जवाब और',
    mr: 'आणखी {count} प्रतिसाद हवा',
  },
  'readiness.remaining.other': {
    en: '{count} more responses to go',
    hi: 'बस {count} जवाब और',
    mr: 'आणखी {count} प्रतिसाद हवे',
  },

  // -------------------------------------------------------------------------
  // What happens next, and the one thing the owner can do
  // -------------------------------------------------------------------------
  'readiness.next.title': {
    en: 'What to do now',
    hi: 'अभी क्या करें',
    mr: 'आता काय करायचं',
  },
  'readiness.next.body': {
    en: 'Keep asking customers to share feedback through your QR card or link. Headway reads every response as it arrives.',
    hi: 'ग्राहकों को अपने QR कार्ड या लिंक से फ़ीडबैक देने के लिए कहते रहें। Headway हर जवाब आते ही पढ़ लेता है।',
    mr: 'ग्राहकांना तुमच्या QR कार्ड किंवा लिंकवरून फीडबॅक द्यायला सांगत राहा. प्रत्येक प्रतिसाद येताच Headway तो वाचतं.',
  },
  'readiness.promise': {
    en: 'At {target} responses, Headway starts showing what customers like, what needs attention, and how it changes over time.',
    hi: '{target} जवाब होने पर Headway दिखाना शुरू करेगा कि ग्राहकों को क्या पसंद है, किस पर ध्यान देना है, और समय के साथ क्या बदलता है।',
    mr: '{target} प्रतिसाद झाल्यावर ग्राहकांना काय आवडतं, कशाकडे लक्ष द्यायला हवं आणि कालांतराने काय बदलतं, हे Headway दाखवायला सुरुवात करेल.',
  },
  'readiness.cta.kit': {
    en: 'Get your QR card and link',
    hi: 'अपना QR कार्ड और लिंक देखें',
    mr: 'तुमचं QR कार्ड आणि लिंक पाहा',
  },
  'readiness.cta.read.one': {
    en: 'Read the response',
    hi: 'जवाब पढ़ें',
    mr: 'प्रतिसाद वाचा',
  },
  'readiness.cta.read.other': {
    en: 'Read all {count} responses',
    hi: 'सभी {count} जवाब पढ़ें',
    mr: 'सर्व {count} प्रतिसाद वाचा',
  },
} satisfies Namespace;
