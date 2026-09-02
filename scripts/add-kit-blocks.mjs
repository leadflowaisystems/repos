/**
 * One-off maintenance script.
 *
 * M3 adds a `kit` block to every vertical pack. This is the ONLY place the
 * feedback kit's vertical-specific wording lives — there are no per-vertical
 * React branches anywhere in the application. Onboarding a new business type
 * means adding a JSON file here, not writing a new page.
 *
 * Run with: node scripts/add-kit-blocks.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'packs');

/** Tokens available in every message: {{businessName}}, {{reviewUrl}}. */
const KITS = {
  clinic: {
    assetLabel: 'counter card',
    placement: 'At the billing counter, facing patients as they settle up.',
    moment: 'At discharge or billing, once the patient says they feel looked after.',
    headline: 'Was today’s visit helpful?',
    subhead: 'Scan and tell us honestly. It takes a minute.',
    qrCaption: 'Scan to share your experience',
    askMessage:
      'Thank you for visiting {{businessName}}. If today’s visit was helpful, would you share your honest experience? It takes about a minute: {{reviewUrl}}',
    askMessageHinglish:
      'Aapka {{businessName}} aane ke liye dhanyawaad. Agar aaj ka visit theek raha ho, toh apna honest feedback share kar dijiye — ek minute lagega: {{reviewUrl}}',
    askMessageMarathi:
      '{{businessName}} ला भेट दिल्याबद्दल धन्यवाद. आजची भेट उपयुक्त वाटली असेल, तर तुमचा प्रामाणिक अनुभव नोंदवाल का? एक मिनिट लागेल: {{reviewUrl}}',
    thankYou: 'Thank you — we read every one of these.',
  },
  restaurant: {
    assetLabel: 'table card',
    placement: 'On each table, and one at the billing counter.',
    moment: 'When clearing the table, after the guest has finished the meal.',
    headline: 'How was the food today?',
    subhead: 'Scan and tell us honestly — good or bad.',
    qrCaption: 'Scan to tell us how it was',
    askMessage:
      'Thanks for eating at {{businessName}}. If you have a minute, tell us honestly how it was — it genuinely helps the kitchen: {{reviewUrl}}',
    askMessageHinglish:
      '{{businessName}} me khaane ke liye shukriya. Ek minute ho toh honest feedback de dijiye — kitchen ko bahut help karta hai: {{reviewUrl}}',
    askMessageMarathi:
      '{{businessName}} मध्ये जेवल्याबद्दल धन्यवाद. एक मिनिट असेल तर प्रामाणिक अभिप्राय द्या — स्वयंपाकघराला खूप मदत होते: {{reviewUrl}}',
    thankYou: 'Thank you — this goes straight to the kitchen team.',
  },
  salon: {
    assetLabel: 'counter card',
    placement: 'At the billing counter, where clients can see it while paying.',
    moment: 'At billing, once the client has seen the finished result in the mirror.',
    headline: 'Happy with how it turned out?',
    subhead: 'Scan and tell us honestly. One minute.',
    qrCaption: 'Scan to share your honest review',
    askMessage:
      'Thank you for visiting {{businessName}}. If you are happy with how it turned out, would you share an honest review? It takes a minute: {{reviewUrl}}',
    askMessageHinglish:
      '{{businessName}} aane ke liye dhanyawaad. Agar aapko result pasand aaya ho, toh ek honest review share kar dijiye — ek minute lagega: {{reviewUrl}}',
    askMessageMarathi:
      '{{businessName}} ला भेट दिल्याबद्दल धन्यवाद. निकाल आवडला असेल तर तुमचा प्रामाणिक अभिप्राय द्याल का? एक मिनिट लागेल: {{reviewUrl}}',
    thankYou: 'Thank you — the team will be glad to read this.',
  },
  gym: {
    assetLabel: 'front-desk card',
    placement: 'At the front desk, beside the sign-in register.',
    moment: 'After a member completes a milestone session, or when they renew.',
    headline: 'Is the gym working for you?',
    subhead: 'Scan and tell us honestly — it takes a minute.',
    qrCaption: 'Scan to share your honest review',
    askMessage:
      'Thanks for training with {{businessName}}. If the gym has been working for you, an honest review really helps other people decide: {{reviewUrl}}',
    askMessageHinglish:
      '{{businessName}} me train karne ke liye shukriya. Agar gym aapke liye theek chal raha hai, toh ek honest review dusron ko decide karne me help karta hai: {{reviewUrl}}',
    askMessageMarathi:
      '{{businessName}} मध्ये सराव केल्याबद्दल धन्यवाद. जिम तुमच्यासाठी उपयुक्त ठरत असेल, तर प्रामाणिक अभिप्राय इतरांना मदत करतो: {{reviewUrl}}',
    thankYou: 'Thank you — the floor team will be glad to read this.',
  },
  coaching: {
    assetLabel: 'front-desk card',
    placement: 'At the front desk and in the parent waiting area.',
    moment: 'At a parent meeting, or when a term result is handed over.',
    headline: 'How are the classes going?',
    subhead: 'Scan and share your honest feedback. One minute.',
    qrCaption: 'Scan to share your honest feedback',
    askMessage:
      'Thank you for choosing {{businessName}}. If the classes have been useful, an honest review from a parent helps other families decide: {{reviewUrl}}',
    askMessageHinglish:
      '{{businessName}} chunne ke liye dhanyawaad. Agar classes useful rahi hain, toh ek honest parent review dusre families ko decide karne me help karta hai: {{reviewUrl}}',
    askMessageMarathi:
      '{{businessName}} निवडल्याबद्दल धन्यवाद. वर्ग उपयुक्त ठरले असतील, तर पालकांचा प्रामाणिक अभिप्राय इतर कुटुंबांना मदत करतो: {{reviewUrl}}',
    thankYou: 'Thank you — we will share this with the faculty team.',
  },
  real_estate: {
    assetLabel: 'handover card',
    placement: 'Handed over with the agreement folder or at key handover.',
    moment: 'After handover or agreement signing, once the client confirms it went smoothly.',
    headline: 'How did the process go?',
    subhead: 'Scan and share your honest experience. One minute.',
    qrCaption: 'Scan to share your honest experience',
    askMessage:
      'Thank you for working with {{businessName}}. If the process worked for you, an honest review helps the next family decide who to trust: {{reviewUrl}}',
    askMessageHinglish:
      '{{businessName}} ke saath kaam karne ke liye dhanyawaad. Agar process theek raha ho, toh ek honest review agle family ko trust decide karne me help karta hai: {{reviewUrl}}',
    askMessageMarathi:
      '{{businessName}} सोबत काम केल्याबद्दल धन्यवाद. प्रक्रिया सुरळीत झाली असेल, तर प्रामाणिक अभिप्राय पुढच्या कुटुंबाला मदत करतो: {{reviewUrl}}',
    thankYou: 'Thank you — do reach out if anything comes up later.',
  },
  wedding_vendor: {
    assetLabel: 'delivery card',
    placement: 'Included with the final delivery — album box, USB pouch or handover folder.',
    moment: 'At final delivery, once the client has seen and approved the finished work.',
    headline: 'Did we do right by you?',
    subhead: 'Scan and share your honest experience. One minute.',
    qrCaption: 'Scan to share your honest experience',
    askMessage:
      'Thank you for trusting {{businessName}} with your day. If we did right by you, an honest review helps the next couple choose with confidence: {{reviewUrl}}',
    askMessageHinglish:
      '{{businessName}} par bharosa karne ke liye dhanyawaad. Agar humne aapke liye theek kaam kiya ho, toh ek honest review agle couple ko confidence deta hai: {{reviewUrl}}',
    askMessageMarathi:
      '{{businessName}} वर विश्वास ठेवल्याबद्दल धन्यवाद. आमचं काम आवडलं असेल, तर प्रामाणिक अभिप्राय पुढच्या जोडप्याला मदत करतो: {{reviewUrl}}',
    thankYou: 'Thank you — it was a privilege to be part of your day.',
  },
};

let updated = 0;
for (const file of readdirSync(packsDir).filter((f) => f.endsWith('.json'))) {
  const path = join(packsDir, file);
  const pack = JSON.parse(readFileSync(path, 'utf8'));
  const kit = KITS[pack.id];
  if (!kit) {
    console.warn(`${file}: no kit content defined for id "${pack.id}" — skipped`);
    continue;
  }
  pack.kit = kit;
  writeFileSync(path, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
  updated += 1;
}
console.log(`Added kit blocks to ${updated} packs.`);
