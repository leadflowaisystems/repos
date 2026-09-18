import type { Namespace } from '../t';

/**
 * More — the fourth door on a phone
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 *
 * THE HINTS SAY WHAT THE DOOR IS FOR, NOT WHAT IS BEHIND IT. "Every topic
 * customers raise" is a reason to tap; "The analysis page" is a filing label.
 * An owner who has never opened one of these should be able to tell from the
 * hint alone whether it is the thing they want, which is the whole job of this
 * screen.
 */
export const more = {
  // -------------------------------------------------------------------------
  // The three groups
  // -------------------------------------------------------------------------
  'more.group.deeper': {
    en: 'Look deeper',
    hi: 'और गहराई से देखें',
    mr: 'अधिक खोलात पाहा',
  },
  'more.group.cards': {
    en: 'Your cards',
    hi: 'आपके कार्ड',
    mr: 'तुमची कार्डं',
  },
  'more.group.account': {
    en: 'Your account',
    hi: 'आपका अकाउंट',
    mr: 'तुमचं अकाउंट',
  },

  // -------------------------------------------------------------------------
  // What each door is for
  // -------------------------------------------------------------------------
  'more.hint.customers': {
    en: 'Every topic customers raise, with the evidence',
    hi: 'ग्राहक जिन-जिन बातों का ज़िक्र करते हैं, सबूत के साथ',
    mr: 'ग्राहक ज्या ज्या गोष्टी सांगतात, पुराव्यासह',
  },
  'more.hint.checkin': {
    en: 'What moved this week and this month',
    hi: 'इस हफ़्ते और इस महीने क्या बदला',
    mr: 'या आठवड्यात आणि या महिन्यात काय बदललं',
  },
  'more.hint.kit': {
    en: 'Print your QR code, or order more cards',
    hi: 'अपना QR कोड प्रिंट करें, या और कार्ड मँगाएँ',
    mr: 'तुमचा QR कोड प्रिंट करा, किंवा आणखी कार्डं मागवा',
  },
  'more.hint.orders': {
    en: 'Where your card order has reached',
    hi: 'आपका कार्ड ऑर्डर कहाँ तक पहुँचा',
    mr: 'तुमची कार्ड ऑर्डर कुठवर पोहोचली',
  },
  'more.hint.account': {
    en: 'Language, team and your subscription',
    hi: 'भाषा, टीम और आपकी सदस्यता',
    mr: 'भाषा, टीम आणि तुमची सदस्यता',
  },
} satisfies Namespace;
