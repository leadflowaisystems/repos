import type { Namespace } from '../t';

/**
 * Before-and-after explanations for a change the owner made (src/lib/improve/*)
 *
 * GENERATED SENTENCES. These are written by pure builder functions that are
 * handed a translator, never a locale — so a phrase here may be assembled from
 * placeholders the builder fills, and the placeholders must be identical in all
 * three languages. Word order is not: Hindi and Marathi put a total before its
 * count, which is exactly why these are whole sentences and not fragments.
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed.
 *
 * THE CAVEAT IS THE POINT OF THIS FILE. `improve.limit.noCause` is the
 * strongest thing Headway says about its own limits, and it is the sentence an
 * owner is most likely to skim past into a conclusion the evidence does not
 * carry. Its three parts — this compares two piles of feedback; it CANNOT show
 * the change caused the difference; nothing Headway can see would prove that —
 * survive in all three languages, at full strength. A Hindi or Marathi owner
 * who read a softer version of it would have been told something untrue.
 *
 * The four result labels this module needs (`Mentioned less often after the
 * change` and its siblings) already live in `common.outcome.*`, so the
 * measurement engine reads them from there rather than defining a second copy
 * that could drift from the one the cards show.
 */
export const improve = {
  // -------------------------------------------------------------------------
  // A piece of evidence, in the house format (src/lib/improve/model.ts)
  //
  // "9 of 50 feedback entries (18%)". Never a bare count: a count without its
  // denominator is the one mistake this whole module exists to avoid, and that
  // holds in every language. The plural turns on the TOTAL, not the count, so
  // "1 of 1" reads right — Hindi and Marathi do not inflect फ़ीडबैक / फीडबॅक
  // here, so both forms are the same phrase and the number carries the plural.
  // -------------------------------------------------------------------------
  'improve.evidence.none': {
    en: 'No feedback read for this period',
    hi: 'इस अवधि के लिए कोई फ़ीडबैक नहीं पढ़ा गया',
    mr: 'या कालावधीसाठी कोणताही फीडबॅक वाचला गेला नाही',
  },
  'improve.evidence.line.one': {
    en: '{count} of {total} feedback entry ({share})',
    hi: '{total} में से {count} फ़ीडबैक ({share})',
    mr: '{total} पैकी {count} फीडबॅक ({share})',
  },
  'improve.evidence.line.other': {
    en: '{count} of {total} feedback entries ({share})',
    hi: '{total} में से {count} फ़ीडबैक ({share})',
    mr: '{total} पैकी {count} फीडबॅक ({share})',
  },

  // -------------------------------------------------------------------------
  // The two windows being compared (src/lib/improve/measure.ts)
  //
  // Fragments that label a card, so they carry no full stop in any language.
  // The date arrives already formatted and is never rewritten.
  // -------------------------------------------------------------------------
  'improve.side.before': {
    en: 'everything read up to {date}, when the change was agreed',
    hi: '{date} तक पढ़ा गया सब कुछ, जब यह बदलाव तय हुआ था',
    mr: '{date} पर्यंत वाचलेलं सर्व काही, जेव्हा हा बदल ठरला होता',
  },
  'improve.side.after': {
    en: 'feedback that has come in since the change on {date}',
    hi: '{date} को हुए बदलाव के बाद से आया फ़ीडबैक',
    mr: '{date} रोजी झालेल्या बदलानंतर आलेला फीडबॅक',
  },

  // -------------------------------------------------------------------------
  // What the comparison cannot tell anyone
  //
  // Never softened. "It cannot show that the change caused the difference" is
  // not a hedge to be smoothed into "it is hard to say" — it is the finding.
  // -------------------------------------------------------------------------
  'improve.limit.noCause': {
    en: 'This compares feedback from before the change with feedback from after it. It cannot show that the change caused the difference. Nothing Headway can see would prove that.',
    hi: 'यह बदलाव से पहले के फ़ीडबैक की तुलना बदलाव के बाद के फ़ीडबैक से करता है। यह नहीं दिखा सकता कि यह फ़र्क़ बदलाव की वजह से आया। Headway को जो कुछ दिख सकता है, उसमें से कोई भी बात इसे साबित नहीं कर सकती।',
    mr: 'हे बदलाच्या आधीच्या फीडबॅकची तुलना बदलानंतरच्या फीडबॅकशी करतं. हा फरक बदलामुळे झाला, हे यातून दिसू शकत नाही. Headway ला जे काही दिसू शकतं, त्यातलं काहीही हे सिद्ध करू शकत नाही.',
  },
  'improve.limit.between.one': {
    en: '{count} feedback entry came in between the decision and the change being made. It is in neither number.',
    hi: 'फ़ैसले और बदलाव होने के बीच {count} फ़ीडबैक आया। वह दोनों में से किसी भी आँकड़े में नहीं है।',
    mr: 'निर्णय आणि बदल होण्याच्या दरम्यान {count} फीडबॅक आला. तो दोन्हींपैकी कोणत्याच आकड्यात नाही.',
  },
  'improve.limit.between.other': {
    en: '{count} feedback entries came in between the decision and the change being made. They are in neither number.',
    hi: 'फ़ैसले और बदलाव होने के बीच {count} फ़ीडबैक आए। वे दोनों में से किसी भी आँकड़े में नहीं हैं।',
    mr: 'निर्णय आणि बदल होण्याच्या दरम्यान {count} फीडबॅक आले. ते दोन्हींपैकी कोणत्याच आकड्यात नाहीत.',
  },
  'improve.limit.addMore': {
    en: 'Add the feedback you have collected since the change and measure again.',
    hi: 'बदलाव के बाद आपने जो फ़ीडबैक इकट्ठा किया है उसे जोड़ें और दोबारा मापें।',
    mr: 'बदलानंतर तुम्ही गोळा केलेला फीडबॅक जोडा आणि पुन्हा मोजा.',
  },

  // -------------------------------------------------------------------------
  // Not enough feedback on one side or the other
  //
  // Every evidence qualifier survives: "only", "too little feedback", "maybe
  // nobody has mentioned it yet". The floor Headway needs is a number that
  // arrives as {min} and is never rounded, moved or dropped.
  // -------------------------------------------------------------------------
  'improve.why.thinBefore.one': {
    en: 'Only {count} feedback entry had been read before the change. Headway needs {min} before it will give a percentage.',
    hi: 'बदलाव से पहले सिर्फ़ {count} फ़ीडबैक पढ़ा गया था। प्रतिशत बताने के लिए Headway को {min} चाहिए।',
    mr: 'बदलाच्या आधी फक्त {count} फीडबॅक वाचला गेला होता. टक्केवारी सांगण्यासाठी Headway ला {min} लागतात.',
  },
  'improve.why.thinBefore.other': {
    en: 'Only {count} feedback entries had been read before the change. Headway needs {min} before it will give a percentage.',
    hi: 'बदलाव से पहले सिर्फ़ {count} फ़ीडबैक पढ़े गए थे। प्रतिशत बताने के लिए Headway को {min} चाहिए।',
    mr: 'बदलाच्या आधी फक्त {count} फीडबॅक वाचले गेले होते. टक्केवारी सांगण्यासाठी Headway ला {min} लागतात.',
  },
  'improve.why.noneAfter': {
    en: 'No new feedback has been read since the change was made.',
    hi: 'बदलाव होने के बाद से कोई नया फ़ीडबैक नहीं पढ़ा गया है।',
    mr: 'बदल झाल्यापासून कोणताही नवा फीडबॅक वाचला गेलेला नाही.',
  },
  'improve.why.thinAfter.one': {
    en: 'Only {count} feedback entry has come in since the change. Headway needs {min} to compare.',
    hi: 'बदलाव के बाद से सिर्फ़ {count} फ़ीडबैक आया है। तुलना करने के लिए Headway को {min} चाहिए।',
    mr: 'बदलानंतर फक्त {count} फीडबॅक आला आहे. तुलना करण्यासाठी Headway ला {min} लागतात.',
  },
  'improve.why.thinAfter.other': {
    en: 'Only {count} feedback entries have come in since the change. Headway needs {min} to compare.',
    hi: 'बदलाव के बाद से सिर्फ़ {count} फ़ीडबैक आए हैं। तुलना करने के लिए Headway को {min} चाहिए।',
    mr: 'बदलानंतर फक्त {count} फीडबॅक आले आहेत. तुलना करण्यासाठी Headway ला {min} लागतात.',
  },

  // The flattering case, refused in every language: the theme is absent from a
  // handful of new feedback. Absence in a small sample is silence, not
  // improvement, and "maybe nobody has mentioned it yet" is what says so.
  'improve.why.absentInSmallSample': {
    en: '{theme} has not come up in those {total}. That is too little feedback to say customers mention it less. Maybe nobody has mentioned it yet.',
    hi: 'उन {total} में {theme} का ज़िक्र नहीं आया। यह कहने के लिए कि ग्राहक इसका ज़िक्र कम करते हैं, इतना फ़ीडबैक बहुत कम है। हो सकता है अभी तक किसी ने इसका ज़िक्र ही न किया हो।',
    mr: 'त्या {total} मध्ये {theme} चा उल्लेख आलेला नाही. ग्राहक याचा उल्लेख कमी करतात असं म्हणण्यासाठी एवढा फीडबॅक फार कमी आहे. कदाचित अजून कोणीच याचा उल्लेख केला नसेल.',
  },

  // -------------------------------------------------------------------------
  // The reasons, with the numbers in them
  //
  // {beforeLine} and {afterLine} arrive already built by `evidenceLine`, so the
  // before figure stays one intact string — the operator panel hides a reason
  // line that repeats the Before card, and it can only do that if the line is
  // not chopped into pieces by a translation.
  // -------------------------------------------------------------------------
  'improve.why.comparison': {
    en: 'Before the change, customers mentioned {theme} in {beforeLine}. That is everything read up to {date}. Since the change on {doneDate}, they have mentioned it in {afterLine}.',
    hi: 'बदलाव से पहले, ग्राहकों ने {beforeLine} में {theme} का ज़िक्र किया। यह {date} तक पढ़ा गया सब कुछ है। {doneDate} को हुए बदलाव के बाद से, उन्होंने {afterLine} में इसका ज़िक्र किया है।',
    mr: 'बदलाच्या आधी, ग्राहकांनी {beforeLine} मध्ये {theme} चा उल्लेख केला. हे {date} पर्यंत वाचलेलं सर्व काही आहे. {doneDate} रोजी झालेल्या बदलानंतर, त्यांनी {afterLine} मध्ये याचा उल्लेख केला आहे.',
  },
  'improve.why.moved': {
    en: 'The share of feedback mentioning it moved by {delta}. Headway needs a move of {min} before it will say it went up or down.',
    hi: 'इसका ज़िक्र करने वाले फ़ीडबैक के हिस्से में {delta} का बदलाव आया। ऊपर गया या नीचे, यह कहने से पहले Headway को {min} का बदलाव चाहिए।',
    mr: 'याचा उल्लेख करणाऱ्या फीडबॅकचा हिस्सा {delta} ने बदलला. वर गेलं की खाली, हे सांगण्याआधी Headway ला {min} चा बदल लागतो.',
  },
  'improve.why.notMoved': {
    en: 'The share of feedback mentioning it moved by {delta}. That is under the {min} Headway needs before it will say it went up or down.',
    hi: 'इसका ज़िक्र करने वाले फ़ीडबैक के हिस्से में {delta} का बदलाव आया। ऊपर गया या नीचे यह कहने से पहले Headway को जो {min} चाहिए, यह उससे कम है।',
    mr: 'याचा उल्लेख करणाऱ्या फीडबॅकचा हिस्सा {delta} ने बदलला. वर गेलं की खाली हे सांगण्याआधी Headway ला जे {min} लागतात, त्याहून हे कमी आहे.',
  },

  // -------------------------------------------------------------------------
  // The headline an owner reads
  //
  // "since the change" states the order of events and nothing else. Not one of
  // these says the change did it — the direction is a separate key per case
  // rather than a "more"/"less" word dropped into a sentence, because a word
  // swapped into a Hindi or Marathi frame lands in the wrong place and reads
  // as a verdict rather than a count.
  // -------------------------------------------------------------------------
  'improve.headline.insufficient': {
    en: 'Not enough feedback yet to say whether {theme} changed.',
    hi: '{theme} में बदलाव आया या नहीं, यह कहने के लिए अभी ज़रूरत जितना फ़ीडबैक नहीं है।',
    mr: '{theme} मध्ये बदल झाला की नाही, हे सांगण्यासाठी अजून पुरेसा फीडबॅक नाही.',
  },
  'improve.headline.noClearChange': {
    en: 'Customers mention {theme} about as often as before the change.',
    hi: 'ग्राहक {theme} का ज़िक्र लगभग उतनी ही बार करते हैं जितनी बदलाव से पहले करते थे।',
    mr: 'ग्राहक {theme} चा उल्लेख बदलाच्या आधी जितक्या वेळा करत होते, साधारण तितक्याच वेळा करतात.',
  },
  'improve.headline.issue.more': {
    en: 'Customers mention {theme} more often since the change.',
    hi: 'बदलाव के बाद से ग्राहक {theme} का ज़िक्र ज़्यादा बार करते हैं।',
    mr: 'बदलानंतर ग्राहक {theme} चा उल्लेख जास्त वेळा करतात.',
  },
  'improve.headline.issue.less': {
    en: 'Customers mention {theme} less often since the change.',
    hi: 'बदलाव के बाद से ग्राहक {theme} का ज़िक्र कम बार करते हैं।',
    mr: 'बदलानंतर ग्राहक {theme} चा उल्लेख कमी वेळा करतात.',
  },
  'improve.headline.praise.more': {
    en: 'Customers praise {theme} more often since the change.',
    hi: 'बदलाव के बाद से ग्राहक {theme} की तारीफ़ ज़्यादा बार करते हैं।',
    mr: 'बदलानंतर ग्राहक {theme} चं कौतुक जास्त वेळा करतात.',
  },
  'improve.headline.praise.less': {
    en: 'Customers praise {theme} less often since the change.',
    hi: 'बदलाव के बाद से ग्राहक {theme} की तारीफ़ कम बार करते हैं।',
    mr: 'बदलानंतर ग्राहक {theme} चं कौतुक कमी वेळा करतात.',
  },
} satisfies Namespace;
