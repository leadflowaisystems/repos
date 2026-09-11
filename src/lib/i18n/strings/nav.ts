import type { Namespace } from '../t';

/**
 * The workspace header, section links and footer
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 *
 * THE DOOR NAMES ARE TRANSLATED; THE SLUGS ARE NOT. `reviews` stays `reviews`
 * in the address bar in all three languages, because a URL is not copy and
 * every link an owner has ever been sent must keep working. Only the word on
 * the tab changes.
 *
 * "Feedback" is the label on the `reviews` door on purpose, in every language.
 * What it lists is private customer feedback, which Headway promises is never
 * posted publicly — so the Hindi and Marathi words here are the glossary's
 * words for feedback (फ़ीडबैक / फीडबॅक) and never its words for a public
 * review (रिव्यू / रिव्ह्यू). Collapsing the two would tell an owner, on every
 * single screen, that Headway is publishing what their customers wrote.
 */
export const nav = {
  // --- the doors ------------------------------------------------------------
  'nav.sections.label': {
    en: 'Sections',
    hi: 'सेक्शन',
    mr: 'विभाग',
  },
  'nav.section.home': {
    en: 'Home',
    hi: 'होम',
    mr: 'होम',
  },
  'nav.section.customers': {
    en: 'Customers',
    hi: 'ग्राहक',
    mr: 'ग्राहक',
  },
  'nav.section.feedback': {
    en: 'Feedback',
    hi: 'फ़ीडबैक',
    mr: 'फीडबॅक',
  },
  'nav.section.improvements': {
    en: 'Improvements',
    hi: 'सुधार',
    mr: 'सुधारणा',
  },
  'nav.section.checkin': {
    en: 'Check-in',
    hi: 'चेक-इन',
    mr: 'चेक-इन',
  },
  'nav.section.team': {
    en: 'Team',
    hi: 'टीम',
    mr: 'टीम',
  },
  'nav.section.kit': {
    en: 'Kit',
    hi: 'किट',
    mr: 'किट',
  },
  'nav.section.orders': {
    en: 'Orders',
    hi: 'ऑर्डर',
    mr: 'ऑर्डर',
  },
  'nav.section.account': {
    en: 'Account',
    hi: 'अकाउंट',
    mr: 'अकाउंट',
  },

  // --- ending the session ----------------------------------------------------
  // The one control in the header that is not a door. Read by the workspace's
  // sign-out button; the operator console renders the same button with its
  // English default, because the console is not localized by design.
  'nav.signOut': {
    en: 'Sign out',
    hi: 'साइन आउट',
    mr: 'साइन आउट',
  },

  // --- the bar that closes every page ---------------------------------------
  'nav.footer.tagline': {
    en: 'Customers lead the way.',
    hi: 'ग्राहक रास्ता दिखाते हैं।',
    mr: 'ग्राहक वाट दाखवतात.',
  },

  // --- Check-in, This week and This month, as one control -------------------
  'nav.period.label': {
    en: 'Time range',
    hi: 'समय की अवधि',
    mr: 'कालावधी',
  },
  'nav.period.checkin': {
    en: 'Since last check-in',
    hi: 'पिछले चेक-इन के बाद से',
    mr: 'मागच्या चेक-इननंतर',
  },
  'nav.period.pulse': {
    en: 'This week',
    hi: 'इस हफ़्ते',
    mr: 'या आठवड्यात',
  },
  'nav.period.review': {
    en: 'This month',
    hi: 'इस महीने',
    mr: 'या महिन्यात',
  },
} satisfies Namespace;
