import type { Namespace } from '../t';

/**
 * This week
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 *
 * ONE COMPONENT DRAWS BOTH PERIOD PAGES, so this file holds more than the week.
 * `PeriodReportView` renders "This week" and "This month" from the same code.
 * Everything it says that does NOT name a week or a month lives here under
 * `pulse.report.*`, and the month page reads those same keys. Only the
 * sentences that actually say "this week" or "this month" are written twice —
 * once here, once in `review.ts` — and the component picks the pair by period.
 *
 * That split is deliberate. The alternative is one sentence with a "{period}"
 * hole in it, and the hole falls in a different place in Hindi and Marathi than
 * it does in English. A whole sentence per period is the only version that can
 * be translated correctly.
 *
 * "Since you were last here" also lives here, as `pulse.since.*`. It is the
 * panel that reports what happened while the owner was away, and it belongs to
 * the same check-in family as the week and the month.
 *
 * A MENTION IS ONE FEEDBACK ENTRY that names the topic, never one customer.
 * One customer can leave several, so the counting words below say "mentioned
 * {count} times" and never "{count} customers".
 */
export const pulse = {
  // -------------------------------------------------------------------------
  // The week page
  // -------------------------------------------------------------------------
  'pulse.title': {
    en: 'This week',
    hi: 'इस हफ़्ते',
    mr: 'या आठवड्यात',
  },
  'pulse.volume.one': {
    en: '{count} feedback entry this week · {previous} the week before',
    hi: 'इस हफ़्ते {count} फ़ीडबैक · पिछले हफ़्ते {previous}',
    mr: 'या आठवड्यात {count} फीडबॅक · मागच्या आठवड्यात {previous}',
  },
  'pulse.volume.other': {
    en: '{count} feedback entries this week · {previous} the week before',
    hi: 'इस हफ़्ते {count} फ़ीडबैक · पिछले हफ़्ते {previous}',
    mr: 'या आठवड्यात {count} फीडबॅक · मागच्या आठवड्यात {previous}',
  },
  // Thin evidence, not a quiet week — so the bar stays in the sentence. The
  // number is the one the engine uses to decide whether to name a topic.
  'pulse.topics.none': {
    en: 'Nothing came up 3 or more times this week. Once something does, Headway will name it here.',
    hi: 'इस हफ़्ते कोई भी बात 3 या उससे ज़्यादा बार सामने नहीं आई। जब कोई बात इतनी बार आएगी, Headway उसका नाम यहाँ लिखेगा।',
    mr: 'या आठवड्यात कोणतीही गोष्ट 3 किंवा जास्त वेळा समोर आली नाही. जेव्हा एखादी गोष्ट इतक्या वेळा येईल, तेव्हा Headway तिचं नाव इथे लिहील.',
  },
  // On the week page the changes are still running; on the month page they are
  // behind the owner. Two headings, not one heading with a hole in it.
  'pulse.actions.eyebrow': {
    en: 'Changes in progress',
    hi: 'जो बदलाव चल रहे हैं',
    mr: 'सुरू असलेले बदल',
  },

  // -------------------------------------------------------------------------
  // The report both period pages share
  // -------------------------------------------------------------------------
  'pulse.report.eyebrow': {
    en: 'Check-in',
    hi: 'चेक-इन',
    mr: 'चेक-इन',
  },
  'pulse.report.window': {
    en: '{from} – {to}, compared with the {days} days before',
    hi: '{from} – {to}, इससे पहले के {days} दिनों से तुलना',
    mr: '{from} – {to}, याच्या आधीच्या {days} दिवसांशी तुलना',
  },

  // The counting line beside each topic. Three shapes, each a whole sentence:
  // no comparison to make, a comparison that did not move, and one that did.
  // The old "5 → 12 mentions" was an arrow doing the work of a verb, and an
  // arrow cannot be read out loud in any of the three languages.
  'pulse.report.mentions.one': {
    en: 'Mentioned {count} time.',
    hi: '{count} बार ज़िक्र हुआ।',
    mr: '{count} वेळा उल्लेख झाला.',
  },
  'pulse.report.mentions.other': {
    en: 'Mentioned {count} times.',
    hi: '{count} बार ज़िक्र हुआ।',
    mr: '{count} वेळा उल्लेख झाला.',
  },
  'pulse.report.mentions.same.one': {
    en: 'Mentioned {count} time, was {before}. About the same.',
    hi: '{count} बार ज़िक्र हुआ, पहले {before} बार। लगभग वैसा ही।',
    mr: '{count} वेळा उल्लेख झाला, आधी {before} वेळा. साधारण तसंच.',
  },
  'pulse.report.mentions.same.other': {
    en: 'Mentioned {count} times, was {before}. About the same.',
    hi: '{count} बार ज़िक्र हुआ, पहले {before} बार। लगभग वैसा ही।',
    mr: '{count} वेळा उल्लेख झाला, आधी {before} वेळा. साधारण तसंच.',
  },
  'pulse.report.mentions.changed.one': {
    en: 'Mentioned {count} time, was {before}.',
    hi: '{count} बार ज़िक्र हुआ, पहले {before} बार।',
    mr: '{count} वेळा उल्लेख झाला, आधी {before} वेळा.',
  },
  'pulse.report.mentions.changed.other': {
    en: 'Mentioned {count} times, was {before}.',
    hi: '{count} बार ज़िक्र हुआ, पहले {before} बार।',
    mr: '{count} वेळा उल्लेख झाला, आधी {before} वेळा.',
  },

  // Section headings. Each one says what the list under it counts.
  'pulse.report.section.worsened': {
    en: 'Mentioned more often',
    hi: 'ज़्यादा बार ज़िक्र हुआ',
    mr: 'जास्त वेळा उल्लेख झाला',
  },
  'pulse.report.section.improved': {
    en: 'Mentioned less often',
    hi: 'कम बार ज़िक्र हुआ',
    mr: 'कमी वेळा उल्लेख झाला',
  },
  'pulse.report.section.praise': {
    en: 'What customers praised',
    hi: 'ग्राहकों ने किसकी तारीफ़ की',
    mr: 'ग्राहकांनी कशाचं कौतुक केलं',
  },
  'pulse.report.section.unresolved': {
    en: 'Still mentioned',
    hi: 'अब भी ज़िक्र हो रहा है',
    mr: 'अजूनही उल्लेख होत आहे',
  },
  'pulse.report.section.topics': {
    en: 'Topics',
    hi: 'विषय',
    mr: 'विषय',
  },
  'pulse.report.section.focus': {
    en: 'What to look at next',
    hi: 'आगे क्या देखना है',
    mr: 'पुढे काय बघायचं',
  },
  'pulse.report.section.limits': {
    en: 'What Headway cannot tell you yet',
    hi: 'Headway अभी क्या नहीं बता सकता',
    mr: 'Headway अजून काय सांगू शकत नाही',
  },

  // A change the owner made whose result is not measured yet. It says who is
  // doing the checking, so nobody reads it as something they have to do.
  'pulse.report.action.checking': {
    en: 'Headway is checking this now.',
    hi: 'Headway इसे अभी जाँच रहा है।',
    mr: 'Headway हे आता तपासत आहे.',
  },

  // -------------------------------------------------------------------------
  // Since you were last here
  //
  // A fact, never a hook. Every sentence below reports something that actually
  // happened while the owner was away, and there is nothing here that would
  // still be true tomorrow if they did not come back.
  // -------------------------------------------------------------------------
  'pulse.since.arrived.read.one': {
    en: '{count} feedback entry came in. Headway has read it.',
    hi: '{count} फ़ीडबैक आया। Headway ने उसे पढ़ लिया है।',
    mr: '{count} फीडबॅक आला. Headway ने तो वाचला आहे.',
  },
  'pulse.since.arrived.read.other': {
    en: '{count} feedback entries came in. Headway has read them all.',
    hi: '{count} फ़ीडबैक आए। Headway ने सब पढ़ लिए हैं।',
    mr: '{count} फीडबॅक आले. Headway ने ते सर्व वाचले आहेत.',
  },
  'pulse.since.arrived.reading.one': {
    en: '{count} feedback entry came in. Headway is reading it now.',
    hi: '{count} फ़ीडबैक आया। Headway उसे अभी पढ़ रहा है।',
    mr: '{count} फीडबॅक आला. Headway तो आता वाचत आहे.',
  },
  'pulse.since.arrived.reading.other': {
    en: '{count} feedback entries came in. Headway is reading them now.',
    hi: '{count} फ़ीडबैक आए। Headway उन्हें अभी पढ़ रहा है।',
    mr: '{count} फीडबॅक आले. Headway ते आता वाचत आहे.',
  },
  'pulse.since.arrived.partial': {
    en: '{count} feedback entries came in. Headway has read {read} so far and is reading the rest.',
    hi: '{count} फ़ीडबैक आए। Headway ने अब तक {read} पढ़े हैं और बाकी पढ़ रहा है।',
    mr: '{count} फीडबॅक आले. Headway ने आतापर्यंत {read} वाचले आहेत आणि बाकीचे वाचत आहे.',
  },
  'pulse.since.link.feedback': {
    en: 'Read the feedback',
    hi: 'फ़ीडबैक पढ़ें',
    mr: 'फीडबॅक वाचा',
  },

  // One key for the whole sentence, with the name of the change as a hole in
  // it. Hindi and Marathi put that name in a different place than English
  // does, and only the dictionary can know where.
  'pulse.since.measured': {
    en: 'Headway checked {title} against the feedback that came in after it.',
    hi: 'Headway ने {title} की जाँच उसके बाद आए फ़ीडबैक से की।',
    mr: 'Headway ने {title} याची तपासणी नंतर आलेल्या फीडबॅकवरून केली.',
  },

  // THE READING, AND ONLY THE READING. Every one of these puts the count next
  // to the change in time and stops there. None of them says the change caused
  // the difference, because counting mentions before and after cannot show
  // that. "Improved" and "got worse" read as a verdict on the change itself,
  // which is more than the evidence carries, so they are not used.
  'pulse.since.result.improved': {
    en: 'Mentioned less often after the change.',
    hi: 'बदलाव के बाद कम बार ज़िक्र हुआ।',
    mr: 'बदलानंतर कमी वेळा उल्लेख झाला.',
  },
  'pulse.since.result.worsened': {
    en: 'Mentioned more often after the change.',
    hi: 'बदलाव के बाद ज़्यादा बार ज़िक्र हुआ।',
    mr: 'बदलानंतर जास्त वेळा उल्लेख झाला.',
  },
  'pulse.since.result.noChange': {
    en: 'No clear difference after the change.',
    hi: 'बदलाव के बाद कोई साफ़ फ़र्क़ नहीं दिखा।',
    mr: 'बदलानंतर स्पष्ट फरक दिसला नाही.',
  },
  'pulse.since.result.notEnough': {
    en: 'Not enough feedback after the change.',
    hi: 'बदलाव के बाद पर्याप्त फ़ीडबैक नहीं आया।',
    mr: 'बदलानंतर पुरेसा फीडबॅक आला नाही.',
  },
  'pulse.since.result.none': {
    en: 'No result yet.',
    hi: 'अभी कोई नतीजा नहीं।',
    mr: 'अजून काही निकाल नाही.',
  },
  'pulse.since.link.result': {
    en: 'See the result',
    hi: 'नतीजा देखें',
    mr: 'निकाल पाहा',
  },

  // "One" rather than "1": at the start of a sentence an owner reads the word,
  // and the count is the same either way.
  'pulse.since.done.one': {
    en: 'One improvement is now done.',
    hi: 'एक सुधार अब पूरा हो गया है।',
    mr: 'एक सुधारणा आता पूर्ण झाली आहे.',
  },
  'pulse.since.done.other': {
    en: '{count} improvements are now done.',
    hi: '{count} सुधार अब पूरे हो गए हैं।',
    mr: '{count} सुधारणा आता पूर्ण झाल्या आहेत.',
  },
} satisfies Namespace;
