import type { Namespace } from '../t';

/**
 * Service state in words: trial, active, paused, ended, locked, request received
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 *
 * WHAT IS DELIBERATELY NOT HERE: the operator's own labels. `operatorLabel()`
 * names the mechanism for staff — "Locked by hand", "Expired · QR still live" —
 * and the operator console is one language on purpose, so those stay English
 * literals in the code rather than becoming keys nobody would ever translate.
 */
export const lifecycle = {
  // -------------------------------------------------------------------------
  // Where this business stands, in the owner's own words.
  //
  // These are the values in the "Status" row on Account, so they are labels
  // rather than sentences: no full stop in English, and none in the other two.
  // "Paused" is the same word the workspace banner uses, and has to keep
  // meaning the same thing — feedback is still saved, nobody is reading it yet.
  // -------------------------------------------------------------------------
  'lifecycle.status.activeTrial': {
    en: 'Active trial',
    hi: 'ट्रायल चालू है',
    mr: 'ट्रायल चालू आहे',
  },
  'lifecycle.status.active': {
    en: 'Active',
    hi: 'चालू है',
    mr: 'चालू आहे',
  },
  'lifecycle.status.trialEnded': {
    en: 'Trial ended',
    hi: 'ट्रायल ख़त्म हो गई',
    mr: 'ट्रायल संपली',
  },
  'lifecycle.status.paused': {
    en: 'Paused',
    hi: 'रोका गया है',
    mr: 'थांबवलं आहे',
  },
  'lifecycle.status.staff': {
    en: 'Headway staff access',
    hi: 'हेडवे स्टाफ़ का एक्सेस',
    mr: 'हेडवे स्टाफचा अ‍ॅक्सेस',
  },
  'lifecycle.status.demo': {
    en: 'Demo workspace',
    hi: 'डेमो वर्कस्पेस',
    mr: 'डेमो वर्कस्पेस',
  },

  // -------------------------------------------------------------------------
  // The headline and the line under it on the Account page.
  //
  // Whole sentences, one key each. English says "runs until <date>", Hindi and
  // Marathi put the postposition after the date — a sentence stitched from a
  // prefix and a formatted date cannot do both, so the date is a placeholder
  // inside the phrase and never a fragment glued on.
  //
  // The date itself is never translated: it arrives already formatted and is
  // interpolated exactly as Headway computed it.
  // -------------------------------------------------------------------------
  'lifecycle.account.paused.headline': {
    en: 'Headway is paused',
    hi: 'हेडवे रोका गया है',
    mr: 'हेडवे थांबवलं आहे',
  },
  'lifecycle.account.paused.line': {
    en: 'Your feedback and your history are safe. New feedback is still saved. Headway is not reading it yet.',
    hi: 'आपका फ़ीडबैक और आपका पुराना रिकॉर्ड सुरक्षित है। नया फ़ीडबैक अब भी सेव हो रहा है। हेडवे उसे अभी पढ़ नहीं रहा।',
    mr: 'तुमचा फीडबॅक आणि तुमचा जुना रेकॉर्ड सुरक्षित आहे. नवीन फीडबॅक अजूनही सेव्ह होत आहे. हेडवे तो अजून वाचत नाही.',
  },
  'lifecycle.account.paused.note': {
    en: 'Paused since {date}.',
    hi: '{date} से रोका गया है।',
    mr: '{date} पासून थांबवलं आहे.',
  },
  'lifecycle.account.closed.headline': {
    en: 'Your account is closed',
    hi: 'आपका अकाउंट बंद है',
    mr: 'तुमचं अकाउंट बंद आहे',
  },
  'lifecycle.account.closed.line': {
    en: 'Your feedback and your history are safe. Headway is not reading new feedback.',
    hi: 'आपका फ़ीडबैक और आपका पुराना रिकॉर्ड सुरक्षित है। हेडवे नया फ़ीडबैक नहीं पढ़ रहा।',
    mr: 'तुमचा फीडबॅक आणि तुमचा जुना रेकॉर्ड सुरक्षित आहे. हेडवे नवीन फीडबॅक वाचत नाही.',
  },
  'lifecycle.account.active.headline': {
    en: 'Headway is active',
    hi: 'हेडवे चालू है',
    mr: 'हेडवे चालू आहे',
  },
  'lifecycle.account.active.line': {
    en: 'Headway is reading new feedback as it arrives.',
    hi: 'नया फ़ीडबैक जैसे-जैसे आता है, हेडवे उसे पढ़ता जाता है।',
    mr: 'नवीन फीडबॅक जसजसा येतो, तसा हेडवे तो वाचत जातो.',
  },
  'lifecycle.account.resumed.note': {
    en: 'Your account was paused. It is running again.',
    hi: 'आपका अकाउंट रोका गया था। अब वह फिर से चालू है।',
    mr: 'तुमचं अकाउंट थांबवलं होतं. आता ते पुन्हा चालू आहे.',
  },
  'lifecycle.account.trialEnded.headline': {
    en: 'Your trial has ended',
    hi: 'आपकी ट्रायल ख़त्म हो गई है',
    mr: 'तुमची ट्रायल संपली आहे',
  },
  'lifecycle.account.trialEnded.line': {
    en: 'Your feedback and your history are safe.',
    hi: 'आपका फ़ीडबैक और आपका पुराना रिकॉर्ड सुरक्षित है।',
    mr: 'तुमचा फीडबॅक आणि तुमचा जुना रेकॉर्ड सुरक्षित आहे.',
  },
  'lifecycle.account.trial.headline': {
    en: 'Your Headway trial',
    hi: 'आपकी हेडवे ट्रायल',
    mr: 'तुमची हेडवे ट्रायल',
  },
  'lifecycle.account.trial.line': {
    en: 'Your trial runs until {date}.',
    hi: 'आपकी ट्रायल {date} तक चलेगी।',
    mr: 'तुमची ट्रायल {date} पर्यंत चालेल.',
  },
  'lifecycle.account.trial.lineNoEndDate': {
    en: 'Your trial is running. Your Headway contact will confirm the end date.',
    hi: 'आपकी ट्रायल चल रही है। ख़त्म होने की तारीख़ आपका हेडवे संपर्क बता देगा।',
    mr: 'तुमची ट्रायल चालू आहे. संपण्याची तारीख तुमचा हेडवे संपर्क सांगेल.',
  },

  // -------------------------------------------------------------------------
  // Asking to continue, and keeping the contact details right.
  //
  // The two forms an owner can actually get wrong. A refusal an owner cannot
  // read is worse than no refusal at all: they are looking at a field that has
  // gone red and being told, in a language they do not use, what to do about
  // it. So these are translated like anything else on the screen.
  //
  // Operator-only refusals are NOT here — see the note at the top.
  // -------------------------------------------------------------------------
  'lifecycle.form.fieldsNeedAttention': {
    en: 'Some fields need attention.',
    hi: 'कुछ जानकारी ठीक करनी होगी।',
    mr: 'काही माहिती दुरुस्त करावी लागेल.',
  },
  'lifecycle.form.businessGone': {
    en: 'That business no longer exists.',
    hi: 'यह बिज़नेस अब मौजूद नहीं है।',
    mr: 'हा व्यवसाय आता अस्तित्वात नाही.',
  },
  'lifecycle.form.phoneNeeded': {
    en: 'Add a phone number we can reach you on.',
    hi: 'ऐसा फ़ोन नंबर डालें जिस पर हम आपसे संपर्क कर सकें।',
    mr: 'आम्ही तुमच्याशी संपर्क करू शकू असा फोन नंबर टाका.',
  },
  'lifecycle.form.emailLooksWrong': {
    en: 'That email address does not look right. You can leave it blank instead.',
    hi: 'यह ईमेल पता सही नहीं लग रहा। आप इसे खाली भी छोड़ सकते हैं।',
    mr: 'हा ईमेल पत्ता बरोबर वाटत नाही. तुम्ही तो रिकामा देखील ठेवू शकता.',
  },
  'lifecycle.form.nameNeeded': {
    en: 'Add your name.',
    hi: 'अपना नाम डालें।',
    mr: 'तुमचं नाव टाका.',
  },
  'lifecycle.form.emailNeeded': {
    en: 'Add a full email address.',
    hi: 'पूरा ईमेल पता डालें।',
    mr: 'पूर्ण ईमेल पत्ता टाका.',
  },
  'lifecycle.form.whatsappNeeded': {
    en: 'Add a WhatsApp or mobile number we can reach you on.',
    hi: 'ऐसा व्हाट्सऐप या मोबाइल नंबर डालें जिस पर हम आपसे संपर्क कर सकें।',
    mr: 'आम्ही तुमच्याशी संपर्क करू शकू असा व्हॉट्सअ‍ॅप किंवा मोबाइल नंबर टाका.',
  },
} satisfies Namespace;
