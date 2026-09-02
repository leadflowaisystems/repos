/**
 * One-off maintenance script.
 *
 * The keyword classifier matches praise hints and issue hints independently.
 * Neutral nouns ("staff", "doctor", "equipment", "quality") were appearing in
 * BOTH taxonomies, so "reception was rude" scored as praise for friendly staff.
 *
 * This removes neutral nouns from praise hint lists only. Issue hints keep them:
 * an issue bucket is entered via a complaint word, so the noun is useful there.
 *
 * Run with: node scripts/clean-praise-hints.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'packs');

/** Hints removed from praise taxonomies in every pack, matched case-insensitively. */
const NEUTRAL_NOUNS = new Set(
  [
    // people / roles
    'staff', 'reception', 'doctor', 'dr', 'trainer', 'coach', 'stylist', 'waiter',
    'server', 'faculty', 'teacher',
    // things
    'equipment', 'machine', 'machines', 'material', 'notes', 'menu', 'phone',
    'properties', 'options', 'choices', 'facilities', 'product',
    // aspects that are neutral on their own
    'service', 'ambience', 'ambiance', 'decor', 'quality', 'communication',
    'timing', 'price', 'fees', 'result', 'teaching', 'haircut', 'colour', 'color',
    'documentation', 'agreement', 'registration', 'paperwork', 'range', 'portion',
    // Devanagari neutral nouns
    'सेवा', 'सर्व्हिस', 'सुविधा', 'मशीन', 'उपकरण', 'नोट्स', 'साहित्य', 'मेन्यू',
    'वातावरण', 'माहौल', 'सजावट', 'वेळ', 'समय', 'निकाल', 'शिक्षक', 'डॉक्टर',
    'ट्रेनर', 'स्टाफ', 'पर्याय', 'विकल्प', 'कागदपत्र', 'दस्तावेज', 'फी',
    'गुणवत्ता', 'विविधता', 'संपर्क', 'माहिती', 'अनुभव', 'उत्पादन', 'प्रॉडक्ट',
    'क्लास', 'बॅच', 'टीम', 'परिणाम', 'बदल',
  ].map((s) => s.toLowerCase()),
);

let changed = 0;
for (const file of readdirSync(packsDir).filter((f) => f.endsWith('.json'))) {
  const path = join(packsDir, file);
  const pack = JSON.parse(readFileSync(path, 'utf8'));
  const removed = [];

  for (const entry of pack.praiseTaxonomy) {
    const before = entry.hints.length;
    entry.hints = entry.hints.filter((h) => {
      const keep = !NEUTRAL_NOUNS.has(h.toLowerCase().trim());
      if (!keep) removed.push(`${entry.key}:${h}`);
      return keep;
    });
    if (entry.hints.length === 0) {
      throw new Error(
        `${file}: praise bucket "${entry.key}" would be left with no hints. Add a polarity-bearing hint before removing.`,
      );
    }
    if (entry.hints.length !== before) changed += 1;
  }

  writeFileSync(path, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
  if (removed.length > 0) {
    console.log(`${file}: removed ${removed.length} neutral praise hints`);
  }
}
console.log(`Done. ${changed} praise buckets updated.`);
