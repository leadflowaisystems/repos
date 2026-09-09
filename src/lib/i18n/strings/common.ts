import type { Namespace } from '../t';

/**
 * Shared chrome: buttons, generic labels, empty states, words used on more than one page
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 */
export const common = {
  // ===========================================================================
  // FORMS (`common.form.*`)
  //
  // Every word an owner reads on a form: labels, hints, buttons, the sentence
  // that appears after they press one. They live in `common` because the same
  // form is reached from more than one screen — the contact fields sit on
  // Account and again behind "Ask to continue" — and a phrase defined twice is
  // a phrase that will one day disagree with itself.
  //
  // A SENTENCE IS ONE KEY. Where the old markup built a line out of fragments,
  // the whole line is a single phrase here, because Hindi and Marathi do not
  // put the pieces in English's order and a stitched sentence cannot survive
  // the move.
  // ===========================================================================

  // --- words that appear on more than one form ------------------------------
  'common.form.email': {
    en: 'Email',
    hi: 'ईमेल',
    mr: 'ईमेल',
  },
  'common.form.password': {
    en: 'Password',
    hi: 'पासवर्ड',
    mr: 'पासवर्ड',
  },
  'common.form.yourName': {
    en: 'Your name',
    hi: 'आपका नाम',
    mr: 'तुमचं नाव',
  },
  'common.form.required': {
    en: '(required)',
    hi: '(ज़रूरी)',
    mr: '(आवश्यक)',
  },
  'common.form.optional': {
    en: '(optional)',
    hi: '(ज़रूरी नहीं)',
    mr: '(गरजेचं नाही)',
  },
  'common.form.save': {
    en: 'Save',
    hi: 'सेव करें',
    mr: 'सेव्ह करा',
  },
  'common.form.saving': {
    en: 'Saving…',
    hi: 'सेव हो रहा है…',
    mr: 'सेव्ह होत आहे…',
  },
  'common.form.sending': {
    en: 'Sending…',
    hi: 'भेजा जा रहा है…',
    mr: 'पाठवत आहे…',
  },

  // --- asking to continue with Headway --------------------------------------
  //
  // The button asks. It does not buy, and it does not lengthen a trial, so
  // every phrase here says plainly that nothing moves until a person has
  // spoken to the owner.
  'common.form.continue.ask': {
    en: 'Ask to continue',
    hi: 'आगे जारी रखने के लिए कहें',
    mr: 'पुढे सुरू ठेवण्यासाठी सांगा',
  },
  'common.form.continue.help': {
    en: 'We will use this to contact you about continuing your Headway service.',
    hi: 'Headway सेवा आगे जारी रखने के बारे में बात करने के लिए हम इसी का इस्तेमाल करेंगे।',
    mr: 'Headway सेवा पुढे सुरू ठेवण्याबद्दल बोलण्यासाठी आम्ही याचाच वापर करू.',
  },
  'common.form.continue.phone': {
    en: 'Phone number',
    hi: 'फ़ोन नंबर',
    mr: 'फोन नंबर',
  },
  'common.form.continue.submit': {
    en: 'Send my request',
    hi: 'मेरी रिक्वेस्ट भेजें',
    mr: 'माझी विनंती पाठवा',
  },
  'common.form.continue.noCharge': {
    en: 'Nothing is charged automatically. Your access does not change until we have spoken.',
    hi: 'अपने आप कोई पैसा नहीं कटेगा। जब तक हमारी बात नहीं होती, आपका ऐक्सेस वैसा ही रहेगा।',
    mr: 'आपोआप कोणतेही पैसे कापले जाणार नाहीत. आपलं बोलणं होईपर्यंत तुमचा ॲक्सेस तसाच राहील.',
  },
  'common.form.continue.received': {
    en: 'Request received',
    hi: 'आपकी रिक्वेस्ट मिल गई है',
    mr: 'तुमची विनंती मिळाली आहे',
  },
  'common.form.continue.receivedBody': {
    en: 'Thank you. We will contact you soon on the number you gave. Nothing is charged automatically. Your access does not change until we have spoken.',
    hi: 'धन्यवाद। आपने जो नंबर दिया है, उसी पर हम जल्दी आपसे बात करेंगे। अपने आप कोई पैसा नहीं कटेगा। जब तक हमारी बात नहीं होती, आपका ऐक्सेस वैसा ही रहेगा।',
    mr: 'धन्यवाद. तुम्ही दिलेल्या नंबरवर आम्ही लवकरच तुमच्याशी बोलू. आपोआप कोणतेही पैसे कापले जाणार नाहीत. आपलं बोलणं होईपर्यंत तुमचा ॲक्सेस तसाच राहील.',
  },

  // --- the details Headway reaches an owner on ------------------------------
  'common.form.contact.update': {
    en: 'Update my details',
    hi: 'मेरी जानकारी बदलें',
    mr: 'माझी माहिती बदला',
  },
  'common.form.contact.continueHelp': {
    en: 'Confirm how we can reach you. We will send the payment details and the payment QR straight to you.',
    hi: 'हम आप तक कैसे पहुँचें, यह पक्का कर दें। पेमेंट की जानकारी और पेमेंट QR हम सीधे आपको भेजेंगे।',
    mr: 'आम्ही तुमच्यापर्यंत कसं पोहोचायचं ते नक्की करा. पेमेंटची माहिती आणि पेमेंट QR आम्ही थेट तुम्हाला पाठवू.',
  },
  'common.form.contact.updateHelp': {
    en: 'Headway uses these details to reach you about your account.',
    hi: 'आपके अकाउंट के बारे में आप तक पहुँचने के लिए Headway इन्हीं जानकारियों का इस्तेमाल करता है।',
    mr: 'तुमच्या अकाउंटबद्दल तुमच्यापर्यंत पोहोचण्यासाठी Headway याच माहितीचा वापर करतं.',
  },
  'common.form.contact.phone': {
    en: 'WhatsApp or mobile number',
    hi: 'व्हाट्सऐप या मोबाइल नंबर',
    mr: 'व्हॉट्सॲप किंवा मोबाइल नंबर',
  },
  'common.form.contact.send': {
    en: 'Send my details',
    hi: 'मेरी जानकारी भेजें',
    mr: 'माझी माहिती पाठवा',
  },

  // --- signing in, signing up, resetting a password -------------------------
  'common.form.auth.passwordHint': {
    en: 'At least 8 characters',
    hi: 'कम से कम 8 अक्षर',
    mr: 'कमीत कमी 8 अक्षरं',
  },
  'common.form.auth.creating': {
    en: 'Creating…',
    hi: 'बनाया जा रहा है…',
    mr: 'तयार करत आहे…',
  },
  'common.form.auth.createAccount': {
    en: 'Create account',
    hi: 'अकाउंट बनाएँ',
    mr: 'अकाउंट तयार करा',
  },
  'common.form.auth.signingIn': {
    en: 'Signing in…',
    hi: 'साइन इन हो रहा है…',
    mr: 'साइन इन होत आहे…',
  },
  'common.form.auth.signIn': {
    en: 'Sign in',
    hi: 'साइन इन करें',
    mr: 'साइन इन करा',
  },
  'common.form.auth.sendResetLink': {
    en: 'Send reset link',
    hi: 'रीसेट लिंक भेजें',
    mr: 'रीसेट लिंक पाठवा',
  },
  'common.form.auth.newPassword': {
    en: 'New password',
    hi: 'नया पासवर्ड',
    mr: 'नवीन पासवर्ड',
  },
  'common.form.auth.setPassword': {
    en: 'Set password',
    hi: 'पासवर्ड सेट करें',
    mr: 'पासवर्ड सेट करा',
  },

  // --- setting the business up ----------------------------------------------
  'common.form.setup.businessName': {
    en: 'Business name',
    hi: 'बिज़नेस का नाम',
    mr: 'व्यवसायाचं नाव',
  },
  'common.form.setup.businessNameHint': {
    en: 'The name customers know you by',
    hi: 'जिस नाम से ग्राहक आपको जानते हैं',
    mr: 'ज्या नावाने ग्राहक तुम्हाला ओळखतात',
  },
  'common.form.setup.kind': {
    en: 'What kind of business is it?',
    hi: 'यह किस तरह का बिज़नेस है?',
    mr: 'हा कोणत्या प्रकारचा व्यवसाय आहे?',
  },
  'common.form.setup.chooseOne': {
    en: 'Choose one',
    hi: 'एक चुनें',
    mr: 'एक निवडा',
  },
  'common.form.setup.kindHint': {
    en: 'This decides what your customers are asked about. Choose carefully.',
    hi: 'इससे तय होता है कि आपके ग्राहकों से क्या पूछा जाएगा। ध्यान से चुनें।',
    mr: 'यावरून तुमच्या ग्राहकांना काय विचारलं जाईल हे ठरतं. काळजीपूर्वक निवडा.',
  },
  'common.form.setup.area': {
    en: 'Area',
    hi: 'एरिया',
    mr: 'एरिया',
  },
  'common.form.setup.areaHint': {
    en: 'Neighbourhood or city',
    hi: 'मोहल्ला या शहर',
    mr: 'परिसर किंवा शहर',
  },
  'common.form.setup.ownerPhone': {
    en: 'Your phone number',
    hi: 'आपका फ़ोन नंबर',
    mr: 'तुमचा फोन नंबर',
  },
  'common.form.setup.optional': {
    en: 'Optional',
    hi: 'ज़रूरी नहीं',
    mr: 'गरजेचं नाही',
  },
  'common.form.setup.context': {
    en: 'Anything we should keep in mind?',
    hi: 'कुछ और जो हमें ध्यान में रखना चाहिए?',
    mr: 'आणखी काही आम्ही लक्षात ठेवावं असं आहे का?',
  },
  'common.form.setup.contextHint': {
    en: 'One line is enough — what you want to fix, or what matters most right now.',
    hi: 'एक लाइन काफ़ी है — आप क्या ठीक करना चाहते हैं, या अभी सबसे ज़रूरी क्या है।',
    mr: 'एक ओळ पुरेशी आहे — तुम्हाला काय दुरुस्त करायचं आहे, किंवा आत्ता सगळ्यात महत्त्वाचं काय आहे.',
  },
  'common.form.setup.settingUp': {
    en: 'Setting up…',
    hi: 'सेट किया जा रहा है…',
    mr: 'सेट करत आहे…',
  },
  'common.form.setup.finish': {
    en: 'Finish setup',
    hi: 'सेटअप पूरा करें',
    mr: 'सेटअप पूर्ण करा',
  },

  // ===========================================================================
  // THE PORTAL'S SHARED READING SURFACE
  //
  // The labels, facts and empty states that every report page is built from:
  // the four kinds of statement, a theme's fact line, what happened after a
  // change, one feedback entry shown two ways, and the evidence behind all of
  // it. Defined once here because Home, Customers, Feedback, Improvements and
  // Check-in all draw the same components.
  //
  // WHOLE SENTENCES, NOT FRAGMENTS. "{count} of {total} feedback entries" is
  // one key because Hindi and Marathi put the total first — "{total} में से
  // {count}". A line glued together in English order out of "14", " of ",
  // "110" and " feedback entries" cannot be translated at all, only replaced
  // word by word into something nobody says.
  // ===========================================================================

  // --- the four kinds of statement, kept apart by their labels --------------
  //
  // An owner must never mistake what customers said for Headway's reading of
  // it, or either one for something they told Headway themselves. The label is
  // the guarantee, so it is translated as carefully as the sentence under it.
  'common.layer.fact': {
    en: 'Customers say',
    hi: 'ग्राहक क्या कहते हैं',
    mr: 'ग्राहक काय म्हणतात',
  },
  'common.layer.meaning': {
    en: 'What it means',
    hi: 'इसका मतलब क्या है',
    mr: 'याचा अर्थ काय',
  },
  'common.layer.why': {
    en: 'Why it matters',
    hi: 'यह क्यों ज़रूरी है',
    mr: 'हे का महत्त्वाचं आहे',
  },
  'common.layer.recommend': {
    en: 'Headway recommends',
    hi: 'Headway की सलाह',
    mr: 'Headway ची सूचना',
  },
  'common.layer.owner': {
    en: 'You told us',
    hi: 'आपने हमें बताया',
    mr: 'तुम्ही आम्हाला सांगितलं',
  },
  'common.layer.next': {
    en: 'Next',
    hi: 'आगे क्या करें',
    mr: 'पुढे काय करायचं',
  },

  // --- what state a theme is in ---------------------------------------------
  //
  // One word for one idea: the tag on a theme and the label on a row say the
  // same thing, so they share a key and cannot drift apart.
  'common.state.watching': {
    en: 'Watching',
    hi: 'नज़र रखी जा रही है',
    mr: 'लक्ष ठेवत आहोत',
  },
  'common.tag.first': {
    en: 'Do this first',
    hi: 'यह पहले करें',
    mr: 'हे आधी करा',
  },
  'common.tag.keep': {
    en: 'Keep doing this',
    hi: 'यह करते रहें',
    mr: 'हे करत राहा',
  },
  'common.tag.early': {
    en: 'Waiting for more feedback',
    hi: 'और फ़ीडबैक का इंतज़ार',
    mr: 'अजून फीडबॅकची वाट पाहत आहोत',
  },

  // --- the customer fact, and the way to the words behind it ----------------
  'common.fact.ofTotal': {
    en: '{count} of {total}',
    hi: '{total} में से {count}',
    mr: '{total} पैकी {count}',
  },
  'common.fact.movement': {
    en: '{counts} at your last two check-ins',
    hi: 'आपके पिछले दो चेक-इन में {counts}',
    mr: 'तुमच्या मागच्या दोन चेक-इनमध्ये {counts}',
  },
  'common.evidence.count': {
    en: '{count} of {total} feedback entries',
    hi: '{total} में से {count} फ़ीडबैक',
    mr: '{total} पैकी {count} फीडबॅक',
  },
  'common.evidence.readCommentsAll': {
    en: 'Read the comments',
    hi: 'कमेंट पढ़ें',
    mr: 'कमेंट वाचा',
  },
  'common.evidence.readComments.one': {
    en: 'Read the comment',
    hi: 'कमेंट पढ़ें',
    mr: 'कमेंट वाचा',
  },
  'common.evidence.readComments.other': {
    en: 'Read the {count} comments',
    hi: '{count} कमेंट पढ़ें',
    mr: '{count} कमेंट वाचा',
  },

  // --- what happened after a change -----------------------------------------
  //
  // Every one of these says "after the change" and not one says "because of
  // it". Headway compared two piles of feedback; it did not run an experiment,
  // and no translation may let an owner believe otherwise.
  'common.outcome.improved': {
    en: 'Mentioned less often after the change',
    hi: 'बदलाव के बाद कम बार ज़िक्र हुआ',
    mr: 'बदलानंतर कमी वेळा उल्लेख झाला',
  },
  'common.outcome.worsened': {
    en: 'Mentioned more often after the change',
    hi: 'बदलाव के बाद ज़्यादा बार ज़िक्र हुआ',
    mr: 'बदलानंतर जास्त वेळा उल्लेख झाला',
  },
  'common.outcome.noChange': {
    en: 'No clear difference after the change',
    hi: 'बदलाव के बाद कोई साफ़ फ़र्क़ नहीं दिखा',
    mr: 'बदलानंतर स्पष्ट फरक दिसला नाही',
  },
  'common.outcome.tooEarly': {
    en: 'Not enough feedback after the change',
    hi: 'बदलाव के बाद ज़रूरत जितना फ़ीडबैक नहीं आया',
    mr: 'बदलानंतर पुरेसा फीडबॅक आलेला नाही',
  },
  'common.outcome.awaiting': {
    en: 'Waiting for more feedback · {have} of the {need} needed',
    hi: 'और फ़ीडबैक का इंतज़ार · ज़रूरी {need} में से {have} आए',
    mr: 'अजून फीडबॅकची वाट · लागणाऱ्या {need} पैकी {have} आले',
  },
  'common.outcome.youChanged': {
    en: 'You changed: {decision}',
    hi: 'आपने यह बदला: {decision}',
    mr: 'तुम्ही हे बदललं: {decision}',
  },
  'common.outcome.recorded': {
    en: 'recorded {date}',
    hi: '{date} को दर्ज किया',
    mr: '{date} रोजी नोंदवलं',
  },
  'common.link.afterChange': {
    en: 'See what happened after the change',
    hi: 'बदलाव के बाद क्या हुआ, देखें',
    mr: 'बदलानंतर काय झालं ते पाहा',
  },
  'common.link.seeImprovement': {
    en: 'See the improvement',
    hi: 'सुधार देखें',
    mr: 'सुधारणा पाहा',
  },
  'common.link.needsReply': {
    en: 'Read what needs a reply',
    hi: 'जिनका जवाब देना है, वे पढ़ें',
    mr: 'ज्यांना उत्तर द्यायचं आहे ते वाचा',
  },

  // --- what the owner told Headway, and the one question back ---------------
  'common.knows.note': {
    en: 'Tell your Headway contact if any of this changes.',
    hi: 'इसमें कुछ भी बदले तो अपने Headway कॉन्टैक्ट को बताएँ।',
    mr: 'यात काही बदल झाला तर तुमच्या Headway संपर्काला सांगा.',
  },
  'common.question.note': {
    en: 'Tell your Headway contact which one fits.',
    hi: 'इनमें से कौन सा सही है, अपने Headway कॉन्टैक्ट को बताएँ।',
    mr: 'यांपैकी कोणतं बरोबर आहे ते तुमच्या Headway संपर्काला सांगा.',
  },

  // --- what Headway has read so far -----------------------------------------
  'common.sofar.nothingRead': {
    en: 'Nothing read yet.',
    hi: 'अभी तक कुछ नहीं पढ़ा गया।',
    mr: 'अजून काहीच वाचलेलं नाही.',
  },
  'common.sofar.read.one': {
    en: 'Headway has read {count} feedback entry.',
    hi: 'Headway ने {count} फ़ीडबैक पढ़ा है।',
    mr: 'Headway ने {count} फीडबॅक वाचला आहे.',
  },
  'common.sofar.read.other': {
    en: 'Headway has read {count} feedback entries.',
    hi: 'Headway ने {count} फ़ीडबैक पढ़े हैं।',
    mr: 'Headway ने {count} फीडबॅक वाचले आहेत.',
  },
  'common.sofar.beingRead.one': {
    en: 'Headway is reading {count} more feedback entry now.',
    hi: 'Headway अभी {count} और फ़ीडबैक पढ़ रहा है।',
    mr: 'Headway आत्ता आणखी {count} फीडबॅक वाचत आहे.',
  },
  'common.sofar.beingRead.other': {
    en: 'Headway is reading {count} more feedback entries now.',
    hi: 'Headway अभी {count} और फ़ीडबैक पढ़ रहा है।',
    mr: 'Headway आत्ता आणखी {count} फीडबॅक वाचत आहे.',
  },
  'common.sofar.chip.one': {
    en: '{label}, mentioned {count} time.',
    hi: '{label}, {count} बार ज़िक्र हुआ।',
    mr: '{label}, {count} वेळा उल्लेख झाला.',
  },
  'common.sofar.chip.other': {
    en: '{label}, mentioned {count} times.',
    hi: '{label}, {count} बार ज़िक्र हुआ।',
    mr: '{label}, {count} वेळा उल्लेख झाला.',
  },
  'common.sofar.chipPattern.one': {
    en: '{label}, mentioned {count} time. Mentioned enough times to count as a pattern.',
    hi: '{label}, {count} बार ज़िक्र हुआ। इतनी बार आया कि यह एक पैटर्न है।',
    mr: '{label}, {count} वेळा उल्लेख झाला. इतक्या वेळा आलं की हा एक पॅटर्न आहे.',
  },
  'common.sofar.chipPattern.other': {
    en: '{label}, mentioned {count} times. Mentioned enough times to count as a pattern.',
    hi: '{label}, {count} बार ज़िक्र हुआ। इतनी बार आया कि यह एक पैटर्न है।',
    mr: '{label}, {count} वेळा उल्लेख झाला. इतक्या वेळा आलं की हा एक पॅटर्न आहे.',
  },
  'common.sofar.ratings.one': {
    en: '{count} rating',
    hi: '{count} रेटिंग',
    mr: '{count} रेटिंग',
  },
  'common.sofar.ratings.other': {
    en: '{count} ratings',
    hi: '{count} रेटिंग',
    mr: '{count} रेटिंग',
  },

  // --- one feedback entry, shown two ways -----------------------------------
  //
  // The left column is exactly what the customer tapped and typed. The right
  // column is Headway's reading of it. These labels are what stop an owner
  // reading the second as the first.
  'common.review.gave': {
    en: 'Customer gave',
    hi: 'ग्राहक ने क्या दिया',
    mr: 'ग्राहकाने काय दिलं',
  },
  'common.review.understood': {
    en: 'Headway understood',
    hi: 'Headway ने क्या समझा',
    mr: 'Headway ला काय समजलं',
  },
  'common.review.noRating': {
    en: 'No overall rating',
    hi: 'कुल रेटिंग नहीं दी',
    mr: 'एकूण रेटिंग दिली नाही',
  },
  'common.review.selected': {
    en: 'Selected',
    hi: 'क्या चुना',
    mr: 'काय निवडलं',
  },
  'common.review.written': {
    en: 'Written',
    hi: 'क्या लिखा',
    mr: 'काय लिहिलं',
  },
  'common.review.noWordsTapped': {
    en: 'Nothing written — the ratings above are the whole message.',
    hi: 'कुछ लिखा नहीं — ऊपर की रेटिंग ही पूरी बात है।',
    mr: 'काही लिहिलेलं नाही — वरची रेटिंग हीच पूर्ण गोष्ट आहे.',
  },
  'common.review.ratingOnly': {
    en: 'A rating only — no written comment.',
    hi: 'सिर्फ़ रेटिंग — कुछ लिखा नहीं।',
    mr: 'फक्त रेटिंग — काही लिहिलेलं नाही.',
  },
  'common.review.noTopic': {
    en: 'Nothing here matched a topic Headway tracks.',
    hi: 'Headway जिन विषयों पर नज़र रखता है, उनमें से कोई इसमें नहीं मिला।',
    mr: 'Headway ज्या विषयांवर लक्ष ठेवतं, त्यांपैकी एकही यात आढळला नाही.',
  },
  'common.review.tone': {
    en: '{label} in tone',
    hi: 'लहज़ा: {label}',
    mr: 'सूर: {label}',
  },
  'common.review.sortedAs': {
    en: 'Sorted as',
    hi: 'छाँटा गया:',
    mr: 'वर्गवारी:',
  },
  'common.review.needsAnswerDraft': {
    en: 'Needs your answer · draft ready',
    hi: 'आपके जवाब की ज़रूरत · ड्राफ़्ट तैयार है',
    mr: 'तुमच्या उत्तराची गरज · ड्राफ्ट तयार आहे',
  },
  'common.review.needsAnswerNoDraft': {
    en: 'Needs your answer · no draft',
    hi: 'आपके जवाब की ज़रूरत · कोई ड्राफ़्ट नहीं',
    mr: 'तुमच्या उत्तराची गरज · ड्राफ्ट नाही',
  },
  'common.review.answerOptionalDraft': {
    en: 'Answer optional · draft ready',
    hi: 'जवाब देना ज़रूरी नहीं · ड्राफ़्ट तैयार है',
    mr: 'उत्तर देणं गरजेचं नाही · ड्राफ्ट तयार आहे',
  },
  'common.review.answered': {
    en: 'Answered',
    hi: 'जवाब दे दिया',
    mr: 'उत्तर दिलं आहे',
  },
  'common.review.suggestedReply': {
    en: 'Suggested reply',
    hi: 'सुझाया गया जवाब',
    mr: 'सुचवलेलं उत्तर',
  },
  'common.review.reading': {
    en: 'Headway is reading this now.',
    hi: 'Headway इसे अभी पढ़ रहा है।',
    mr: 'Headway हे आत्ता वाचत आहे.',
  },
  'common.review.failed': {
    en: 'Headway could not read this one yet. It will try again on its own.',
    hi: 'Headway इसे अभी तक पढ़ नहीं पाया। वह अपने आप दोबारा कोशिश करेगा।',
    mr: 'Headway ला हे अजून वाचता आलेलं नाही. ते आपोआप पुन्हा प्रयत्न करेल.',
  },
  'common.review.waiting': {
    en: 'Waiting for Headway to read it — usually within a minute of it arriving.',
    hi: 'Headway के पढ़ने का इंतज़ार — आम तौर पर आने के एक मिनट के अंदर।',
    mr: 'Headway वाचण्याची वाट — सहसा आल्यापासून एका मिनिटात.',
  },

  // --- the five ratings, as one-tap filters ---------------------------------
  'common.rating.label': {
    en: 'By rating',
    hi: 'रेटिंग के हिसाब से',
    mr: 'रेटिंगनुसार',
  },
  'common.rating.all': {
    en: 'All',
    hi: 'सभी',
    mr: 'सर्व',
  },
  'common.rating.filter.one': {
    en: '{stars} star rating, {count} feedback entry',
    hi: '{stars} स्टार रेटिंग, {count} फ़ीडबैक',
    mr: '{stars} स्टार रेटिंग, {count} फीडबॅक',
  },
  'common.rating.filter.other': {
    en: '{stars} star rating, {count} feedback entries',
    hi: '{stars} स्टार रेटिंग, {count} फ़ीडबैक',
    mr: '{stars} स्टार रेटिंग, {count} फीडबॅक',
  },
  'common.stars.aria': {
    en: '{value} out of 5 stars',
    hi: '5 में से {value} स्टार',
    mr: '5 पैकी {value} स्टार',
  },

  // --- the evidence, shown on request ---------------------------------------
  'common.quotes.empty': {
    en: 'Nobody has written about this yet. The star ratings are the whole message.',
    hi: 'इस बारे में अभी किसी ने कुछ लिखा नहीं है। स्टार रेटिंग ही पूरी बात है।',
    mr: 'याबद्दल अजून कोणीही काही लिहिलेलं नाही. स्टार रेटिंग हीच पूर्ण गोष्ट आहे.',
  },
  'common.population.before': {
    en: 'Before',
    hi: 'पहले',
    mr: 'आधी',
  },
  'common.population.after': {
    en: 'After',
    hi: 'बाद में',
    mr: 'नंतर',
  },
  'common.reveal.why': {
    en: 'Why Headway says this',
    hi: 'Headway ऐसा क्यों कहता है',
    mr: 'Headway असं का म्हणतं',
  },
  'common.reveal.howWeGotHere': {
    en: 'How we got here',
    hi: 'यहाँ तक कैसे पहुँचे',
    mr: 'इथवर कसं पोहोचलो',
  },
  'common.limits.title': {
    en: 'What Headway cannot tell you yet',
    hi: 'Headway अभी क्या नहीं बता सकता',
    mr: 'Headway अजून काय सांगू शकत नाही',
  },

  // --- the full stop itself -------------------------------------------------
  //
  // Hindi ends a sentence with the danda, Marathi with a full stop. Every
  // phrase in this file carries its own ending, so this key exists for the one
  // place that cannot: the advice label on a theme comes from the view model,
  // and the component that prints it has to close the sentence itself. A
  // hard-coded "." there would put a Latin full stop at the end of a Hindi
  // sentence on every theme on Home.
  'common.punct.stop': {
    en: '.',
    hi: '।',
    mr: '.',
  },

  // --- who said what, and what happens next ---------------------------------
  'common.source.customers': {
    en: 'Customers',
    hi: 'ग्राहक',
    mr: 'ग्राहक',
  },
  'common.source.you': {
    en: 'You',
    hi: 'आप',
    mr: 'तुम्ही',
  },
  'common.source.headway': {
    en: 'Headway',
    hi: 'Headway',
    mr: 'Headway',
  },
  'common.next.prefix': {
    en: 'Next.',
    hi: 'आगे क्या करें।',
    mr: 'पुढे काय करायचं.',
  },
  'common.watching.why': {
    en: 'Why',
    hi: 'क्यों',
    mr: 'का',
  },
  'common.sinceThen.nextCheck': {
    en: 'Next check.',
    hi: 'अगली जाँच।',
    mr: 'पुढची तपासणी.',
  },
} satisfies Namespace;
