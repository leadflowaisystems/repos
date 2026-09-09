import type { Namespace } from '../t';

/**
 * Home — the first screen, the main thing to fix, and what it is based on
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 *
 * WHOLE SENTENCES, NOT STEMS. The trial warning used to be built by dropping
 * "today", "tomorrow" or "in five days" into the middle of a sentence. That
 * only works in English: in Hindi and Marathi the day phrase and the verb sit
 * in different places, so each case is written out here as one complete
 * sentence and the component picks between them.
 */
export const home = {
  // -------------------------------------------------------------------------
  // The trial ending, said on Home only in the last two days
  // -------------------------------------------------------------------------
  'home.trial.endsToday': {
    en: 'Your Headway trial ends today, on {date}. Headway will not charge you automatically.',
    hi: 'आपका Headway ट्रायल आज, {date} को ख़त्म हो रहा है। Headway अपने आप पैसे नहीं काटेगा।',
    mr: 'तुमचा Headway ट्रायल आज, {date} रोजी संपत आहे. Headway आपोआप पैसे कापणार नाही.',
  },
  'home.trial.endsTomorrow': {
    en: 'Your Headway trial ends tomorrow, on {date}. Headway will not charge you automatically.',
    hi: 'आपका Headway ट्रायल कल, {date} को ख़त्म हो रहा है। Headway अपने आप पैसे नहीं काटेगा।',
    mr: 'तुमचा Headway ट्रायल उद्या, {date} रोजी संपत आहे. Headway आपोआप पैसे कापणार नाही.',
  },
  'home.trial.endsInDays.one': {
    en: 'Your Headway trial ends in {count} day, on {date}. Headway will not charge you automatically.',
    hi: 'आपका Headway ट्रायल {count} दिन में, {date} को ख़त्म हो रहा है। Headway अपने आप पैसे नहीं काटेगा।',
    mr: 'तुमचा Headway ट्रायल {count} दिवसात, {date} रोजी संपत आहे. Headway आपोआप पैसे कापणार नाही.',
  },
  'home.trial.endsInDays.other': {
    en: 'Your Headway trial ends in {count} days, on {date}. Headway will not charge you automatically.',
    hi: 'आपका Headway ट्रायल {count} दिन में, {date} को ख़त्म हो रहा है। Headway अपने आप पैसे नहीं काटेगा।',
    mr: 'तुमचा Headway ट्रायल {count} दिवसांत, {date} रोजी संपत आहे. Headway आपोआप पैसे कापणार नाही.',
  },
  'home.trial.continue': {
    en: 'Continue your service',
    hi: 'अपनी सेवा जारी रखें',
    mr: 'तुमची सेवा सुरू ठेवा',
  },

  // -------------------------------------------------------------------------
  // The section headings down the page
  //
  // "Also needs you" is now "Also needs your attention": software does not
  // need a person, it needs their attention, and the shorter phrasing read as
  // though the portal had feelings about being ignored.
  // -------------------------------------------------------------------------
  'home.alsoNeeds.title': {
    en: 'Also needs your attention',
    hi: 'इस पर भी ध्यान दें',
    mr: 'याकडेही लक्ष द्या',
  },
  'home.watching.title': {
    en: 'Headway is watching',
    hi: 'Headway नज़र रख रहा है',
    mr: 'Headway लक्ष ठेवत आहे',
  },
  'home.watching.note': {
    en: 'Nothing here needs your attention today',
    hi: 'यहाँ आज किसी बात पर ध्यान देने की ज़रूरत नहीं',
    mr: 'इथे आज कशाकडेही लक्ष द्यायची गरज नाही',
  },
  'home.goingWell.title': {
    en: 'Going well',
    hi: 'अच्छा चल रहा है',
    mr: 'चांगलं चाललं आहे',
  },
  'home.goingWell.note': {
    en: 'Keep doing this',
    hi: 'यही करते रहें',
    mr: 'हेच करत राहा',
  },
  'home.soFar.title': {
    en: 'What customers are mentioning so far',
    hi: 'अब तक ग्राहक किन बातों का ज़िक्र कर रहे हैं',
    mr: 'आतापर्यंत ग्राहक कशाचा उल्लेख करत आहेत',
  },
  'home.soFar.note': {
    en: 'Counts only, not conclusions',
    hi: 'सिर्फ़ गिनती, नतीजे नहीं',
    mr: 'फक्त मोजणी, निष्कर्ष नाहीत',
  },
  'home.question.title': {
    en: 'What Headway needs from you',
    hi: 'Headway को आपसे क्या चाहिए',
    mr: 'Headway ला तुमच्याकडून काय हवं आहे',
  },
  'home.knows.title': {
    en: 'What Headway knows about your business',
    hi: 'Headway आपके बिज़नेस के बारे में क्या जानता है',
    mr: 'Headway ला तुमच्या व्यवसायाबद्दल काय माहीत आहे',
  },

  // -------------------------------------------------------------------------
  // Nothing has arrived yet
  // -------------------------------------------------------------------------
  'home.empty.title': {
    en: 'Nothing yet',
    hi: 'अभी कुछ नहीं',
    mr: 'अजून काही नाही',
  },
  'home.empty.body': {
    en: 'No feedback has come in yet. Once customers give feedback through your QR code, this page will show what matters and whether anything needs your attention.',
    hi: 'अभी तक कोई फ़ीडबैक नहीं आया है। जैसे ही ग्राहक आपके QR कोड से फ़ीडबैक देंगे, यह पेज बताएगा कि क्या ज़रूरी है और कोई बात ध्यान देने लायक़ है या नहीं।',
    mr: 'अजून कोणताही फीडबॅक आलेला नाही. ग्राहकांनी तुमच्या QR कोडमधून फीडबॅक दिल्यावर, हे पेज काय महत्त्वाचं आहे आणि कशाकडे लक्ष द्यायची गरज आहे का, हे सांगेल.',
  },

  // -------------------------------------------------------------------------
  // The next check-in, and the one number that comes from outside the feedback
  // -------------------------------------------------------------------------
  'home.nextCheck.title': {
    en: 'Your next check-in',
    hi: 'आपका अगला चेक-इन',
    mr: 'तुमचं पुढचं चेक-इन',
  },
  'home.nextCheck.open': {
    en: 'Open your check-in',
    hi: 'अपना चेक-इन खोलें',
    mr: 'तुमचं चेक-इन उघडा',
  },
  'home.nextCheck.publicRating': {
    en: 'Public rating {value}.',
    hi: 'पब्लिक रेटिंग {value}।',
    mr: 'पब्लिक रेटिंग {value}.',
  },
} satisfies Namespace;
