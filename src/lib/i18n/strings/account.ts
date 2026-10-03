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
    hi: 'आप Headway किस भाषा में पढ़ना चाहते हैं, वह चुनें।',
    mr: 'तुम्हाला Headway कोणत्या भाषेत वाचायचे आहे ते निवडा.',
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
    hi: 'Headway को {language} में दिखाएँ',
    mr: 'Headway {language} मध्ये दाखवा',
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
    hi: 'आपका Headway वर्कस्पेस',
    mr: 'तुमचं Headway वर्कस्पेस',
  },
  'account.headline.demo': {
    en: 'This is the demo workspace. It stays open.',
    hi: 'यह डेमो वर्कस्पेस है। यह हमेशा खुला रहता है।',
    mr: 'हे डेमो वर्कस्पेस आहे. ते नेहमी खुलं राहतं.',
  },
  'account.headline.staff': {
    en: 'You are signed in as Headway staff. This workspace is always open to you.',
    hi: 'आप Headway स्टाफ़ के तौर पर साइन इन हैं। यह वर्कस्पेस आपके लिए हमेशा खुला रहता है।',
    mr: 'तुम्ही Headway स्टाफ म्हणून साइन इन आहात. हे वर्कस्पेस तुमच्यासाठी नेहमी खुलं असतं.',
  },
  'account.headline.activeTitle': {
    en: 'Headway is active',
    hi: 'Headway चालू है',
    mr: 'Headway चालू आहे',
  },
  'account.headline.activeBody': {
    en: 'Your workspace is open. Your Headway contact arranged it for you.',
    hi: 'आपका वर्कस्पेस खुला है। आपके Headway संपर्क ने यह आपके लिए तय किया है।',
    mr: 'तुमचं वर्कस्पेस खुलं आहे. तुमच्या Headway संपर्काने ते तुमच्यासाठी ठरवलं आहे.',
  },
  'account.headline.pausedTitle': {
    en: 'Your Headway workspace is paused',
    hi: 'आपका Headway वर्कस्पेस रोका गया है',
    mr: 'तुमचं Headway वर्कस्पेस थांबवलं आहे',
  },
  'account.headline.trialEndedTitle': {
    en: 'Your Headway trial has ended',
    hi: 'आपकी Headway ट्रायल ख़त्म हो गई है',
    mr: 'तुमची Headway ट्रायल संपली आहे',
  },
  'account.locked.body': {
    en: 'Your feedback and your history are safe. Your workspace opens again when you continue your Headway service.',
    hi: 'आपका फ़ीडबैक और आपका पुराना रिकॉर्ड सुरक्षित है। जब आप Headway सर्विस आगे जारी रखेंगे, तब आपका वर्कस्पेस फिर से खुल जाएगा।',
    mr: 'तुमचा फीडबॅक आणि तुमचा जुना रेकॉर्ड सुरक्षित आहे. तुम्ही Headway सर्व्हिस पुढे सुरू ठेवाल तेव्हा तुमचं वर्कस्पेस पुन्हा उघडेल.',
  },

  // -------------------------------------------------------------------------
  // The service, as labelled rows. Every value is a date or a count the server
  // computed; only the labels are words.
  // -------------------------------------------------------------------------
  'account.service.eyebrow': {
    en: 'Your Headway service',
    hi: 'आपकी Headway सर्विस',
    mr: 'तुमची Headway सर्व्हिस',
  },
  'account.service.label': {
    en: 'Service',
    hi: 'सर्विस',
    mr: 'सर्व्हिस',
  },
  'account.service.demo': {
    en: 'Headway demo',
    hi: 'Headway डेमो',
    mr: 'Headway डेमो',
  },
  'account.service.headway': {
    en: 'Headway',
    hi: 'Headway',
    mr: 'Headway',
  },
  'account.service.trial': {
    en: 'Headway trial',
    hi: 'Headway ट्रायल',
    mr: 'Headway ट्रायल',
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
    hi: 'Headway ने अब तक क्या किया',
    mr: 'Headway ने आतापर्यंत काय केलं',
  },
  'account.activity.empty': {
    en: 'Nothing yet. When customers start scanning your card, this section will show how much feedback came in and what Headway found in it.',
    hi: 'अभी कुछ नहीं। जब ग्राहक आपका कार्ड स्कैन करना शुरू करेंगे, तब यहाँ दिखेगा कि कितना फ़ीडबैक आया और Headway ने उसमें क्या पाया।',
    mr: 'अजून काही नाही. ग्राहक तुमचं कार्ड स्कॅन करायला लागतील तेव्हा इथे दिसेल की किती फीडबॅक आला आणि Headway ला त्यात काय सापडलं.',
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
    hi: 'Headway आगे जारी रखना',
    mr: 'Headway पुढे सुरू ठेवणे',
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
    hi: 'क्या आप Headway आगे जारी रखना चाहते हैं?',
    mr: 'तुम्हाला Headway पुढे सुरू ठेवायचं आहे का?',
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
    hi: 'Headway आपसे कहाँ संपर्क करेगा',
    mr: 'Headway तुमच्याशी कुठे संपर्क करेल',
  },
  'account.reach.none': {
    en: 'No contact details yet.',
    hi: 'अभी कोई संपर्क जानकारी नहीं है।',
    mr: 'अजून कोणतीही संपर्क माहिती नाही.',
  },
  'account.contact.eyebrow': {
    en: 'Reaching Headway',
    hi: 'Headway से संपर्क करना',
    mr: 'Headway शी संपर्क करणे',
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

  // -------------------------------------------------------------------------
  // Setting up the owner's own sign-in (M39, M52, M53)
  //
  // Shown to a person signed in with the temporary email and password
  // Headway handed over. Their OWN sign-in is on the email Headway recorded
  // for them; one button emails a link there, and opening it is where they
  // choose their password. The temporary sign-in keeps working until
  // Headway switches it off.
  // -------------------------------------------------------------------------
  'account.setup.eyebrow': {
    en: 'Set up your account',
    hi: 'अपना अकाउंट सेट करें',
    mr: 'तुमचं अकाउंट सेट करा',
  },
  'account.setup.noEmail': {
    en: 'Headway has not added your email address yet. Ask Headway to add it, then come back here.',
    hi: 'Headway ने अभी तक आपका ईमेल पता नहीं जोड़ा है। Headway से इसे जोड़ने को कहें, फिर यहाँ वापस आएँ।',
    mr: 'Headway ने अजून तुमचा ईमेल पत्ता जोडलेला नाही. Headway ला तो जोडायला सांगा, मग इथे परत या.',
  },
  'account.setup.intro': {
    en: 'Your own sign-in will use {email}. Press the button and we will email you a link. Open it, press the button on that page, and choose your password. Then sign in with this email and that password.',
    hi: 'आपका अपना साइन-इन {email} से होगा। बटन दबाएँ, हम आपको एक लिंक ईमेल करेंगे। उसे खोलें, उस पेज पर बटन दबाएँ, और अपना पासवर्ड चुनें। फिर इसी ईमेल और उस पासवर्ड से साइन इन करें।',
    mr: 'तुमचं स्वतःचं साइन-इन {email} ने होईल. बटण दाबा, आम्ही तुम्हाला एक लिंक ईमेल करू. ती उघडा, त्या पेजवरचं बटण दाबा, आणि तुमचा पासवर्ड निवडा. मग याच ईमेलने आणि त्या पासवर्डने साइन इन करा.',
  },
  'account.setup.notYours': {
    en: 'Not your email address? Tell Headway before you press the button.',
    hi: 'यह आपका ईमेल पता नहीं है? बटन दबाने से पहले Headway को बताएँ।',
    mr: 'हा तुमचा ईमेल पत्ता नाही? बटण दाबण्याआधी Headway ला सांगा.',
  },
  'account.setup.send': {
    en: 'Email me a link to set my password',
    hi: 'मुझे पासवर्ड सेट करने का लिंक ईमेल करें',
    mr: 'पासवर्ड सेट करण्याची लिंक मला ईमेल करा',
  },
  'account.setup.sending': {
    en: 'Sending…',
    hi: 'भेज रहे हैं…',
    mr: 'पाठवत आहोत…',
  },
  'account.setup.newest': {
    en: 'Only the newest link works. If it has not arrived in a few minutes, check your spam folder.',
    hi: 'सिर्फ़ सबसे नया लिंक काम करता है। अगर कुछ मिनट में न आए, तो अपना स्पैम फ़ोल्डर देखें।',
    mr: 'फक्त सगळ्यात नवीन लिंकच चालते. काही मिनिटांत आली नाही, तर तुमचा स्पॅम फोल्डर पाहा.',
  },
  'account.setup.ready': {
    en: 'Your email {email} is confirmed. If you have chosen your password, sign out and sign in with this email and that password. Not chosen one yet, or forgotten it? Get a new link below.',
    hi: 'आपका ईमेल {email} पुष्ट हो गया है। अगर आपने अपना पासवर्ड चुन लिया है, तो साइन आउट करें और इस ईमेल और उस पासवर्ड से साइन इन करें। अभी पासवर्ड नहीं चुना, या भूल गए? नीचे से नया लिंक लें।',
    mr: 'तुमचा ईमेल {email} खात्री झाला आहे. तुम्ही तुमचा पासवर्ड निवडला असेल, तर साइन आउट करा आणि या ईमेलने आणि त्या पासवर्डने साइन इन करा. अजून पासवर्ड निवडला नाही, किंवा विसरलात? खालून नवीन लिंक घ्या.',
  },
  'account.setup.linkSent': {
    en: 'We emailed a link to {email}. Open it on any device. Only the newest link works.',
    hi: 'हमने {email} पर एक लिंक ईमेल किया है। उसे किसी भी डिवाइस पर खोलें। सिर्फ़ सबसे नया लिंक काम करता है।',
    mr: 'आम्ही {email} वर एक लिंक ईमेल केली आहे. ती कोणत्याही डिव्हाइसवर उघडा. फक्त सगळ्यात नवीन लिंकच चालते.',
  },
  'account.setup.linkWait': {
    en: 'Too many emails were asked for just now, so this one was not sent. Wait a few minutes, then try again — or use the newest link you already have.',
    hi: 'अभी बहुत सारे ईमेल माँगे गए, इसलिए यह नहीं भेजा गया। कुछ मिनट रुकें, फिर दोबारा कोशिश करें — या आपके पास जो सबसे नया लिंक है, उसे इस्तेमाल करें।',
    mr: 'आत्ता खूप ईमेल मागितले गेले, म्हणून हा पाठवला नाही. काही मिनिटं थांबा, मग पुन्हा प्रयत्न करा — किंवा तुमच्याकडे असलेली सगळ्यात नवीन लिंक वापरा.',
  },
  'account.setup.linkFailed': {
    en: 'We could not send the email just now. Try again in a few minutes, or contact Headway.',
    hi: 'हम अभी ईमेल नहीं भेज सके। कुछ मिनट बाद दोबारा कोशिश करें, या Headway से संपर्क करें।',
    mr: 'आम्ही आत्ता ईमेल पाठवू शकलो नाही. काही मिनिटांनी पुन्हा प्रयत्न करा, किंवा Headway शी संपर्क करा.',
  },
  'account.setup.unknown': {
    en: 'We could not check your own sign-in just now. Reload this page in a minute.',
    hi: 'हम अभी आपका अपना साइन-इन जाँच नहीं सके। एक मिनट बाद यह पेज दोबारा लोड करें।',
    mr: 'आम्ही आत्ता तुमचं स्वतःचं साइन-इन तपासू शकलो नाही. एक मिनिटाने हे पेज पुन्हा लोड करा.',
  },

  // -------------------------------------------------------------------------
  // Signing in with your own email: the email and the password (M52)
  // -------------------------------------------------------------------------
  'account.signin.eyebrow': {
    en: 'Signing in',
    hi: 'साइन इन',
    mr: 'साइन इन',
  },
  'account.signin.email': {
    en: 'Sign-in email',
    hi: 'साइन-इन ईमेल',
    mr: 'साइन-इन ईमेल',
  },
  'account.signin.forgot': {
    en: 'Never chose a password, or forgotten it? Sign out, then use “Forgot password?” on the sign-in page.',
    hi: 'कभी पासवर्ड नहीं चुना, या भूल गए? साइन आउट करें, फिर साइन-इन पेज पर “Forgot password?” इस्तेमाल करें।',
    mr: 'कधी पासवर्ड निवडला नाही, किंवा विसरलात? साइन आउट करा, मग साइन-इन पेजवर “Forgot password?” वापरा.',
  },
  'account.signin.password': {
    en: 'Password',
    hi: 'पासवर्ड',
    mr: 'पासवर्ड',
  },
  'account.signin.emailConfirmed': {
    en: 'Your new email address is confirmed. Sign in with it from now on.',
    hi: 'आपके नए ईमेल पते की पुष्टि हो गई है। अब से इसी से साइन इन करें।',
    mr: 'तुमच्या नवीन ईमेल पत्त्याची खात्री झाली आहे. आता यानेच साइन इन करा.',
  },
} satisfies Namespace;
