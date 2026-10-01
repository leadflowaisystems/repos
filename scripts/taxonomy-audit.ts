/**
 * THE TAXONOMY AUDIT, GENERATED FROM THE CODE (final semantic correctness pass).
 *
 * Writes docs/SMART_FEEDBACK_TAXONOMY_AUDIT.md: for every topic of every
 * vertical pack, what may file it and what may not —
 *
 *   valid expressions   the pack's own phrases (multi-word = specific evidence)
 *   aspect route        a named thing plus an opinion word near it
 *   weak evidence       single-word phrases, which yield to a confident
 *                       contradiction from the second reader
 *   rejected            phrases removed from the pack, with the round that
 *                       removed them, and the look-alike phrases masked for all
 *   attribution         whether the topic's wording depends on WHO did it,
 *                       and therefore is set aside when the sentence is about
 *                       someone other than the business
 *
 * Generated, never hand-edited: run `npx tsx scripts/taxonomy-audit.ts`.
 */
import { writeFileSync } from 'node:fs';
import { listPacks } from '@/lib/packs';
import { aspectRoutes } from '@/lib/analysis/aspects';
import { isAttributionSensitive } from '@/lib/analysis/scope';
import { ROUNDS } from './taxonomy-quality-pass.mjs';

type Edit = { add?: string[]; remove?: string[]; add2?: string[] };
const rounds = ROUNDS as Array<Record<string, Record<string, Edit>>>;
const ROUND_NAMES = ['round one', 'round two', 'round three', 'round four', 'round five'];

const lines: string[] = [
  '# Smart Feedback — Taxonomy Audit',
  '',
  'Generated from the code by `scripts/taxonomy-audit.ts`. Do not edit by hand.',
  '',
  'For every topic: what can file it, what is weak evidence, what was rejected and why, and whether its meaning depends on who did it. Rules that apply to every topic are in [SMART_FEEDBACK_INTELLIGENCE_RULES.md](SMART_FEEDBACK_INTELLIGENCE_RULES.md): negation, clause scope, attribution, past-versus-now, and the look-alike phrases masked before anything is read.',
  '',
  '**Legend.**',
  '- *Specific*: a phrase of two or more words, so the evidence is strong.',
  '- *Weak*: a single word. A confident contradiction from the second reader may overrule it.',
  '- *Attribution-sensitive*: the topic\'s wording ("late", "rude", "cancelled") means nothing until it is clear who did it. A clause about the customer, other people, another business or an event is set aside rather than filed.',
  '',
];

let topics = 0;
let sensitive = 0;
for (const pack of listPacks()) {
  lines.push(`## ${pack.label} (\`${pack.id}\`)`, '');
  const routes = aspectRoutes(pack.id);
  for (const [kind, entries] of [['Problem', pack.issueTaxonomy], ['Praise', pack.praiseTaxonomy]] as const) {
    for (const e of entries) {
      topics += 1;
      const specific = e.hints.filter((h) => /\s/.test(h.trim()));
      const weak = e.hints.filter((h) => !/\s/.test(h.trim()));
      const viaAspect = routes.filter((r) => r.topic === e.key);
      const removed = rounds.flatMap((round, i) =>
        (round[pack.id]?.[e.key]?.remove ?? []).map((h) => `"${h}" (${ROUND_NAMES[i]})`),
      );
      const isSensitive = e.hints.some(isAttributionSensitive) || viaAspect.some((r) => r.opinion.some(isAttributionSensitive));
      if (isSensitive) sensitive += 1;
      const counterpart = 'counterpart' in e && e.counterpart ? ` · other side: \`${e.counterpart}\`` : '';
      lines.push(`### \`${e.key}\` — ${e.label}`, '');
      lines.push(`${kind}${'severity' in e && e.severity ? ` · severity ${e.severity}` : ''}${counterpart}`, '');
      lines.push(`- **Specific phrases (${specific.length}):** ${specific.length ? specific.map((h) => `"${h}"`).join(', ') : '—'}`);
      lines.push(`- **Weak, single words (${weak.length}):** ${weak.length ? weak.map((h) => `"${h}"`).join(', ') : '—'}`);
      lines.push(
        `- **Aspect route:** ${
          viaAspect.length
            ? viaAspect
                .map((r) => `${r.aspect}: one of ${r.anchors.slice(0, 8).map((a) => `"${a}"`).join(', ')}${r.anchors.length > 8 ? '…' : ''} with ${r.opinion.length ? r.opinion.slice(0, 8).map((o) => `"${o}"`).join(', ') : 'no word of its own'}${r.generic ? ' (or a generic opinion word: weak)' : ''} within five words`)
                .join('; ')
            : '—'
        }`,
      );
      lines.push(`- **Rejected:** ${removed.length ? removed.join(', ') : 'none removed'}`);
      lines.push(`- **Attribution:** ${isSensitive ? 'sensitive. Set aside when the clause is about someone other than the business.' : 'not sensitive. Counted wherever it appears, unless negated or past.'}`, '');
    }
  }
}

lines.splice(10, 0, '', `**Coverage.** ${topics} topics across ${listPacks().length} verticals. ${sensitive} of them are attribution-sensitive.`, '');
writeFileSync('docs/SMART_FEEDBACK_TAXONOMY_AUDIT.md', lines.join('\n'));
console.log(`${topics} topics, ${sensitive} attribution-sensitive`);
