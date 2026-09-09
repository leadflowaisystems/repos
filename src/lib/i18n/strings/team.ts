import type { Namespace } from '../t';

/**
 * Team — who can open this workspace
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 */
export const team = {
  // -------------------------------------------------------------------------
  // The page itself
  // -------------------------------------------------------------------------
  'team.meta.title': {
    en: 'Team',
    hi: 'टीम',
    mr: 'टीम',
  },
  'team.eyebrow': {
    en: 'Team',
    hi: 'टीम',
    mr: 'टीम',
  },
  'team.title': {
    en: 'Who has access',
    hi: 'किन लोगों के पास एक्सेस है',
    mr: 'कोणाकडे ॲक्सेस आहे',
  },

  // -------------------------------------------------------------------------
  // The two counts under the title.
  //
  // TWO WHOLE SENTENCES, NOT ONE STITCHED ONE. The page used to build a single
  // sentence out of a number, a verb picked by that number, a clause, a second
  // number and a second verb. English tolerates that; Hindi puts the verb last
  // and Marathi agrees the verb with the noun, so the pieces cannot be reused.
  // Each sentence is now whole and each is translated as a sentence.
  // -------------------------------------------------------------------------
  'team.intro.members.one': {
    en: '{count} person can open this workspace.',
    hi: '{count} व्यक्ति यह वर्कस्पेस खोल सकते हैं।',
    mr: '{count} व्यक्ती हे वर्कस्पेस उघडू शकते.',
  },
  'team.intro.members.other': {
    en: '{count} people can open this workspace.',
    hi: '{count} लोग यह वर्कस्पेस खोल सकते हैं।',
    mr: '{count} लोक हे वर्कस्पेस उघडू शकतात.',
  },
  'team.intro.invites.one': {
    en: '{count} invitation has not been accepted yet.',
    hi: '{count} निमंत्रण अभी तक स्वीकार नहीं हुआ है।',
    mr: '{count} निमंत्रण अजून स्वीकारलं गेलेलं नाही.',
  },
  'team.intro.invites.other': {
    en: '{count} invitations have not been accepted yet.',
    hi: '{count} निमंत्रण अभी तक स्वीकार नहीं हुए हैं।',
    mr: '{count} निमंत्रणं अजून स्वीकारली गेलेली नाहीत.',
  },

  // -------------------------------------------------------------------------
  // The member list
  // -------------------------------------------------------------------------
  'team.members.eyebrow': {
    en: 'People on your team',
    hi: 'आपकी टीम के लोग',
    mr: 'तुमच्या टीममधील लोक',
  },
  'team.role.owner': {
    en: 'Owner',
    hi: 'मालिक',
    mr: 'मालक',
  },
  'team.role.staff': {
    en: 'Staff',
    hi: 'स्टाफ़',
    mr: 'स्टाफ',
  },
  /** The role and the stopped-access badge, as one phrase rather than two. */
  'team.member.suspendedRole': {
    en: '{role} · access stopped',
    hi: '{role} · एक्सेस बंद',
    mr: '{role} · ॲक्सेस बंद',
  },
  'team.can.owner': {
    en: 'Can see everything. Can change the team and the account.',
    hi: 'सब कुछ देख सकते हैं। टीम और अकाउंट बदल सकते हैं।',
    mr: 'सर्व काही पाहू शकतात. टीम आणि अकाउंट बदलू शकतात.',
  },
  'team.can.staff': {
    en: 'Can see everything. Cannot change the team or the account.',
    hi: 'सब कुछ देख सकते हैं। टीम या अकाउंट नहीं बदल सकते।',
    mr: 'सर्व काही पाहू शकतात. टीम किंवा अकाउंट बदलू शकत नाहीत.',
  },
  'team.can.suspended': {
    en: 'Cannot open this workspace until you give their access back.',
    hi: 'जब तक आप इनका एक्सेस वापस नहीं देते, ये यह वर्कस्पेस नहीं खोल सकते।',
    mr: 'तुम्ही यांचा ॲक्सेस परत देईपर्यंत ते हे वर्कस्पेस उघडू शकत नाहीत.',
  },
  'team.member.lastOwner': {
    en: 'The only owner. Make someone else an owner before you change this.',
    hi: 'यही अकेले मालिक हैं। इसे बदलने से पहले किसी और को मालिक बनाएँ।',
    mr: 'हेच एकमेव मालक आहेत. हे बदलण्यापूर्वी दुसऱ्या कोणाला तरी मालक करा.',
  },
  'team.member.makeStaff': {
    en: 'Make them staff',
    hi: 'इन्हें स्टाफ़ बनाएँ',
    mr: 'यांना स्टाफ करा',
  },
  'team.member.makeOwner': {
    en: 'Make them owner',
    hi: 'इन्हें मालिक बनाएँ',
    mr: 'यांना मालक करा',
  },
  'team.member.stopAccess': {
    en: 'Stop access',
    hi: 'एक्सेस बंद करें',
    mr: 'ॲक्सेस बंद करा',
  },
  'team.member.giveAccessBack': {
    en: 'Give access back',
    hi: 'एक्सेस वापस दें',
    mr: 'ॲक्सेस परत द्या',
  },

  // -------------------------------------------------------------------------
  // Inviting somebody
  // -------------------------------------------------------------------------
  'team.invite.eyebrow': {
    en: 'Invite someone',
    hi: 'किसी को बुलाएँ',
    mr: 'कोणाला तरी बोलवा',
  },
  'team.form.emailLabel': {
    en: 'Email',
    hi: 'ईमेल',
    mr: 'ईमेल',
  },
  'team.form.roleLabel': {
    en: 'Role',
    hi: 'रोल',
    mr: 'रोल',
  },
  'team.form.create': {
    en: 'Create invitation',
    hi: 'निमंत्रण बनाएँ',
    mr: 'निमंत्रण तयार करा',
  },
  'team.form.creating': {
    en: 'Creating…',
    hi: 'बन रहा है…',
    mr: 'तयार होत आहे…',
  },
  'team.form.help': {
    en: 'They get an email with a sign-in link. You can also copy the link and send it yourself.',
    hi: 'उन्हें साइन-इन लिंक के साथ एक ईमेल जाएगा। आप लिंक कॉपी करके ख़ुद भी भेज सकते हैं।',
    mr: 'त्यांना साइन-इन लिंकसह एक ईमेल जाईल. तुम्ही लिंक कॉपी करून स्वतःही पाठवू शकता.',
  },
  'team.form.linkBackup': {
    en: 'Invitation link, in case the email does not arrive',
    hi: 'निमंत्रण लिंक, अगर ईमेल न पहुँचे तो',
    mr: 'निमंत्रण लिंक, ईमेल पोहोचली नाही तर',
  },
  'team.form.linkSend': {
    en: 'Send them this link',
    hi: 'उन्हें यह लिंक भेजें',
    mr: 'त्यांना ही लिंक पाठवा',
  },
  'team.form.copyLink': {
    en: 'Copy invitation link',
    hi: 'निमंत्रण लिंक कॉपी करें',
    mr: 'निमंत्रण लिंक कॉपी करा',
  },
  'team.form.copied': {
    en: 'Copied',
    hi: 'कॉपी हो गई',
    mr: 'कॉपी झाली',
  },
  'team.form.linkNote': {
    en: 'This link works once, only for {email}, and stops working after 7 days.',
    hi: 'यह लिंक सिर्फ़ एक बार चलेगी, सिर्फ़ {email} के लिए, और 7 दिन बाद बंद हो जाएगी।',
    mr: 'ही लिंक फक्त एकदाच चालेल, फक्त {email} साठी, आणि 7 दिवसांनंतर बंद होईल.',
  },

  // -------------------------------------------------------------------------
  // Invitations nobody has accepted yet
  // -------------------------------------------------------------------------
  'team.pending.eyebrow': {
    en: 'Invited, not joined yet',
    hi: 'बुलाया गया है, अभी शामिल नहीं हुए',
    mr: 'बोलावलं आहे, अजून सामील झालेले नाहीत',
  },
  /** The role and the expiry, as one phrase rather than two. */
  'team.invite.expiredRole': {
    en: '{role} · link expired',
    hi: '{role} · लिंक ख़त्म हो चुकी है',
    mr: '{role} · लिंक संपली आहे',
  },
  'team.invite.cancel': {
    en: 'Cancel',
    hi: 'रद्द करें',
    mr: 'रद्द करा',
  },
  'team.invite.cancelling': {
    en: 'Cancelling…',
    hi: 'रद्द हो रहा है…',
    mr: 'रद्द होत आहे…',
  },

  // -------------------------------------------------------------------------
  // Accepting one.
  //
  // The invitation page sits outside the workspace shell, so this renders in
  // English there — which is correct, because that page has no language choice
  // to read yet. The phrases are translated so the control reads the same
  // wherever it is placed later.
  // -------------------------------------------------------------------------
  'team.accept.button': {
    en: 'Accept invitation',
    hi: 'निमंत्रण स्वीकार करें',
    mr: 'निमंत्रण स्वीकारा',
  },
  'team.accept.joining': {
    en: 'Joining…',
    hi: 'शामिल हो रहे हैं…',
    mr: 'सामील होत आहे…',
  },
} satisfies Namespace;
