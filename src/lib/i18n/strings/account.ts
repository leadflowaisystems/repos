import type { Namespace } from '../t';

/**
 * Account — service, dates, contact, and the language selector
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 */
export const account = {
  // -------------------------------------------------------------------------
  // Language
  //
  // The one section of the portal that must read correctly to somebody who
  // cannot yet read the rest of it. Each language names itself in its own
  // script, so an owner looking for Marathi finds "मराठी" whatever the screen
  // is currently set to.
  // -------------------------------------------------------------------------
  'account.language.title': {
    en: 'Language',
    hi: 'भाषा',
    mr: 'भाषा',
  },
  'account.language.help': {
    en: 'Choose the language you want to read Headway in.',
    hi: 'आप हेडवे किस भाषा में पढ़ना चाहते हैं, वह चुनें।',
    mr: 'तुम्हाला हेडवे कोणत्या भाषेत वाचायचे आहे ते निवडा.',
  },
  'account.language.scope': {
    en: 'This changes only what you see. Everyone else on your team keeps their own choice.',
    hi: 'इससे सिर्फ़ आपकी स्क्रीन बदलेगी। आपकी टीम के बाकी लोगों की भाषा वैसी ही रहेगी।',
    mr: 'यामुळे फक्त तुमची स्क्रीन बदलेल. तुमच्या टीममधील इतरांची भाषा तशीच राहील.',
  },
  'account.language.current': {
    en: 'Now showing',
    hi: 'अभी दिख रही है',
    mr: 'सध्या दिसत आहे',
  },
  'account.language.choose': {
    en: 'Show Headway in {language}',
    hi: 'हेडवे को {language} में दिखाएँ',
    mr: 'हेडवे {language} मध्ये दाखवा',
  },
  'account.language.saving': {
    en: 'Changing…',
    hi: 'बदल रहे हैं…',
    mr: 'बदलत आहे…',
  },
  'account.language.numbersNote': {
    en: 'Your numbers and dates stay exactly the same in every language.',
    hi: 'आपके आँकड़े और तारीख़ें हर भाषा में बिल्कुल वही रहते हैं।',
    mr: 'तुमचे आकडे आणि तारखा प्रत्येक भाषेत तशाच राहतात.',
  },

  // -------------------------------------------------------------------------
  // The page itself
  // -------------------------------------------------------------------------
  'account.meta.title': {
    en: 'Account',
    hi: 'अकाउंट',
    mr: 'अकाउंट',
  },
  'account.eyebrow': {
    en: 'Account',
    hi: 'अकाउंट',
    mr: 'अकाउंट',
  },

  // -------------------------------------------------------------------------
  // The headline: where this business stands, said once at the top
  // -------------------------------------------------------------------------
  'account.headline.workspace': {
    en: 'Your Headway workspace',
    hi: 'आपका हेडवे वर्कस्पेस',
    mr: 'तुमचं हेडवे वर्कस्पेस',
  },
  'account.headline.demo': {
    en: 'This is the demo workspace. It stays open.',
    hi: 'यह डेमो वर्कस्पेस है। यह हमेशा खुला रहता है।',
    mr: 'हे डेमो वर्कस्पेस आहे. ते नेहमी खुलं राहतं.',
  },
  'account.headline.staff': {
    en: 'You are signed in as Headway staff. This workspace is always open to you.',
    hi: 'आप हेडवे स्टाफ़ के तौर पर साइन इन हैं। यह वर्कस्पेस आपके लिए हमेशा खुला रहता है।',
    mr: 'तुम्ही हेडवे स्टाफ म्हणून साइन इन आहात. हे वर्कस्पेस तुमच्यासाठी नेहमी खुलं असतं.',
  },
  'account.headline.activeTitle': {
    en: 'Headway is active',
    hi: 'हेडवे चालू है',
    mr: 'हेडवे चालू आहे',
  },
  'account.headline.activeBody': {
    en: 'Your workspace is open. Your Headway contact arranged it for you.',
    hi: 'आपका वर्कस्पेस खुला है। आपके हेडवे संपर्क ने यह आपके लिए तय किया है।',
    mr: 'तुमचं वर्कस्पेस खुलं आहे. तुमच्या हेडवे संपर्काने ते तुमच्यासाठी ठरवलं आहे.',
  },
  'account.headline.pausedTitle': {
    en: 'Your Headway workspace is paused',
    hi: 'आपका हेडवे वर्कस्पेस रोका गया है',
    mr: 'तुमचं हेडवे वर्कस्पेस थांबवलं आहे',
  },
  'account.headline.trialEndedTitle': {
    en: 'Your Headway trial has ended',
    hi: 'आपकी हेडवे ट्रायल ख़त्म हो गई है',
    mr: 'तुमची हेडवे ट्रायल संपली आहे',
  },
  'account.locked.body': {
    en: 'Your feedback and your history are safe. Your workspace opens again when you continue your Headway service.',
    hi: 'आपका फ़ीडबैक और आपका पुराना रिकॉर्ड सुरक्षित है। जब आप हेडवे सर्विस आगे जारी रखेंगे, तब आपका वर्कस्पेस फिर से खुल जाएगा।',
    mr: 'तुमचा फीडबॅक आणि तुमचा जुना रेकॉर्ड सुरक्षित आहे. तुम्ही हेडवे सर्व्हिस पुढे सुरू ठेवाल तेव्हा तुमचं वर्कस्पेस पुन्हा उघडेल.',
  },

  // -------------------------------------------------------------------------
  // The service, as labelled rows. Every value is a date or a count the server
  // computed; only the labels are words.
  // -------------------------------------------------------------------------
  'account.service.eyebrow': {
    en: 'Your Headway service',
    hi: 'आपकी हेडवे सर्विस',
    mr: 'तुमची हेडवे सर्व्हिस',
  },
  'account.service.label': {
    en: 'Service',
    hi: 'सर्विस',
    mr: 'सर्व्हिस',
  },
  'account.service.demo': {
    en: 'Headway demo',
    hi: 'हेडवे डेमो',
    mr: 'हेडवे डेमो',
  },
  'account.service.headway': {
    en: 'Headway',
    hi: 'हेडवे',
    mr: 'हेडवे',
  },
  'account.service.trial': {
    en: 'Headway trial',
    hi: 'हेडवे ट्रायल',
    mr: 'हेडवे ट्रायल',
  },
  'account.service.status': {
    en: 'Status',
    hi: 'स्थिति',
    mr: 'स्थिती',
  },
  'account.service.pausedSince': {
    en: 'Paused since',
    hi: 'कब से रोका गया है',
    mr: 'कधीपासून थांबवलं आहे',
  },
  'account.service.resumed': {
    en: 'Started again',
    hi: 'फिर से कब शुरू हुआ',
    mr: 'पुन्हा कधी सुरू झालं',
  },
  'account.service.trialStarted': {
    en: 'Trial started',
    hi: 'ट्रायल शुरू हुई',
    mr: 'ट्रायल सुरू झाली',
  },
  'account.service.trialEnds': {
    en: 'Trial ends',
    hi: 'ट्रायल ख़त्म होगी',
    mr: 'ट्रायल संपेल',
  },
  'account.service.trialEnded': {
    en: 'Trial ended',
    hi: 'ट्रायल ख़त्म हो गई',
    mr: 'ट्रायल संपली',
  },
  'account.service.daysLeftLabel': {
    en: 'Days left',
    hi: 'कितने दिन बाकी हैं',
    mr: 'किती दिवस बाकी आहेत',
  },
  'account.service.endsToday': {
    en: 'Ends today',
    hi: 'आज ख़त्म हो रही है',
    mr: 'आज संपत आहे',
  },
  'account.service.daysLeft.one': {
    en: '{count} day',
    hi: '{count} दिन',
    mr: '{count} दिवस',
  },
  'account.service.daysLeft.other': {
    en: '{count} days',
    hi: '{count} दिन',
    mr: '{count} दिवस',
  },

  // -------------------------------------------------------------------------
  // The warning near the end of a trial.
  //
  // Whole sentences, never fragments. English puts the day before the date,
  // Hindi and Marathi put the postposition after it, and a sentence stitched
  // from pieces cannot do both.
  // -------------------------------------------------------------------------
  'account.warning.endsToday': {
    en: 'Your trial ends today, on {date}. Ask to continue and we will contact you.',
    hi: 'आपकी ट्रायल आज, {date} को ख़त्म हो रही है। आगे जारी रखने के लिए कहें, हम आपसे संपर्क करेंगे।',
    mr: 'तुमची ट्रायल आज, {date} रोजी संपत आहे. पुढे सुरू ठेवण्यासाठी सांगा, आम्ही तुमच्याशी संपर्क करू.',
  },
  'account.warning.endsTomorrow': {
    en: 'Your trial ends tomorrow, on {date}. Ask to continue and we will contact you.',
    hi: 'आपकी ट्रायल कल, {date} को ख़त्म हो रही है। आगे जारी रखने के लिए कहें, हम आपसे संपर्क करेंगे।',
    mr: 'तुमची ट्रायल उद्या, {date} रोजी संपत आहे. पुढे सुरू ठेवण्यासाठी सांगा, आम्ही तुमच्याशी संपर्क करू.',
  },
  'account.warning.endsInDays.one': {
    en: 'Your trial ends in {count} day, on {date}. Ask to continue and we will contact you.',
    hi: 'आपकी ट्रायल {count} दिन में, {date} को ख़त्म हो रही है। आगे जारी रखने के लिए कहें, हम आपसे संपर्क करेंगे।',
    mr: 'तुमची ट्रायल {count} दिवसात, {date} रोजी संपत आहे. पुढे सुरू ठेवण्यासाठी सांगा, आम्ही तुमच्याशी संपर्क करू.',
  },
  'account.warning.endsInDays.other': {
    en: 'Your trial ends in {count} days, on {date}. Ask to continue and we will contact you.',
    hi: 'आपकी ट्रायल {count} दिन में, {date} को ख़त्म हो रही है। आगे जारी रखने के लिए कहें, हम आपसे संपर्क करेंगे।',
    mr: 'तुमची ट्रायल {count} दिवसांत, {date} रोजी संपत आहे. पुढे सुरू ठेवण्यासाठी सांगा, आम्ही तुमच्याशी संपर्क करू.',
  },
  'account.warning.endsOn.one': {
    en: 'Your trial ends on {date}. That is {count} day from now.',
    hi: 'आपकी ट्रायल {date} को ख़त्म होगी। आज से {count} दिन बाकी है।',
    mr: 'तुमची ट्रायल {date} रोजी संपेल. आजपासून {count} दिवस बाकी आहे.',
  },
  'account.warning.endsOn.other': {
    en: 'Your trial ends on {date}. That is {count} days from now.',
    hi: 'आपकी ट्रायल {date} को ख़त्म होगी। आज से {count} दिन बाकी हैं।',
    mr: 'तुमची ट्रायल {date} रोजी संपेल. आजपासून {count} दिवस बाकी आहेत.',
  },

  // -------------------------------------------------------------------------
  // What Headway has done so far
  // -------------------------------------------------------------------------
  'account.activity.eyebrow': {
    en: 'What Headway has done so far',
    hi: 'हेडवे ने अब तक क्या किया',
    mr: 'हेडवेने आतापर्यंत काय केलं',
  },
  'account.activity.empty': {
    en: 'Nothing yet. When customers start scanning your card, this section will show how much feedback came in and what Headway found in it.',
    hi: 'अभी कुछ नहीं। जब ग्राहक आपका कार्ड स्कैन करना शुरू करेंगे, तब यहाँ दिखेगा कि कितना फ़ीडबैक आया और हेडवे ने उसमें क्या पाया।',
    mr: 'अजून काही नाही. ग्राहक तुमचं कार्ड स्कॅन करायला लागतील तेव्हा इथे दिसेल की किती फीडबॅक आला आणि हेडवेला त्यात काय सापडलं.',
  },

  // -------------------------------------------------------------------------
  // Continuing with Headway.
  //
  // Nothing here promises anything. Pressing the button sends a message; the
  // dates do not move until a person has spoken to them, and the words say so
  // in all three languages.
  // -------------------------------------------------------------------------
  'account.continue.eyebrow': {
    en: 'Continuing with Headway',
    hi: 'हेडवे आगे जारी रखना',
    mr: 'हेडवे पुढे सुरू ठेवणे',
  },
  'account.continue.received': {
    en: 'Request received',
    hi: 'आपकी रिक्वेस्ट मिल गई है',
    mr: 'तुमची विनंती मिळाली आहे',
  },
  'account.continue.ask': {
    en: 'Ask to continue',
    hi: 'आगे जारी रखने के लिए कहें',
    mr: 'पुढे सुरू ठेवण्यासाठी सांगा',
  },
  'account.continue.lockedPending': {
    en: 'We will contact you soon on {phone}. No money is taken automatically.',
    hi: 'हम जल्दी ही {phone} पर आपसे संपर्क करेंगे। अपने आप कोई पैसा नहीं कटेगा।',
    mr: 'आम्ही लवकरच {phone} वर तुमच्याशी संपर्क करू. आपोआप कोणतेही पैसे कापले जाणार नाहीत.',
  },
  'account.continue.lockedAsk': {
    en: 'Ask to continue and we will contact you. No money is taken automatically.',
    hi: 'आगे जारी रखने के लिए कहें, हम आपसे संपर्क करेंगे। अपने आप कोई पैसा नहीं कटेगा।',
    mr: 'पुढे सुरू ठेवण्यासाठी सांगा, आम्ही तुमच्याशी संपर्क करू. आपोआप कोणतेही पैसे कापले जाणार नाहीत.',
  },
  'account.continue.trialPending': {
    en: 'You asked on {date}. We will contact you soon on {phone}. No money is taken automatically. Your trial dates do not change until we have spoken.',
    hi: 'आपने {date} को कहा था। हम जल्दी ही {phone} पर आपसे संपर्क करेंगे। अपने आप कोई पैसा नहीं कटेगा। जब तक हमारी बात नहीं होती, तब तक आपकी ट्रायल की तारीख़ें नहीं बदलेंगी।',
    mr: 'तुम्ही {date} रोजी सांगितलं होतं. आम्ही लवकरच {phone} वर तुमच्याशी संपर्क करू. आपोआप कोणतेही पैसे कापले जाणार नाहीत. आपलं बोलणं होईपर्यंत तुमच्या ट्रायलच्या तारखा बदलणार नाहीत.',
  },
  'account.continue.question': {
    en: 'Want to continue with Headway?',
    hi: 'क्या आप हेडवे आगे जारी रखना चाहते हैं?',
    mr: 'तुम्हाला हेडवे पुढे सुरू ठेवायचं आहे का?',
  },
  'account.continue.trialBody': {
    en: 'Your trial gives you the whole workspace. When it ends, you can ask to continue. No money is taken automatically.',
    hi: 'ट्रायल में आपको पूरा वर्कस्पेस मिलता है। ट्रायल ख़त्म होने पर आप आगे जारी रखने के लिए कह सकते हैं। अपने आप कोई पैसा नहीं कटेगा।',
    mr: 'ट्रायलमध्ये तुम्हाला पूर्ण वर्कस्पेस मिळतं. ट्रायल संपल्यावर तुम्ही पुढे सुरू ठेवण्यासाठी सांगू शकता. आपोआप कोणतेही पैसे कापले जाणार नाहीत.',
  },
  'account.continue.ownerOnly': {
    en: 'Only the owner can ask to continue.',
    hi: 'सिर्फ़ मालिक ही आगे जारी रखने के लिए कह सकते हैं।',
    mr: 'फक्त मालकच पुढे सुरू ठेवण्यासाठी सांगू शकतात.',
  },

  // -------------------------------------------------------------------------
  // Contact, both directions
  // -------------------------------------------------------------------------
  'account.reach.eyebrow': {
    en: 'Where Headway reaches you',
    hi: 'हेडवे आपसे कहाँ संपर्क करेगा',
    mr: 'हेडवे तुमच्याशी कुठे संपर्क करेल',
  },
  'account.reach.none': {
    en: 'No contact details yet.',
    hi: 'अभी कोई संपर्क जानकारी नहीं है।',
    mr: 'अजून कोणतीही संपर्क माहिती नाही.',
  },
  'account.contact.eyebrow': {
    en: 'Reaching Headway',
    hi: 'हेडवे से संपर्क करना',
    mr: 'हेडवेशी संपर्क करणे',
  },
  'account.contact.body': {
    en: 'We reply to any request you send from this page. You can also contact us directly.',
    hi: 'इस पेज से आप जो भी रिक्वेस्ट भेजते हैं, हम उसका जवाब देते हैं। आप हमसे सीधे भी संपर्क कर सकते हैं।',
    mr: 'या पेजवरून तुम्ही पाठवलेल्या कोणत्याही विनंतीला आम्ही उत्तर देतो. तुम्ही आमच्याशी थेटही संपर्क करू शकता.',
  },
  'account.contact.email': {
    en: 'Email',
    hi: 'ईमेल',
    mr: 'ईमेल',
  },
  'account.contact.phone': {
    en: 'Phone',
    hi: 'फ़ोन',
    mr: 'फोन',
  },
} satisfies Namespace;
