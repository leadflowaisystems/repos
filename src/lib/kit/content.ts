import type { Pack } from '@/lib/packs';

/**
 * FEEDBACK KIT CONTENT — one engine, every vertical.
 *
 * RepOS is not a clinic product with a salon skin bolted on. There is exactly
 * one kit page, one kit data model and one content builder. Everything that
 * differs between a clinic, a salon and a restaurant comes from that client's
 * vertical pack under /packs — never from a conditional in a component.
 *
 * Onboarding a new business type is a JSON file, not a new page tree.
 *
 * This module is pure: same inputs, same output, no database, no network.
 */

export type KitInput = {
  pack: Pack;
  businessName: string;
  /** Optional override so the printed piece can use a shorter trading name. */
  displayName?: string | null;
  /** Operator-supplied destination. Null when not set up yet. */
  reviewUrl?: string | null;
  /** Optional operator overrides; blank falls back to the vertical default. */
  headline?: string | null;
  subhead?: string | null;
  footerNote?: string | null;
};

export type KitMessage = {
  key: string;
  label: string;
  /** Language tag so the operator knows what they are copying. */
  language: 'English' | 'Hinglish' | 'Marathi';
  body: string;
};

export type KitContent = {
  /** Name shown on the printed piece. */
  displayName: string;
  headline: string;
  subhead: string;
  qrCaption: string;
  footerNote: string;
  /** What this vertical calls the printed piece: "table card", "counter card"… */
  assetLabel: string;
  /** Where the operator should physically put it. */
  placement: string;
  /** When staff should mention it. */
  moment: string;
  /** Copyable messages, already resolved — no tokens left in the body. */
  messages: KitMessage[];
  /** The staff line to say out loud, from the vertical playbook. */
  staffScript: {
    english: string;
    hinglish: string;
    marathi: string;
    when: string;
  };
  /** Non-negotiable rules for this vertical — no incentives, no gating. */
  rules: string[];
  /** The destination encoded in the QR, or null when not supplied yet. */
  reviewUrl: string | null;
};

// ---------------------------------------------------------------------------
// URL safety
// ---------------------------------------------------------------------------

export type UrlCheck =
  | { ok: true; url: string }
  | { ok: false; reason: string };

/**
 * Validates an operator-supplied destination.
 *
 * RepOS never derives, discovers or fetches this URL — it is typed in by hand.
 * Validation exists to stop a typo being printed onto a hundred cards, and to
 * refuse schemes that would be unsafe to encode into a QR that strangers scan.
 */
export function checkReviewUrl(raw: string | null | undefined): UrlCheck {
  const value = (raw ?? '').trim();
  if (value.length === 0) {
    return { ok: false, reason: 'No link has been added yet.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      ok: false,
      reason: 'That is not a complete link. It needs to start with https://',
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      ok: false,
      reason: `Links must start with https:// — "${parsed.protocol}" cannot be printed on a customer-facing card.`,
    };
  }

  if (parsed.hostname.length === 0) {
    return { ok: false, reason: 'That link has no website address in it.' };
  }

  return { ok: true, url: parsed.toString() };
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export type KitBlocker = {
  key: string;
  label: string;
  hint: string;
};

export type KitReadiness = {
  ready: boolean;
  /** "READY" or "NEEDS ONE THING" / "NEEDS 2 THINGS". */
  label: string;
  headline: string;
  blockers: KitBlocker[];
};

/**
 * A kit is ready when it has a business name and a valid destination. That is
 * deliberately the whole list: everything else has a vertical default, so the
 * operator is never blocked on a decision RepOS can make for them.
 */
export function computeReadiness(input: {
  businessName: string;
  reviewUrl: string | null | undefined;
}): KitReadiness {
  const blockers: KitBlocker[] = [];

  if (input.businessName.trim().length === 0) {
    blockers.push({
      key: 'businessName',
      label: 'Add the business name',
      hint: 'This is the name printed on the card.',
    });
  }

  const url = checkReviewUrl(input.reviewUrl);
  if (!url.ok) {
    blockers.push({
      key: 'reviewUrl',
      label: 'Add the public review link',
      hint: `${url.reason} Open the business's public listing yourself, copy the "write a review" link, and paste it here. RepOS never looks it up for you.`,
    });
  }

  if (blockers.length === 0) {
    return {
      ready: true,
      label: 'READY',
      headline: 'This kit is ready to print and hand over.',
      blockers,
    };
  }

  const first = blockers[0] as KitBlocker;
  return {
    ready: false,
    label: blockers.length === 1 ? 'NEEDS ONE THING' : `NEEDS ${blockers.length} THINGS`,
    headline:
      blockers.length === 1
        ? `Needs one thing: ${first.label.toLowerCase()}.`
        : `Needs ${blockers.length} things before this kit can be printed.`,
    blockers,
  };
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/** Replaces {{businessName}} / {{reviewUrl}} tokens. Unknown tokens are left alone. */
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] ?? '' : match,
  );
}

