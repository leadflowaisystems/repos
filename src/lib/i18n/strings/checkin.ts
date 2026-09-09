import type { Namespace } from '../t';

/**
 * Check-in — the regular conversation with Headway
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 */
export const checkin = {
  // -------------------------------------------------------------------------
  // The page itself
  // -------------------------------------------------------------------------
  'checkin.title': {
    en: 'Check-in',
    hi: 'चेक-इन',
    mr: 'चेक-इन',
  },
  'checkin.empty': {
    en: 'Headway has not read any feedback yet. Once feedback comes in, every check-in will show what needs your attention, what to keep doing, and what Headway is watching.',
    hi: 'हेडवे ने अभी तक कोई फ़ीडबैक नहीं पढ़ा है। फ़ीडबैक आने के बाद हर चेक-इन में दिखेगा कि किस पर आपका ध्यान चाहिए, क्या करते रहना है, और हेडवे किस पर नज़र रख रहा है।',
    mr: 'हेडवेने अजून कोणताही फीडबॅक वाचलेला नाही. फीडबॅक आल्यानंतर प्रत्येक चेक-इनमध्ये कशाकडे तुमचं लक्ष हवं, काय करत राहायचं, आणि हेडवे कशावर लक्ष ठेवत आहे हे दिसेल.',
  },

  // -------------------------------------------------------------------------
  // The three blocks
  //
  // One imperative each, so the label alone tells the owner what the block is
  // asking of them. "Do", "Protect" and "Watch" were nouns pretending to be
  // instructions, and "Protect" in particular does not survive translation as
  // one word — in Hindi and Marathi it becomes "keep doing this", which is what
  // it always meant.
  // -------------------------------------------------------------------------
  'checkin.block.do': {
    en: 'Do this',
    hi: 'यह करें',
    mr: 'हे करा',
  },
  'checkin.block.protect': {
    en: 'Keep doing this',
    hi: 'यह करते रहें',
    mr: 'हे करत राहा',
  },
  'checkin.block.watch': {
    en: 'Watch this',
    hi: 'इस पर नज़र रखें',
    mr: 'याकडे लक्ष ठेवा',
  },
  'checkin.block.next': {
    en: 'What to do.',
    hi: 'क्या करना है।',
    mr: 'काय करायचं.',
  },
  'checkin.block.needsReply': {
    en: 'Read the feedback that needs a reply',
    hi: 'जिस फ़ीडबैक का जवाब देना है, उसे पढ़ें',
    mr: 'ज्या फीडबॅकला उत्तर द्यायचं आहे, तो वाचा',
  },

  // -------------------------------------------------------------------------
  // The open loop
  // -------------------------------------------------------------------------
  'checkin.nextCheck.title': {
    en: 'What Headway will check next',
    hi: 'हेडवे आगे क्या देखेगा',
    mr: 'हेडवे पुढे काय पाहणार आहे',
  },

  // -------------------------------------------------------------------------
  // The two reveals
  //
  // `checkin.reveal.did` carries the period as one placeholder rather than
  // gluing two fragments together, because Hindi and Marathi put the time
  // before the verb and English puts it after.
  // -------------------------------------------------------------------------
  'checkin.reveal.changed': {
    en: 'Show what changed',
    hi: 'क्या बदला है, वह दिखाएँ',
    mr: 'काय बदललं आहे ते दाखवा',
  },
  'checkin.reveal.did': {
    en: 'What Headway did · {since}',
    hi: 'हेडवे ने क्या किया · {since}',
    mr: 'हेडवेने काय केलं · {since}',
  },

  // -------------------------------------------------------------------------
  // What moved between the two check-ins
  // -------------------------------------------------------------------------
  'checkin.moved.returning': {
    en: 'Coming back',
    hi: 'फिर से आ रहा है',
    mr: 'पुन्हा येत आहे',
  },
  'checkin.moved.worse': {
    en: 'Got worse',
    hi: 'ख़राब हुआ',
    mr: 'वाईट झालं',
  },
  'checkin.moved.better': {
    en: 'Improved',
    hi: 'बेहतर हुआ',
    mr: 'चांगलं झालं',
  },
  'checkin.changes.yours': {
    en: 'Changes you made',
    hi: 'आपने किए बदलाव',
    mr: 'तुम्ही केलेले बदल',
  },
  'checkin.changes.comparedSince': {
    en: 'Changes Headway compared since this check-in',
    hi: 'इस चेक-इन के बाद हेडवे ने जिन बदलावों की तुलना की',
    mr: 'या चेक-इननंतर हेडवेने ज्या बदलांची तुलना केली',
  },
  'checkin.alsoWatching': {
    en: 'Headway is also watching',
    hi: 'हेडवे इन पर भी नज़र रख रहा है',
    mr: 'हेडवे यांच्यावरही लक्ष ठेवत आहे',
  },
  'checkin.nothingToDecide': {
    en: 'Nothing from this check-in needs a decision from you.',
    hi: 'इस चेक-इन में आपको कोई फ़ैसला लेने की ज़रूरत नहीं है।',
    mr: 'या चेक-इनमध्ये तुम्हाला कोणताही निर्णय घ्यायची गरज नाही.',
  },
} satisfies Namespace;
