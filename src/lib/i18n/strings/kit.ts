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
  // The door is called "Kit" (M33), so the browser tab is too. The three
  // `kit.intro.*` phrases that used to open this page went with it: the top of
  // the page is now the two things a business can order, and the sentence
  // about where to stand the card still opens the "Where to put it" section
  // below, which is where an owner looks for it.
  'kit.meta.title': {
    en: 'Kit',
    hi: 'किट',
    mr: 'किट',
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
  // M37: the owner does not print anything, so this no longer says "print
  // kit". What is Ready is the card itself — Headway has everything it needs
  // to print one for this business.
  'kit.status.print.label': {
    en: 'your card',
    hi: 'आपका कार्ड',
    mr: 'तुमचं कार्ड',
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
    en: 'Every card Headway prints for you carries your business name, and its QR opens the page below. To check it, scan a printed card.',
    hi: 'Headway आपके लिए जो भी कार्ड छापता है उस पर आपके बिज़नेस का नाम होता है, और उसका QR नीचे वाला पेज खोलता है। जाँचना हो तो छपा हुआ कार्ड स्कैन करें।',
    mr: 'Headway तुमच्यासाठी जे कार्ड छापतं त्यावर तुमच्या व्यवसायाचं नाव असतं, आणि त्याचा QR खालचं पेज उघडतो. तपासायचं असेल तर छापलेलं कार्ड स्कॅन करा.',
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
  'kit.placement.seen': {
    en: 'Put the card where customers can see it. Every scan is a customer telling you how it went.',
    hi: 'कार्ड वहाँ रखें जहाँ ग्राहक उसे देख सकें। हर स्कैन का मतलब है, एक ग्राहक आपको बता रहा है कि कैसा रहा।',
    mr: 'कार्ड तिथे ठेवा जिथे ग्राहकांना ते दिसेल. प्रत्येक स्कॅनचा अर्थ आहे, एक ग्राहक तुम्हाला सांगत आहे की कसं झालं.',
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

  // ---------------------------------------------------------------------------
  // Ordering the printed kit (M33)
  //
  // Two products and one button. The prices live in src/lib/kit/catalogue.ts,
  // never here and never in the browser: these phrases carry a `{price}` hole
  // and the server fills it. Nothing in this block promises a delivery date, a
  // dispatch date or stock, because none of those exist behind it.
  // ---------------------------------------------------------------------------
  'kit.order.eyebrow': { en: 'Kit', hi: 'किट', mr: 'किट' },
  'kit.order.heading': {
    en: 'Your Feedback Kit',
    hi: 'आपकी फ़ीडबैक किट',
    mr: 'तुमची फीडबॅक किट',
  },
  'kit.order.intro': {
    en: 'Choose the format that works best for your business.',
    hi: 'जो तरीक़ा आपके कारोबार के लिए सबसे सही हो, वह चुनें।',
    mr: 'तुमच्या व्यवसायासाठी जो प्रकार सर्वात योग्य आहे तो निवडा.',
  },

  'kit.product.stand.name': {
    en: '4 × 6 in Card + QR Stand',
    hi: '4 × 6 इंच कार्ड + QR स्टैंड',
    mr: '4 × 6 इंच कार्ड + QR स्टँड',
  },
  'kit.product.stand.description': {
    en: 'A personalized 4 × 6 in feedback card with a clear QR stand holder. Ready to place where customers can see it.',
    hi: 'आपके नाम वाला 4 × 6 इंच फ़ीडबैक कार्ड, साथ में साफ़ QR स्टैंड। जहाँ ग्राहक देख सकें, वहाँ रखने के लिए तैयार।',
    mr: 'तुमच्या नावाचं 4 × 6 इंच फीडबॅक कार्ड, सोबत पारदर्शक QR स्टँड. ग्राहकांना दिसेल तिथे ठेवायला तयार.',
  },
  'kit.product.stand.alt': {
    en: 'A Headway feedback card standing in a clear acrylic holder on a cafe table.',
    hi: 'कैफ़े की मेज़ पर साफ़ ऐक्रेलिक स्टैंड में रखा Headway फ़ीडबैक कार्ड।',
    mr: 'कॅफेच्या टेबलावर पारदर्शक अ‍ॅक्रेलिक स्टँडमध्ये ठेवलेलं Headway फीडबॅक कार्ड.',
  },

  'kit.product.tent.name': {
    en: '4 × 6 in Folded Tent Card',
    hi: '4 × 6 इंच फ़ोल्ड टेंट कार्ड',
    mr: '4 × 6 इंच फोल्ड टेंट कार्ड',
  },
  'kit.product.tent.description': {
    en: 'A personalized 4 × 6 in feedback card folded into a standing tent for tables and counters.',
    hi: 'आपके नाम वाला 4 × 6 इंच फ़ीडबैक कार्ड, जो मोड़कर टेबल और काउंटर पर खड़ा हो जाता है।',
    mr: 'तुमच्या नावाचं 4 × 6 इंच फीडबॅक कार्ड, जे दुमडून टेबल आणि काउंटरवर उभं राहतं.',
  },
  'kit.product.tent.alt': {
    en: 'A Headway feedback card folded into a standing tent on a cafe table.',
    hi: 'कैफ़े की मेज़ पर मोड़कर खड़ा किया गया Headway फ़ीडबैक कार्ड।',
    mr: 'कॅफेच्या टेबलावर दुमडून उभं केलेलं Headway फीडबॅक कार्ड.',
  },

  'kit.price.perPiece': {
    en: '₹{price} per piece',
    hi: '₹{price} प्रति नग',
    mr: '₹{price} प्रति नग',
  },
  'kit.amount': { en: '₹{amount}', hi: '₹{amount}', mr: '₹{amount}' },
  'kit.line.quantityPrice': {
    en: '{quantity} × ₹{price}',
    hi: '{quantity} × ₹{price}',
    mr: '{quantity} × ₹{price}',
  },
  'kit.quantity.label': { en: 'Quantity', hi: 'कितने', mr: 'किती' },
  'kit.quantity.less': {
    en: 'One less {product}',
    hi: '{product} एक कम',
    mr: '{product} एक कमी',
  },
  'kit.quantity.more': {
    en: 'One more {product}',
    hi: '{product} एक ज़्यादा',
    mr: '{product} एक जास्त',
  },

  'kit.quantity.add': { en: 'Add to order', hi: 'ऑर्डर में जोड़ें', mr: 'ऑर्डरमध्ये जोडा' },
  'kit.quantity.remove': {
    en: 'Remove {product} from your order',
    hi: '{product} को ऑर्डर से हटाएँ',
    mr: '{product} ऑर्डरमधून काढा',
  },
  'kit.quantity.removed': {
    en: 'Not in your order.',
    hi: 'यह आपके ऑर्डर में नहीं है।',
    mr: 'हे तुमच्या ऑर्डरमध्ये नाही.',
  },
  'kit.summary.title': { en: 'Your order', hi: 'आपका ऑर्डर', mr: 'तुमचा ऑर्डर' },
  'kit.summary.empty': {
    en: 'Choose how many you need and your order will appear here.',
    hi: 'आपको कितने चाहिए वह चुनें, आपका ऑर्डर यहाँ दिखेगा।',
    mr: 'तुम्हाला किती हवेत ते निवडा, तुमचा ऑर्डर इथे दिसेल.',
  },
  'kit.summary.total': { en: 'Total', hi: 'कुल', mr: 'एकूण' },
  'kit.summary.serverNote': {
    en: 'Headway works out the total when you order.',
    hi: 'ऑर्डर करते समय कुल रक़म Headway ख़ुद जोड़ता है।',
    mr: 'ऑर्डर करताना एकूण रक्कम Headway स्वतः मोजतं.',
  },

  'kit.order.cta': { en: 'Order now', hi: 'अभी ऑर्डर करें', mr: 'आता ऑर्डर करा' },
  'kit.order.placing': {
    en: 'Placing your order…',
    hi: 'ऑर्डर हो रहा है…',
    mr: 'ऑर्डर होत आहे…',
  },
  'kit.order.placed.title': { en: 'Order placed', hi: 'ऑर्डर हो गया', mr: 'ऑर्डर झाला' },
  'kit.order.placed.body': {
    en: "Your order has been received. We'll contact you about the next step.",
    hi: 'आपका ऑर्डर मिल गया है। अगले क़दम के बारे में हम आपसे बात करेंगे।',
    mr: 'तुमचा ऑर्डर मिळाला आहे. पुढच्या टप्प्याबद्दल आम्ही तुमच्याशी बोलू.',
  },
  'kit.order.seeOrders': {
    en: 'See your orders',
    hi: 'अपने ऑर्डर देखें',
    mr: 'तुमचे ऑर्डर पाहा',
  },
  'kit.order.error.empty': {
    en: 'Choose at least one card before ordering.',
    hi: 'ऑर्डर करने से पहले कम से कम एक कार्ड चुनें।',
    mr: 'ऑर्डर करण्यापूर्वी किमान एक कार्ड निवडा.',
  },
  'kit.order.error.quantity': {
    en: 'That quantity cannot be ordered. Use the − and + buttons.',
    hi: 'यह संख्या ऑर्डर नहीं की जा सकती। − और + बटन इस्तेमाल करें।',
    mr: 'ही संख्या ऑर्डर करता येत नाही. − आणि + बटणं वापरा.',
  },
  'kit.order.error.failed': {
    en: 'The order could not be placed. Try again in a moment.',
    hi: 'ऑर्डर नहीं हो सका। थोड़ी देर बाद फिर कोशिश करें।',
    mr: 'ऑर्डर होऊ शकला नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.',
  },

  // The reprint route, kept but no longer the point of the page.
  'kit.reprint.title': {
    en: 'Need another copy?',
    hi: 'एक और प्रति चाहिए?',
    mr: 'आणखी एक प्रत हवी?',
  },
  'kit.reprint.body': {
    en: 'Print your personalized card again.',
    hi: 'अपना कार्ड फिर से प्रिंट करें।',
    mr: 'तुमचं कार्ड पुन्हा प्रिंट करा.',
  },

  // ---- Orders ---------------------------------------------------------------
  'kit.orders.meta.title': { en: 'Orders', hi: 'ऑर्डर', mr: 'ऑर्डर' },
  'kit.orders.eyebrow': { en: 'Orders', hi: 'ऑर्डर', mr: 'ऑर्डर' },
  'kit.orders.heading': { en: 'Your orders', hi: 'आपके ऑर्डर', mr: 'तुमचे ऑर्डर' },
  'kit.orders.intro': {
    en: 'Every kit you have ordered, and where it stands.',
    hi: 'आपने जो भी किट ऑर्डर की है, और वह अभी किस हाल में है।',
    mr: 'तुम्ही ऑर्डर केलेली प्रत्येक किट, आणि ती सध्या कुठे आहे.',
  },
  'kit.orders.empty': {
    en: 'You have not ordered a kit yet.',
    hi: 'आपने अभी तक कोई किट ऑर्डर नहीं की है।',
    mr: 'तुम्ही अजून कोणतीही किट ऑर्डर केलेली नाही.',
  },
  'kit.orders.emptyCta': { en: 'Go to your kit', hi: 'अपनी किट देखें', mr: 'तुमची किट पाहा' },
  'kit.orders.number': { en: 'Order #{number}', hi: 'ऑर्डर #{number}', mr: 'ऑर्डर #{number}' },
  'kit.orders.pieces.one': { en: '{count} piece', hi: '{count} नग', mr: '{count} नग' },
  'kit.orders.pieces.other': { en: '{count} pieces', hi: '{count} नग', mr: '{count} नग' },
  // ---- Delivery and receipt (M36) -------------------------------------------
  //
  // Two different facts said by two different people. Headway says it sent the
  // kit; the business says it arrived. Neither sentence claims the other.
  'kit.orders.status.delivered': { en: 'Delivered', hi: 'भेज दिया', mr: 'पाठवला' },
  'kit.orders.sentOn': {
    en: 'Headway sent this on {date}.',
    hi: 'Headway ने यह {date} को भेजा।',
    mr: 'Headway ने हे {date} रोजी पाठवलं.',
  },
  'kit.receipt.cta': { en: 'Order received', hi: 'ऑर्डर मिल गया', mr: 'ऑर्डर मिळाला' },
  'kit.receipt.hint': {
    en: 'Tick this once the cards are actually in your hands.',
    hi: 'जब कार्ड सचमुच आपके हाथ में आ जाएँ, तब यह टिक करें।',
    mr: 'कार्डं खरोखर तुमच्या हातात आल्यावरच हे टिक करा.',
  },
  'kit.receipt.saving': { en: 'Saving…', hi: 'सेव हो रहा है…', mr: 'सेव्ह होत आहे…' },
  'kit.receipt.done': { en: 'Order received', hi: 'ऑर्डर मिल गया', mr: 'ऑर्डर मिळाला' },
  'kit.receipt.doneOn': {
    en: 'Received {date}',
    hi: '{date} को मिला',
    mr: '{date} रोजी मिळाला',
  },
  'kit.receipt.error': {
    en: 'That could not be confirmed. Try again in a moment.',
    hi: 'यह पक्का नहीं हो सका। थोड़ी देर बाद फिर कोशिश करें।',
    mr: 'हे निश्चित होऊ शकलं नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.',
  },
  'kit.orders.status.received': { en: 'Received', hi: 'मिल गया', mr: 'मिळाला' },
} satisfies Namespace;