function contentTemplate(pack: Pack, key: string): string | undefined {
  return pack.contentTemplates.find((t) => t.key === key)?.body;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
}

/**
 * Builds every piece of copy the kit needs for one client.
 *
 * Precedence at each slot: operator override -> vertical `kit` block ->
 * vertical contentTemplates -> a neutral generic default. The generic tier
 * exists so a pack written before M3 still produces a usable kit rather than
 * blank boxes.
 */
export function buildKitContent(input: KitInput): KitContent {
  const { pack } = input;
  const kit = pack.kit;

  const displayName = firstNonEmpty(input.displayName, input.businessName);
  const urlCheck = checkReviewUrl(input.reviewUrl);
  const reviewUrl = urlCheck.ok ? urlCheck.url : null;

  const vars = {
    businessName: displayName,
    reviewUrl: reviewUrl ?? '[add your public review link]',
  };

  const headline = firstNonEmpty(
    input.headline,
    kit?.headline,
    contentTemplate(pack, 'counter_card_headline'),
    'How did we do?',
  );

  const subhead = firstNonEmpty(
    input.subhead,
    kit?.subhead,
    contentTemplate(pack, 'counter_card_subhead'),
    'Scan and tell us honestly. It takes a minute.',
  );

  const messages: KitMessage[] = [];
  const pushMessage = (
    key: string,
    label: string,
    language: KitMessage['language'],
    body: string | undefined,
  ) => {
    const resolved = firstNonEmpty(body);
    if (resolved.length === 0) return;
    messages.push({
      key,
      label,
      language,
      body: renderTemplate(resolved, vars),
    });
  };

  pushMessage(
    'ask_english',
    'Message to send',
    'English',
    kit?.askMessage ??
      'Thank you for choosing {{businessName}}. If you have a minute, we would really value your honest feedback: {{reviewUrl}}',
  );
  pushMessage('ask_hinglish', 'Message to send', 'Hinglish', kit?.askMessageHinglish);
  pushMessage('ask_marathi', 'Message to send', 'Marathi', kit?.askMessageMarathi);

  return {
    displayName,
    headline: renderTemplate(headline, vars),
    subhead: renderTemplate(subhead, vars),
    qrCaption: firstNonEmpty(kit?.qrCaption, 'Scan to leave an honest review'),
    footerNote: renderTemplate(
      firstNonEmpty(input.footerNote, kit?.thankYou, 'Thank you.'),
      vars,
    ),
    assetLabel: firstNonEmpty(kit?.assetLabel, 'counter card'),
    placement: firstNonEmpty(
      kit?.placement,
      'Somewhere the customer looks while they are paying.',
    ),
    moment: firstNonEmpty(pack.staffAskScript.when, kit?.moment, ''),
    messages,
    staffScript: {
      english: renderTemplate(pack.staffAskScript.line, vars),
      hinglish: renderTemplate(pack.staffAskScript.hinglishLine, vars),
      marathi: renderTemplate(pack.staffAskScript.marathiLine, vars),
      when: firstNonEmpty(kit?.moment, pack.staffAskScript.when),
    },
    rules: pack.staffAskScript.doNot,
    reviewUrl,
  };
}
