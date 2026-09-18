import type { Namespace } from '../t';

/**
 * The owner's half of the improvement loop
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 *
 * THE FOUR BUTTONS ARE WHAT A PERSON WOULD SAY, not what the database stores.
 * The row goes to ACCEPTED, DONE, PAUSED or DECLINED; the owner reads "I'll
 * handle this", "Done", "Keep watching" and "Not doing this". Every one is
 * short enough to sit on a phone button in Devanagari, which is the constraint
 * that ruled out the longer and more precise phrasings.
 *
 * NOTHING HERE CONGRATULATES ANYBODY. "Done" is answered with what Headway
 * will do next, not with "Great job!" — the owner changed something in their
 * business and the software's opinion of that is worth nothing. The reward is
 * the measured outcome, weeks later, and it has its own words below.
 *
 * AND NOTHING HERE CLAIMS A CAUSE. "after the change" is the whole
 * relationship Headway can honestly state between a decision and a count. Not
 * "because of", not "thanks to", not "your change worked".
 */
export const loop = {
  // -------------------------------------------------------------------------
  // The four choices
  // -------------------------------------------------------------------------
  'loop.choice.handle': {
    en: "I'll handle this",
    hi: 'मैं यह देख लूँगा',
    mr: 'मी हे बघतो',
  },
  'loop.choice.done': {
    en: 'Done',
    hi: 'हो गया',
    mr: 'झालं',
  },
  'loop.choice.watch': {
    en: 'Keep watching',
    hi: 'नज़र रखते रहें',
    mr: 'लक्ष ठेवत राहा',
  },
  'loop.choice.revisit': {
    en: 'Revisit this',
    hi: 'फिर से देखें',
    mr: 'पुन्हा पाहा',
  },

  'loop.choice.notDoing': {
    en: 'Not doing this',
    hi: 'यह नहीं कर रहे',
    mr: 'हे करत नाही',
  },

  // -------------------------------------------------------------------------
  // What Headway says back — a statement of what happens next, never praise
  // -------------------------------------------------------------------------
  'loop.saved.handle': {
    en: 'Got it. Tell Headway when the change is made.',
    hi: 'ठीक है। बदलाव हो जाए तो Headway को बता दें।',
    mr: 'ठीक आहे. बदल झाल्यावर Headway ला सांगा.',
  },
  'loop.saved.done': {
    en: 'Got it. Headway will watch the next feedback for this.',
    hi: 'ठीक है। Headway इस पर आने वाले फ़ीडबैक पर नज़र रखेगा।',
    mr: 'ठीक आहे. Headway यावर येणाऱ्या फीडबॅकवर लक्ष ठेवेल.',
  },
  'loop.saved.watch': {
    en: 'Got it. Headway will keep counting this one.',
    hi: 'ठीक है। Headway इसे गिनता रहेगा।',
    mr: 'ठीक आहे. Headway हे मोजत राहील.',
  },
  'loop.saved.notDoing': {
    en: 'Got it. Headway will stop suggesting this.',
    hi: 'ठीक है। Headway अब यह सुझाव नहीं देगा।',
    mr: 'ठीक आहे. Headway आता हा सल्ला देणार नाही.',
  },
  // Revisiting puts something back on the table; it does not decide it. The
  // words have to say so — an owner who taps Revisit and reads "Headway will
  // watch the next feedback" would believe they had committed to a change.
  'loop.saved.revisit': {
    en: 'Back on your list. Decide when you are ready.',
    hi: 'यह फिर आपकी लिस्ट में है। जब तैयार हों तब फ़ैसला करें।',
    mr: 'हे पुन्हा तुमच्या यादीत आहे. तयार असाल तेव्हा निर्णय घ्या.',
  },

  'loop.saving': {
    en: 'Saving…',
    hi: 'सेव हो रहा है…',
    mr: 'सेव्ह होत आहे…',
  },
  'loop.failed': {
    en: 'That did not save. Try again.',
    hi: 'यह सेव नहीं हुआ। दोबारा कोशिश करें।',
    mr: 'हे सेव्ह झालं नाही. पुन्हा प्रयत्न करा.',
  },

  // -------------------------------------------------------------------------
  // Where the loop stands, said back to the owner in one line
  // -------------------------------------------------------------------------
  'loop.state.yours': {
    en: 'You said you would handle this',
    hi: 'आपने कहा था कि आप यह देख लेंगे',
    mr: 'तुम्ही म्हणाला होतात की तुम्ही हे बघाल',
  },
  'loop.state.watching': {
    en: 'Headway is watching this',
    hi: 'Headway इस पर नज़र रख रहा है',
    mr: 'Headway यावर लक्ष ठेवत आहे',
  },
  'loop.state.paused': {
    en: 'Being counted, not acted on',
    hi: 'गिना जा रहा है, अभी कुछ किया नहीं जा रहा',
    mr: 'मोजलं जात आहे, अजून काही केलं जात नाही',
  },
  'loop.state.checkingNow': {
    en: 'Enough new feedback has come in. Headway is checking this now.',
    hi: 'काफ़ी नया फ़ीडबैक आ गया है। Headway अभी इसकी जाँच कर रहा है।',
    mr: 'पुरेसा नवा फीडबॅक आला आहे. Headway आत्ता हे तपासत आहे.',
  },
  'loop.state.notDoing': {
    en: 'You decided not to do this',
    hi: 'आपने यह न करने का फ़ैसला किया',
    mr: 'तुम्ही हे न करण्याचा निर्णय घेतला',
  },

  // -------------------------------------------------------------------------
  // The action centre's five shelves
  // -------------------------------------------------------------------------
  'loop.shelf.doNow': {
    en: 'Do now',
    hi: 'अभी करें',
    mr: 'आत्ता करा',
  },
  'loop.shelf.watching': {
    en: 'Headway is watching',
    hi: 'Headway नज़र रख रहा है',
    mr: 'Headway लक्ष ठेवत आहे',
  },
  'loop.shelf.alsoSuggested': {
    en: 'Also suggested',
    hi: 'और सुझाव',
    mr: 'आणखी सल्ले',
  },
  'loop.shelf.keepDoing': {
    en: 'Keep doing',
    hi: 'करते रहें',
    mr: 'करत राहा',
  },
  'loop.shelf.completed': {
    en: 'Checked',
    hi: 'जाँच हो चुकी',
    mr: 'तपासून झालं',
  },

  'loop.shelf.notDoing': {
    en: 'Not doing',
    hi: 'नहीं कर रहे',
    mr: 'करत नाही',
  },

  // How much new feedback a check still needs. Counts, never a progress bar:
  // a bar implies a finish line, and this one moves with the customers.
  'loop.waiting.need.one': {
    en: '{have} of {need} new feedback entry so far',
    hi: 'अब तक {need} में से {have} नया फ़ीडबैक',
    mr: 'आतापर्यंत {need} पैकी {have} नवा फीडबॅक',
  },
  'loop.waiting.need.other': {
    en: '{have} of {need} new feedback entries so far',
    hi: 'अब तक {need} में से {have} नए फ़ीडबैक',
    mr: 'आतापर्यंत {need} पैकी {have} नवे फीडबॅक',
  },
  'loop.waiting.tooEarly': {
    en: 'Too early to tell',
    hi: 'अभी कुछ कहना जल्दबाज़ी होगी',
    mr: 'आत्ताच काही सांगणं घाईचं होईल',
  },

  // -------------------------------------------------------------------------
  // This month — what you changed, and what customers did afterward
  //
  // "after the change" everywhere. The count moved and the change happened
  // before it; that is all Headway observed and all it says.
  // -------------------------------------------------------------------------
  'loop.month.title': {
    en: 'What you changed',
    hi: 'आपने क्या बदला',
    mr: 'तुम्ही काय बदललं',
  },
  'loop.month.made.one': {
    en: '{count} change made',
    hi: '{count} बदलाव किया',
    mr: '{count} बदल केला',
  },
  'loop.month.made.other': {
    en: '{count} changes made',
    hi: '{count} बदलाव किए',
    mr: '{count} बदल केले',
  },
  'loop.month.checked.one': {
    en: '{count} checked against new feedback',
    hi: '{count} की नए फ़ीडबैक से जाँच हुई',
    mr: '{count} ची नव्या फीडबॅकशी तपासणी झाली',
  },
  'loop.month.checked.other': {
    en: '{count} checked against new feedback',
    hi: '{count} की नए फ़ीडबैक से जाँच हुई',
    mr: '{count} ची नव्या फीडबॅकशी तपासणी झाली',
  },
  'loop.month.empty': {
    en: 'Nothing has been changed and checked yet. This fills up as you act on what customers say.',
    hi: 'अभी कुछ बदला और जाँचा नहीं गया है। ग्राहक जो कहते हैं उस पर आप काम करेंगे, वैसे-वैसे यह भरता जाएगा।',
    mr: 'अजून काही बदललं आणि तपासलं गेलेलं नाही. ग्राहक जे सांगतात त्यावर तुम्ही काम कराल तसं हे भरत जाईल.',
  },
  'loop.month.open': {
    en: 'See what changed',
    hi: 'क्या बदला, यह देखें',
    mr: 'काय बदललं ते पाहा',
  },
} satisfies Namespace;
