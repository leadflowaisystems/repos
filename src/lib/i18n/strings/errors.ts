import type { Namespace } from '../t';

/**
 * Error and empty screens, refusals, and anything shown when something is wrong
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 */
export const errors = {
  // -------------------------------------------------------------------------
  // The workspace error screen.
  //
  // Four short lines, in the order an owner needs them: something is wrong,
  // what is wrong, what is NOT wrong, and two ways on. No message, digest or
  // path — the reason belongs in the server log, not on an owner's phone.
  // -------------------------------------------------------------------------
  'errors.workspace.eyebrow': {
    en: 'Something went wrong',
    hi: 'कुछ गड़बड़ हुई',
    mr: 'काहीतरी चुकलं',
  },
  'errors.workspace.headline': {
    en: 'Headway could not show this page right now.',
    hi: 'हेडवे अभी यह पेज नहीं दिखा सका।',
    mr: 'हेडवे आत्ता हे पेज दाखवू शकलं नाही.',
  },
  'errors.workspace.reassurance': {
    en: 'Your feedback and your old records are safe.',
    hi: 'आपका फ़ीडबैक और आपका पुराना रिकॉर्ड सुरक्षित है।',
    mr: 'तुमचा फीडबॅक आणि तुमचा जुना रेकॉर्ड सुरक्षित आहे.',
  },
  'errors.workspace.retry': {
    en: 'Try again',
    hi: 'फिर से कोशिश करें',
    mr: 'पुन्हा प्रयत्न करा',
  },
  'errors.workspace.home': {
    en: 'Back to Home',
    hi: 'होम पर वापस जाएँ',
    mr: 'होमवर परत जा',
  },

  // -------------------------------------------------------------------------
  // The loading skeleton.
  //
  // Only a screen reader hears this one, and it is the whole acknowledgement
  // that a tap did something — so it is translated like anything else on
  // screen.
  // -------------------------------------------------------------------------
  'errors.loading.label': {
    en: 'Loading…',
    hi: 'लोड हो रहा है…',
    mr: 'लोड होत आहे…',
  },

  // -------------------------------------------------------------------------
  // The paused line at the top of every workspace page.
  //
  // The difference between "nothing is arriving" and "arriving, saved, not
  // being read yet" is exactly the thing an owner would otherwise get wrong,
  // so both halves have to survive translation intact.
  // -------------------------------------------------------------------------
  'errors.paused.banner': {
    en: 'Headway is paused. New feedback is still saved, but nobody is reading it yet.',
    hi: 'हेडवे रोका गया है। नया फ़ीडबैक अब भी सेव हो रहा है, लेकिन उसे अभी कोई नहीं पढ़ रहा।',
    mr: 'हेडवे थांबवलं आहे. नवीन फीडबॅक अजूनही सेव्ह होत आहे, पण ते अजून कोणी वाचत नाही.',
  },
  'errors.paused.account': {
    en: 'Go to Account',
    hi: 'अकाउंट पर जाएँ',
    mr: 'अकाउंटवर जा',
  },
} satisfies Namespace;
