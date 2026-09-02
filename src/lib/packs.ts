import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/**
 * Vertical playbooks ("packs") are plain JSON files under /packs.
 *
 * They are the ONLY place vertical-specific knowledge lives. Nothing in the
 * application hardcodes a vertical: adding a new business type means dropping
 * a new JSON file into /packs and restarting.
 */

const taxonomyEntrySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  action: z.string().optional(),
  hints: z.array(z.string()).default([]),
  /**
   * How to name this theme inside a reply to a customer (M7).
   *
   * `label` is a category name for the operator's screens — "Appointment /
   * booking problems" — and reads terribly in a sentence a customer will see.
   * This is the same idea written the way a person would say it.
   *
   * On an ISSUE entry it is a noun phrase completing "We are sorry about ___":
   *   "the wait past your appointment time"
   * On a PRAISE entry it is a clause completing "It is good to hear that ___":
   *   "the doctor took the time to explain things"
   *
   * Optional: a pack without it falls back to a cleaned-up label.
   */
  replyPhrase: z.string().optional(),
  /** The same phrase in romanised Hinglish. Optional. */
  replyPhraseHinglish: z.string().optional(),
  /** The same phrase in Marathi. Optional. */
  replyPhraseMarathi: z.string().optional(),
});

const packSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().default(''),
  headlineKpi: z.object({
    key: z.string(),
    label: z.string(),
    help: z.string().default(''),
    goodDirection: z.enum(['up', 'down']).default('up'),
  }),
  issueTaxonomy: z.array(taxonomyEntrySchema).min(1),
  praiseTaxonomy: z.array(taxonomyEntrySchema).min(1),
  voicePreset: z.object({
    formality: z.enum(['FORMAL', 'NEUTRAL', 'FRIENDLY', 'CASUAL']),
    languageMix: z.enum(['ENGLISH', 'HINDI', 'HINGLISH', 'MARATHI', 'MIXED']),
    greeting: z.string().default(''),
    signOff: z.string().default(''),
    preferredWords: z.array(z.string()).default([]),
    bannedWords: z.array(z.string()).default([]),
    emojiPolicy: z.enum(['NONE', 'MINIMAL', 'MODERATE']),
    exampleReplies: z.array(z.string()).default([]),
  }),
  staffAskScript: z.object({
    when: z.string().default(''),
    line: z.string().default(''),
    hinglishLine: z.string().default(''),
    marathiLine: z.string().default(''),
    doNot: z.array(z.string()).default([]),
  }),
  profileGapChecks: z
    .array(z.object({ key: z.string(), label: z.string() }))
    .default([]),
  contentTemplates: z
    .array(z.object({ key: z.string(), label: z.string(), body: z.string() }))
    .default([]),
  /**
   * Feedback-kit wording for this vertical (M3).
   *
   * Optional so a pack written before M3 still loads; `src/lib/kit/content.ts`
   * derives sensible fallbacks from contentTemplates and staffAskScript when it
   * is absent. This is the ONLY place kit copy differs by business type —
   * there are no per-vertical branches in the UI.
   *
   * Messages may use the tokens {{businessName}} and {{reviewUrl}}.
   */
  kit: z
    .object({
      assetLabel: z.string(),
      placement: z.string(),
      moment: z.string(),
      headline: z.string(),
      subhead: z.string(),
      qrCaption: z.string(),
      askMessage: z.string(),
      askMessageHinglish: z.string().default(''),
      askMessageMarathi: z.string().default(''),
      thankYou: z.string().default(''),
    })
    .optional(),
});

export type TaxonomyEntry = z.infer<typeof taxonomyEntrySchema>;
export type Pack = z.infer<typeof packSchema>;
export type PackKit = NonNullable<Pack['kit']>;

const PACKS_DIR = join(process.cwd(), 'packs');

let cache: Map<string, Pack> | null = null;

function loadAll(): Map<string, Pack> {
  if (cache) return cache;

  const map = new Map<string, Pack>();
  let files: string[];
  try {
    files = readdirSync(PACKS_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    throw new Error(
      `RepOS could not read the packs directory at ${PACKS_DIR}. Vertical playbooks are required.`,
    );
  }

  for (const file of files.sort()) {
    const raw = readFileSync(join(PACKS_DIR, file), 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Pack "${file}" is not valid JSON.`);
    }
    const result = packSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Pack "${file}" is invalid: ${result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      );
    }
    map.set(result.data.id, result.data);
  }

  if (map.size === 0) {
    throw new Error('No vertical packs found under /packs.');
  }

  cache = map;
  return map;
}

/** Every pack, sorted by label. */
export function listPacks(): Pack[] {
  return [...loadAll().values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Lightweight options for a <select>. */
export function packOptions(): Array<{ value: string; label: string }> {
  return listPacks().map((p) => ({ value: p.id, label: p.label }));
}

/** Returns the pack, or undefined when the id is unknown. */
export function findPack(id: string | null | undefined): Pack | undefined {
  if (!id) return undefined;
  return loadAll().get(id);
}

/**
 * Returns the pack for `id`, falling back to the first available pack rather
 * than throwing. Reports must still render if a vertical was renamed.
 */
export function getPackOrFallback(id: string | null | undefined): Pack {
  const found = findPack(id);
  if (found) return found;
  const first = listPacks()[0];
  if (!first) throw new Error('No vertical packs found under /packs.');
  return first;
}

/** Label lookup that never throws — used in list views. */
export function verticalLabel(id: string | null | undefined): string {
  return findPack(id)?.label ?? (id || 'Unknown vertical');
}

export function issueLabel(pack: Pack, key: string): string {
  return pack.issueTaxonomy.find((t) => t.key === key)?.label ?? key;
}

export function praiseLabel(pack: Pack, key: string): string {
  return pack.praiseTaxonomy.find((t) => t.key === key)?.label ?? key;
}

/** Test seam: drop the in-process cache. */
export function _resetPackCache(): void {
  cache = null;
}
