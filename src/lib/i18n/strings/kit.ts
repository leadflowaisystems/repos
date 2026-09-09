import type { Namespace } from '../t';

/**
 * Print kit — the QR card and the printable sheets
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 *
 * TWO THINGS ARE DELIBERATELY NOT TRANSLATED ON THIS PAGE.
 *
 * The MEASUREMENTS are the sheet's own footer read back to the owner — A4,
 * 100%, 101.6 × 152.4 mm, 250–300 gsm. A print shop is handed those numbers
 * whatever language the owner reads in, so the figures, the units and the
 * paper names stay exactly as they are printed. Only the words around them
 * change.
 *
 * The STAFF SCRIPT is not here at all. What a waiter says at the table comes
 * from the business's own pack, already written in English, Hinglish and
 * Marathi for the person saying it out loud. It is content, not interface, and
 * the language the owner reads the portal in must not decide which of the
 * three lines their staff are given.
 */
export const kit = {
  // -------------------------------------------------------------------------
  // The page itself
  // -------------------------------------------------------------------------
  'kit.meta.title': {
    en: 'Print kit',
    hi: 'प्रिंट किट',
    mr: 'प्रिंट किट',
  },
  'kit.intro.eyebrow': {
    en: 'Print kit',
    hi: 'प्रिंट किट',
    mr: 'प्रिंट किट',
  },
  'kit.intro.title': {
    en: 'Your feedback card',
    hi: 'आपका फ़ीडबैक कार्ड',
    mr: 'तुमचं फीडबॅक कार्ड',
  },
  'kit.intro.description': {
    en: 'Put the card where customers can see it. Every scan is a customer telling you how it went.',
    hi: 'कार्ड वहाँ रखें जहाँ ग्राहक उसे देख सकें। हर स्कैन का मतलब है, एक ग्राहक आपको बता रहा है कि कैसा रहा।',
    mr: 'कार्ड तिथे ठेवा जिथे ग्राहकांना ते दिसेल. प्रत्येक स्कॅनचा अर्थ आहे, एक ग्राहक तुम्हाला सांगत आहे की कसं झालं.',
  },

  // -------------------------------------------------------------------------
  // The strip of figures
  //
  // The component prints the VALUE first and the LABEL after it, and no
  // language can reorder those two. So each half has to stand on its own:
  // "Live" beside "feedback page", never "Live" completing a phrase its label
  // started. A half-sentence finished by its label reads correctly in English
  // and in no other language — in Hindi and Marathi the words land in the
  // wrong order and the line stops being a sentence at all.
  // -------------------------------------------------------------------------
  'kit.status.page.label': {
    en: 'feedback page',
    hi: 'फ़ीडबैक पेज',
    mr: 'फीडबॅक पेज',
  },
  'kit.status.page.live': {
    en: 'Live',
    hi: 'चालू',
    mr: 'सुरू',
  },
  'kit.status.page.paused': {
    en: 'Paused',
    hi: 'रोका गया है',
    mr: 'थांबवलं आहे',
  },
  'kit.status.print.label': {
    en: 'print kit',
    hi: 'प्रिंट किट',
    mr: 'प्रिंट किट',
  },
  'kit.status.print.value': {
    en: 'Ready',
    hi: 'तैयार',
    mr: 'तयार',
  },
  'kit.status.through.one': {
    en: 'feedback entry from the card',
    hi: 'फ़ीडबैक कार्ड से आया',
    mr: 'फीडबॅक कार्डमधून आला',
  },
  'kit.status.through.other': {
    en: 'feedback entries from the card',
    hi: 'फ़ीडबैक कार्ड से आए',
    mr: 'फीडबॅक कार्डमधून आले',
  },

  // -------------------------------------------------------------------------
  // The two sheets
  // -------------------------------------------------------------------------
  'kit.sheets.eyebrow': {
    en: 'Your sheets',
    hi: 'आपकी शीट',
    mr: 'तुमच्या शीट',
  },
  'kit.sheets.note': {
    en: 'Two ways to stand the card up',
    hi: 'कार्ड खड़ा करने के दो तरीक़े',
    mr: 'कार्ड उभं करण्याचे दोन मार्ग',
  },
  'kit.sheets.intro': {
    en: 'Both sheets have the same card. Pick the one that suits the place where it will stand. Print at 100%, then check that the ruler bar on the sheet measures 100 mm.',
    hi: 'दोनों शीट पर एक ही कार्ड है। कार्ड जहाँ रखना है, उसके हिसाब से एक शीट चुनें। 100% पर प्रिंट करें, फिर जाँचें कि शीट पर बना रूलर 100 mm नापता है।',
    mr: 'दोन्ही शीटवर तेच कार्ड आहे. कार्ड जिथे ठेवायचं आहे त्यानुसार एक शीट निवडा. 100% वर प्रिंट करा, मग शीटवरचा रूलर 100 mm मोजतो का ते तपासा.',
  },
  'kit.sheets.previewAlt': {
    en: '{sheet} — a picture of the sheet',
    hi: '{sheet} — शीट की तस्वीर',
    mr: '{sheet} — शीटचं चित्र',
  },
  'kit.sheets.download': {
    en: 'Download',
    hi: 'डाउनलोड करें',
    mr: 'डाउनलोड करा',
  },
  'kit.sheets.open': {
    en: 'Open to print',
    hi: 'प्रिंट करने के लिए खोलें',
    mr: 'प्रिंट करण्यासाठी उघडा',
  },

  // The 4 × 6 in insert card: A4, two cards to a sheet.
  'kit.sheets.insert.label': {
    en: '4 × 6 in Insert Card',
    hi: '4 × 6 इंच इन्सर्ट कार्ड',
    mr: '4 × 6 इंच इन्सर्ट कार्ड',
  },
  'kit.sheets.insert.note': {
    en: 'A4 · two cards per sheet',
    hi: 'A4 · एक शीट पर दो कार्ड',
    mr: 'A4 · एका शीटवर दोन कार्ड',
  },
  'kit.sheets.insert.what': {
    en: 'Two 4 × 6 inch cards on one A4 sheet, for an acrylic stand.',
    hi: 'एक A4 शीट पर 4 × 6 इंच के दो कार्ड, एक्रिलिक स्टैंड के लिए।',
    mr: 'एका A4 शीटवर 4 × 6 इंचाची दोन कार्ड, ॲक्रिलिक स्टँडसाठी.',
  },
  'kit.sheets.insert.finish': {
    en: 'Cut on the dashed line. Put one card in an L-stand, or two back to back in a T-stand.',
    hi: 'डैश वाली लाइन पर काटें। एक कार्ड L-स्टैंड में लगाएँ, या दो कार्ड पीठ से पीठ जोड़कर T-स्टैंड में लगाएँ।',
    mr: 'डॅश असलेल्या रेषेवर कापा. एक कार्ड L-स्टँडमध्ये लावा, किंवा दोन कार्ड पाठीला पाठ लावून T-स्टँडमध्ये लावा.',
  },
  'kit.sheets.insert.spec': {
    en: 'A4 at 100% · card 101.6 × 152.4 mm · 250–300 gsm matte card, no lamination needed',
    hi: 'A4, 100% पर · कार्ड 101.6 × 152.4 mm · 250–300 gsm मैट कार्ड, लैमिनेशन की ज़रूरत नहीं',
    mr: 'A4, 100% वर · कार्ड 101.6 × 152.4 mm · 250–300 gsm मॅट कार्ड, लॅमिनेशनची गरज नाही',
  },

  // The joined pair on Legal, which folds into a tent or cuts into two cards.
  'kit.sheets.pair.label': {
    en: 'Legal Joined Pair — Tent + Stand Cards',
    hi: 'लीगल जुड़ा हुआ जोड़ा — टेंट + स्टैंड कार्ड',
    mr: 'लीगल जोडलेली जोडी — टेंट + स्टँड कार्ड',
  },
  'kit.sheets.pair.note': {
    en: 'Legal · two joined pairs per sheet',
    hi: 'लीगल · एक शीट पर दो जुड़े हुए जोड़े',
    mr: 'लीगल · एका शीटवर दोन जोडलेल्या जोड्या',
  },
  'kit.sheets.pair.what': {
    en: 'Two joined pairs on one Legal sheet. No stand to buy.',
    hi: 'एक लीगल शीट पर दो जुड़े हुए जोड़े। कोई स्टैंड ख़रीदने की ज़रूरत नहीं।',
    mr: 'एका लीगल शीटवर दोन जोडलेल्या जोड्या. स्टँड विकत घेण्याची गरज नाही.',
  },
  'kit.sheets.pair.finish': {
    en: 'Cut on the dashed outline. Then score and fold the dotted line, printed side out, for a standing tent. Or cut the dotted line for two stand cards.',
    hi: 'डैश वाली लाइन पर काटें। फिर डॉट वाली लाइन पर हल्का दबाकर मोड़ें, छपा हुआ हिस्सा बाहर रखें — इससे खड़ा टेंट बनता है। या डॉट वाली लाइन पर काट दें, तो दो स्टैंड कार्ड बनते हैं।',
    mr: 'डॅश असलेल्या रेषेवर कापा. मग डॉट असलेल्या रेषेवर हलकं दाबून घडी घाला, छापलेली बाजू बाहेर ठेवा — त्यातून उभा टेंट तयार होतो. किंवा डॉट असलेली रेषा कापा, म्हणजे दोन स्टँड कार्ड मिळतात.',
  },
  'kit.sheets.pair.spec': {
    en: 'Legal 8.5 × 14 in at 100% · each face 101.6 × 152.4 mm · 250–300 gsm matte card',
    hi: 'लीगल 8.5 × 14 इंच, 100% पर · हर तरफ़ 101.6 × 152.4 mm · 250–300 gsm मैट कार्ड',
    mr: 'लीगल 8.5 × 14 इंच, 100% वर · प्रत्येक बाजू 101.6 × 152.4 mm · 250–300 gsm मॅट कार्ड',
  },

  // -------------------------------------------------------------------------
  // What the downloaded file actually carries
  // -------------------------------------------------------------------------
  'kit.file.eyebrow': {
    en: 'What you get',
    hi: 'आपको क्या मिलेगा',
    mr: 'तुम्हाला काय मिळेल',
  },
  'kit.file.body': {
    en: 'The pictures above show the layout, not your own card. The file you download has your business name on it, and its QR opens your feedback page. To check the QR, scan a printed card, not the picture on this page.',
    hi: 'ऊपर की तस्वीरें सिर्फ़ लेआउट दिखाती हैं, आपका अपना कार्ड नहीं। आप जो फ़ाइल डाउनलोड करेंगे उस पर आपके बिज़नेस का नाम होगा, और उसका QR आपका फ़ीडबैक पेज खोलता है। QR जाँचना हो तो छपा हुआ कार्ड स्कैन करें, इस पेज की तस्वीर नहीं।',
    mr: 'वरची चित्रं फक्त लेआउट दाखवतात, तुमचं स्वतःचं कार्ड नाही. तुम्ही जी फाइल डाउनलोड कराल तिच्यावर तुमच्या व्यवसायाचं नाव असेल, आणि तिचा QR तुमचं फीडबॅक पेज उघडतो. QR तपासायचा असेल तर छापलेलं कार्ड स्कॅन करा, या पेजवरचं चित्र नाही.',
  },
  'kit.file.qrTarget': {
    en: 'Where the QR takes customers',
    hi: 'QR ग्राहकों को कहाँ ले जाता है',
    mr: 'QR ग्राहकांना कुठे नेतो',
  },
  'kit.file.copyLink': {
    en: 'Copy link',
    hi: 'लिंक कॉपी करें',
    mr: 'लिंक कॉपी करा',
  },
  'kit.file.copied': {
    en: 'Copied',
    hi: 'कॉपी हो गया',
    mr: 'कॉपी झाली',
  },

  // -------------------------------------------------------------------------
  // Where the card goes, and what the team says
  // -------------------------------------------------------------------------
  'kit.placement.eyebrow': {
    en: 'Where to put it',
    hi: 'इसे कहाँ रखें',
    mr: 'हे कुठे ठेवायचं',
  },
  'kit.placement.everyone': {
    en: 'Offer the card to every customer, the same way, whatever kind of visit they had. Honest answers are what you want.',
    hi: 'कार्ड हर ग्राहक को एक ही तरीक़े से दें, चाहे उनका अनुभव कैसा भी रहा हो। आपको सच्चे जवाब चाहिए।',
    mr: 'कार्ड प्रत्येक ग्राहकाला एकाच पद्धतीने द्या, त्यांचा अनुभव कसाही असो. तुम्हाला खरी उत्तरं हवी आहेत.',
  },
  'kit.staff.summary': {
    en: 'Guidance for your team',
    hi: 'आपकी टीम के लिए गाइड',
    mr: 'तुमच्या टीमसाठी मार्गदर्शन',
  },
  'kit.staff.when': {
    en: 'When to mention it',
    hi: 'कब बताना है',
    mr: 'कधी सांगायचं',
  },
  'kit.staff.say': {
    en: 'What to say',
    hi: 'क्या कहना है',
    mr: 'काय म्हणायचं',
  },
  'kit.staff.never': {
    en: 'What never to do',
    hi: 'क्या कभी नहीं करना है',
    mr: 'काय कधीच करायचं नाही',
  },

  // -------------------------------------------------------------------------
  // Nothing to print yet
  // -------------------------------------------------------------------------
  'kit.empty.noAddress': {
    en: 'Your feedback page does not have a web address yet, so there is no card to print. Headway is setting it up.',
    hi: 'आपके फ़ीडबैक पेज का वेब पता अभी नहीं बना है, इसलिए अभी प्रिंट करने के लिए कोई कार्ड नहीं है। Headway इसे तैयार कर रहा है।',
    mr: 'तुमच्या फीडबॅक पेजचा वेब पत्ता अजून तयार नाही, त्यामुळे आत्ता प्रिंट करण्यासाठी कार्ड नाही. Headway ते तयार करत आहे.',
  },

  // -------------------------------------------------------------------------
  // The kit forms
  //
  // These render in the operator console, outside the workspace shell, so an
  // operator sees the English fallback. They are written in all three anyway:
  // the form is one import away from a screen an owner reads, and a phrase
  // that exists only in English is the phrase that gets missed when it moves.
  // -------------------------------------------------------------------------
  'kit.form.reviewLink.label': {
    en: 'Public review link',
    hi: 'पब्लिक रिव्यू लिंक',
    mr: 'पब्लिक रिव्ह्यू लिंक',
  },
  'kit.form.reviewLink.hint': {
    en: 'You paste this in yourself. Headway never looks it up.',
    hi: 'यह लिंक आप ख़ुद पेस्ट करते हैं। Headway इसे कभी ख़ुद नहीं ढूँढता।',
    mr: 'ही लिंक तुम्ही स्वतः पेस्ट करता. Headway ती कधीच स्वतः शोधत नाही.',
  },
  'kit.form.saveLink': {
    en: 'Save link',
    hi: 'लिंक सेव करें',
    mr: 'लिंक सेव्ह करा',
  },
  'kit.form.saving': {
    en: 'Saving…',
    hi: 'सेव हो रहा है…',
    mr: 'सेव्ह होत आहे…',
  },
  'kit.form.customise': {
    en: 'Change the wording and colours',
    hi: 'लिखावट और रंग बदलें',
    mr: 'मजकूर आणि रंग बदला',
  },
  'kit.form.defaults': {
    en: 'Leave a field blank to use the usual {type} wording. Headway changes a line only when you type one yourself.',
    hi: 'किसी फ़ील्ड को ख़ाली छोड़ दें तो {type} की सामान्य लिखावट लगेगी। Headway कोई लाइन तभी बदलता है जब आप ख़ुद कुछ लिखते हैं।',
    mr: 'एखादं फील्ड रिकामं ठेवलं तर {type} चा नेहमीचा मजकूर वापरला जातो. तुम्ही स्वतः काही लिहिलं तरच Headway ती ओळ बदलतो.',
  },
  'kit.form.saveChanges': {
    en: 'Save changes',
    hi: 'बदलाव सेव करें',
    mr: 'बदल सेव्ह करा',
  },
  'kit.form.close': {
    en: 'Close',
    hi: 'बंद करें',
    mr: 'बंद करा',
  },
  'kit.form.displayName.label': {
    en: 'Name on the card',
    hi: 'कार्ड पर नाम',
    mr: 'कार्डवरचं नाव',
  },
  'kit.form.displayName.placeholder': {
    en: 'Leave blank to use the business name',
    hi: 'ख़ाली छोड़ें तो बिज़नेस का नाम लगेगा',
    mr: 'रिकामं ठेवलं तर व्यवसायाचं नाव लागेल',
  },
  'kit.form.blankDefault': {
    en: 'Leave blank to use the standard line',
    hi: 'ख़ाली छोड़ें तो सामान्य लाइन लगेगी',
    mr: 'रिकामं ठेवलं तर नेहमीची ओळ लागेल',
  },
  'kit.form.footerNote.label': {
    en: 'Footer line',
    hi: 'नीचे की लाइन',
    mr: 'खालची ओळ',
  },
  'kit.form.headline.label': {
    en: 'Headline',
    hi: 'मुख्य लाइन',
    mr: 'मुख्य ओळ',
  },
  'kit.form.subhead.label': {
    en: 'Second line',
    hi: 'दूसरी लाइन',
    mr: 'दुसरी ओळ',
  },
  'kit.form.brandPrimary.label': {
    en: 'Brand colour',
    hi: 'ब्रांड का रंग',
    mr: 'ब्रँडचा रंग',
  },
  'kit.form.brandSecondary.label': {
    en: 'Second colour',
    hi: 'दूसरा रंग',
    mr: 'दुसरा रंग',
  },
  'kit.form.installed.mark': {
    en: 'Mark the card as placed',
    hi: 'कार्ड लग गया है — दर्ज करें',
    mr: 'कार्ड लावलं आहे — नोंदवा',
  },
  'kit.form.installed.unmark': {
    en: 'Mark the card as not placed',
    hi: 'कार्ड लगा नहीं है — दर्ज करें',
    mr: 'कार्ड लावलेलं नाही — नोंदवा',
  },
} satisfies Namespace;
