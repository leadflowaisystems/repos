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
   * The praise theme that is the other face of this complaint (M12).
   *
   * "Long waiting time" and "Little or no waiting" are one experience seen
   * from two sides, and an owner should not have to notice that themselves.
   * Declared here — never guessed by code — on ISSUE entries only, naming a
   * key in the same pack's praiseTaxonomy. Optional: most themes have none.
   */
  counterpart: z.string().optional(),
  /**
   * What the pack's advice needs from the business (M13): STAFF, DISCOUNT,
   * PRICE or SPEND. When the owner has told RepOS one of these is off the
   * table, the advice is flagged and `alternativeAction` offered instead.
   * Declared here, per theme, never guessed from the wording.
   */
  actionNeeds: z.array(z.enum(['STAFF', 'DISCOUNT', 'PRICE', 'SPEND'])).default([]),
  /** The pack's fallback advice when `actionNeeds` cannot be met. Optional. */
  alternativeAction: z.string().optional(),
  /**
   * One question worth asking the owner when this complaint leads (M12).
   *
   * The feedback says customers wait; it rarely says where. The answer
   * changes what to fix, so RepOS asks — once, with simple choices — rather
   * than guessing. ISSUE entries only. Optional.
   */
  askOwner: z
    .object({
      question: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).max(4),
    })
    .optional(),
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

/**
 * One thing a customer is asked about, and the ways it commonly goes wrong.
 *
 * `key` is what gets stored and what the intelligence engine reads; `label` is
 * what the customer sees and may be reworded freely without orphaning a single
 * stored rating. `themeKey` names the issue this dimension is evidence for, so
 * a low rating strengthens a theme the engine already knows about rather than
 * introducing a parallel vocabulary of its own.
 */
const packDimensionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** An `issueTaxonomy` key in this same pack. */
  themeKey: z.string().default(''),
  /** Asked when the rating is low. Never phrased as an accusation. */
  improvePrompt: z.string().default(''),
  /** Asked when the rating is high — praise is worth as much detail. */
  goodPrompt: z.string().default(''),
  /**
   * Tappable specifics offered after a low rating. Not a list of complaints:
   * a customer picks one because it is quicker than typing, and may pick none.
   */
  signals: z
    .array(z.object({ key: z.string().min(1), label: z.string().min(1) }))
    .default([]),
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
  /**
   * Customer feedback page wording for this vertical (M14).
   *
   * There is ONE feedback page. These few lines are the only thing about it
   * that differs between a clinic and a cafe. Optional: a pack without it
   * gets the universal wording from `src/lib/gateway/copy.ts`. Nothing here
   * may mention ratings, stars, reviews or platforms — the page asks the
   * same question of every customer and steers nobody.
   */
  gateway: z
    .object({
      headline: z.string().default(''),
      prompt: z.string().default(''),
      placeholder: z.string().default(''),
      thankYou: z.string().default(''),
      printLine: z.string().default(''),
      /**
       * What this vertical asks a customer to rate, in the order asked (M19).
       *
       * Writing is the slowest thing a customer can be asked for, and most
       * will not do it. These few taps are what makes an unwritten visit
       * legible: five ratings say which part of the business was the problem
       * even when nobody types a word. Empty for a pack that has not been
       * given a set — then the page asks the overall question and stops.
       */
      dimensions: z.array(packDimensionSchema).default([]),
    })
    .optional(),
});

export type TaxonomyEntry = z.infer<typeof taxonomyEntrySchema>;
export type Pack = z.infer<typeof packSchema>;
export type PackKit = NonNullable<Pack['kit']>;
export type PackGateway = NonNullable<Pack['gateway']>;
export type PackDimension = z.infer<typeof packDimensionSchema>;
export type PackSignal = PackDimension['signals'][number];

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
      `Headway could not read the packs directory at ${PACKS_DIR}. Vertical playbooks are required.`,
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
