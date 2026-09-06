import { describe, expect, it } from 'vitest';
import { getPackOrFallback, listPacks, _resetPackCache } from '@/lib/packs';
import { normalizeFeedback } from '@/lib/analysis/normalize';
import {
  TRIAGE_VERSION,
  bandFor,
  classifyResponse,
  responseActionLabel,
  responseClassLabel,
  triageFeedback,
  wantsDraft,
} from './triage';
import { checkDraft } from './safety';
import { resolveVoice, draftLanguageFor, splitList } from './voice';
import { DRAFT_VERSION, draftReply, templateDraft, type DraftContext } from './draft';

_resetPackCache();

const clinic = getPackOrFallback('clinic');
const salon = getPackOrFallback('salon');
const restaurant = getPackOrFallback('restaurant');

const NOW = new Date('2026-03-16T00:00:00.000Z');
const RECENT = new Date('2026-03-10T00:00:00.000Z');
const OLD = new Date('2025-06-01T00:00:00.000Z');

function analyse(text: string, stars: number | null, pack = clinic) {
  return normalizeFeedback({ text, stars, pack, ai: null });
}

/** Triage exactly as the service does: from the stored analysis, never re-read. */
function triage(
  text: string,
  stars: number | null,
  pack = clinic,
  reviewDate: Date | null = RECENT,
) {
  const normalized = analyse(text, stars, pack);
  return triageFeedback({
    text,
    stars,
    reviewDate,
    sentiment: normalized.sentiment,
    confidence: normalized.confidence,
    themes: normalized.themes,
    pack,
    now: NOW,
  });
}

function voiceFor(pack = clinic, businessName = 'Sunrise Dental Clinic') {
  return resolveVoice(pack, { businessName, vertical: pack.id }, null, null);
}

function contextFor(
  text: string,
  stars: number | null,
  pack = clinic,
  businessName = 'Sunrise Dental Clinic',
): DraftContext {
  const normalized = analyse(text, stars, pack);
  const result = triage(text, stars, pack);
  return {
    pack,
    voice: voiceFor(pack, businessName),
    text,
    stars,
    sentiment: normalized.sentiment,
    themes: normalized.themes,
    responseClass: result.responseClass,
    detectedLanguage: normalized.language,
  };
}

// ---------------------------------------------------------------------------

describe('what kind of message this is', () => {
  it('reads praise as praise', () => {
    const result = triage('Doctor explained everything clearly and the clinic was very clean', 5);
    expect(result.responseClass).toBe('PRAISE');
  });

  it('reads a complaint as a complaint', () => {
    const result = triage('Waited over an hour and reception was rude when I asked', 1);
    expect(result.responseClass).toBe('COMPLAINT');
  });

  it('reads praise-with-a-problem as mixed', () => {
    const result = triage('The doctor was good but the wait was long', 3);
    expect(result.responseClass).toBe('MIXED');
  });

  it('reads a question as a question, even inside praise', () => {
    const result = triage('Lovely clinic. Do you open on Sundays?', 5);
    expect(result.responseClass).toBe('QUESTION');
  });

  it('reads a request as a question', () => {
    const result = triage('Please let me know how much a root canal costs', null);
    expect(result.responseClass).toBe('QUESTION');
  });

  it('reads a question written in Marathi', () => {
    const result = triage('तुमची क्लिनिक रविवारी कधी उघडी असते', null);
    expect(result.responseClass).toBe('QUESTION');
  });

  it('reads a question written in romanised Hinglish', () => {
    const result = triage('Kya aap Sunday ko khule rehte ho', null);
    expect(result.responseClass).toBe('QUESTION');
  });

  it('reads a plain remark as a general comment', () => {
    const result = triage('Visited the clinic', null);
    expect(result.responseClass).toBe('NEUTRAL');
  });

  it('never invents a class it was not given', () => {
    expect(classifyResponse({ text: 'ok', sentiment: 'UNCLASSIFIED' })).toBe('NEUTRAL');
  });
});

// ---------------------------------------------------------------------------

describe('whether a reply is worth it', () => {
  it('recommends replying to a complaint', () => {
    expect(triage('The reception was rude and I waited an hour', 1).responseAction).toBe(
      'REPLY_RECOMMENDED',
    );
  });

  it('recommends replying to specific praise', () => {
    expect(
      triage('The doctor explained everything so clearly, thank you', 5).responseAction,
    ).toBe('REPLY_RECOMMENDED');
  });

  it('makes a bare "Good" optional rather than required', () => {
    expect(triage('Good', 5).responseAction).toBe('REPLY_OPTIONAL');
  });

  it('needs no reply for an empty remark with nothing in it', () => {
    expect(triage('ok', null).responseAction).toBe('NO_RESPONSE_NEEDED');
  });

  it('always recommends replying to a question', () => {
    expect(triage('Do you take walk-ins?', null).responseAction).toBe(
      'REPLY_RECOMMENDED',
    );
  });

  it('hands a threat of legal action to the operator', () => {
    const result = triage('This was negligence, I am going to consumer court', 1);
    expect(result.responseAction).toBe('NEEDS_HUMAN');
    expect(result.reasons[0]).toContain('yourself');
  });

  it('hands anything about harm to the operator', () => {
    expect(
      triage('I got an infection after the procedure here', 1).responseAction,
    ).toBe('NEEDS_HUMAN');
  });

  it('hands a demand for money back to the operator', () => {
    expect(triage('Terrible service, I want my money back', 1).responseAction).toBe(
      'NEEDS_HUMAN',
    );
  });

  it('does not flag an ordinary complaint for the operator', () => {
    // A high-severity theme alone must not trip the flag: nearly every
    // complaint carries one, and a flag that always fires says nothing.
    expect(triage('The wait was much too long today', 2).responseAction).toBe(
      'REPLY_RECOMMENDED',
    );
  });

  it('only drafts for the two reply outcomes', () => {
    expect(wantsDraft('REPLY_RECOMMENDED')).toBe(true);
    expect(wantsDraft('REPLY_OPTIONAL')).toBe(true);
    expect(wantsDraft('NEEDS_HUMAN')).toBe(false);
    expect(wantsDraft('NO_RESPONSE_NEEDED')).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('priority is explainable, never a score from nowhere', () => {
  it('puts a serious complaint above generic praise', () => {
    const complaint = triage('Waited over an hour and the reception was rude', 1);
    const praise = triage('Good', 5);
    expect(complaint.priorityRank).toBeGreaterThan(praise.priorityRank);
    expect(complaint.priorityBand).toBe('HIGH');
  });

  it('keeps positive feedback visible rather than at zero', () => {
    const praise = triage('The doctor explained everything clearly, thank you', 5);
    expect(praise.priorityRank).toBeGreaterThan(0);
    expect(praise.priorityBand).not.toBe('NONE');
  });

  it('gives every point a reason the operator can read', () => {
    const result = triage('Waited over an hour and the reception was rude', 1);
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.reasons.length).toBe(result.signals.length);
    for (const signal of result.signals) {
      expect(signal.reason.length).toBeGreaterThan(0);
      expect(signal.weight).toBeGreaterThan(0);
    }
    // The rank is the sum of the named signals and nothing else.
    expect(result.priorityRank).toBe(
      result.signals.reduce((sum, s) => sum + s.weight, 0),
    );
  });

  it('uses no model, no probability and no hidden score', () => {
    const result = triage('The wait was long', 2);
    const serialised = JSON.stringify(result);
    expect(serialised).not.toMatch(/probability|score|model|confidence_score/i);
  });

  it('ranks a recent review above the same review from last year', () => {
    const recent = triage('The wait was long', 2, clinic, RECENT);
    const old = triage('The wait was long', 2, clinic, OLD);
    expect(recent.priorityRank).toBeGreaterThan(old.priorityRank);
  });

  it('bands on fixed thresholds', () => {
    expect(bandFor(0)).toBe('NONE');
    expect(bandFor(5)).toBe('LOW');
    expect(bandFor(20)).toBe('MEDIUM');
    expect(bandFor(60)).toBe('HIGH');
  });

  it('is stable for the same input', () => {
    const a = triage('The wait was long but the doctor was good', 3);
    const b = triage('The wait was long but the doctor was good', 3);
    expect(a).toEqual(b);
    expect(a.version).toBe(TRIAGE_VERSION);
  });
});

// ---------------------------------------------------------------------------

describe('the same engine writes for every vertical', () => {
  it('sounds like a clinic', () => {
    const draft = templateDraft(
      contextFor('Waited over an hour past my appointment', 2, clinic, 'Sunrise Dental Clinic'),
    );
    expect(draft.text).toContain('Sunrise Dental Clinic');
    expect(draft.text.toLowerCase()).toContain('the wait past your appointment time');
  });

  it('sounds like a salon', () => {
    const draft = templateDraft(
      contextFor('Great haircut, the stylist listened to me', 5, salon, 'Glow Salon'),
    );
    expect(draft.text).toContain('Glow Salon');
    // The salon pack speaks Hinglish, so the reply does too — and still names
    // the specific thing rather than thanking them in general.
    expect(draft.language).toBe('HINGLISH');
    expect(draft.text.toLowerCase()).toContain('stylist ne');
  });

  it('sounds like a restaurant', () => {
    const draft = templateDraft(
      contextFor('Food was excellent but the service was very slow', 3, restaurant, 'Corner Cafe'),
    );
    expect(draft.text).toContain('Corner Cafe');
    const lower = draft.text.toLowerCase();
    expect(lower).toContain('khana pasand aaya');
    expect(lower).toContain('service mein lage waqt');
  });

  it('never drops a category label into a sentence a customer reads', () => {
    // "We are sorry about appointment / waiting problems" is how a machine
    // writes. Category labels and their slashes must never reach a customer.
    for (const pack of listPacks()) {
      for (const text of [
        'Waited over an hour and nobody explained why',
        'Everything was lovely, thank you so much',
        'Good in parts but the wait was too long',
      ]) {
        const draft = templateDraft(contextFor(text, 2, pack, 'Test Business'));
        expect(draft.text, `${pack.id}: ${draft.text}`).not.toMatch(/ \/ /);
        for (const entry of [...pack.issueTaxonomy, ...pack.praiseTaxonomy]) {
          expect(
            draft.text.toLowerCase(),
            `${pack.id} leaked "${entry.label}"`,
          ).not.toContain(entry.label.toLowerCase());
        }
      }
    }
  });

  it('runs through the same code path for all seven verticals', () => {
    for (const pack of listPacks()) {
      const draft = templateDraft(
        contextFor('Very poor experience, nobody helped us', 1, pack, 'Test Business'),
      );
      expect(draft.text.length, pack.id).toBeGreaterThan(20);
      expect(draft.source, pack.id).toBe('TEMPLATE');
      expect(draft.version, pack.id).toBe(DRAFT_VERSION);
      // No blocking safety problem may survive in a deterministic draft.
      expect(
        draft.problems.filter((p) => p.blocking),
        `${pack.id}: ${JSON.stringify(draft.problems)}`,
      ).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------

describe('the reply answers what was actually said', () => {
  it('names the thing the customer complained about', () => {
    const draft = templateDraft(contextFor('The clinic was dirty and smelled bad', 1));
    expect(draft.text.toLowerCase()).toContain('the state of the clinic');
  });

  it('names the thing the customer praised', () => {
    const draft = templateDraft(
      contextFor('The doctor explained everything so clearly', 5),
    );
    expect(draft.text.toLowerCase()).toContain('the doctor took the time to explain');
  });

  it('acknowledges both halves of a mixed review', () => {
    const draft = templateDraft(
      contextFor('The doctor was good but the wait was far too long', 3),
    );
    const lower = draft.text.toLowerCase();
    expect(lower).toContain('the doctor took the time to explain');
    expect(lower).toContain('the wait past your appointment time');
  });

  it('names one thing rather than listing everything', () => {
    // Three problems in one review; the reply acknowledges the worst one and
    // does not read out an inventory.
    const draft = templateDraft(
      contextFor('Waited over an hour, the reception was rude, and the bill was wrong', 1),
    );
    expect(draft.text.match(/we are sorry/gi)?.length ?? 0).toBe(1);
  });

  it('does not try to answer a question it cannot answer', () => {
    const draft = templateDraft(contextFor('Do you open on Sundays?', null));
    expect(draft.text.toLowerCase()).toContain('contact us directly');
    expect(draft.text.toLowerCase()).not.toContain('sunday');
  });

  it('does not repeat the review back', () => {
    const review = 'Waited over an hour past my appointment and nobody explained why at all';
    const draft = templateDraft(contextFor(review, 1));
    expect(draft.text).not.toContain(review);
  });

  it('stays short', () => {
    const draft = templateDraft(
      contextFor('The doctor was good but the wait was far too long', 3),
    );
    expect(draft.text.split(/\s+/).length).toBeLessThan(80);
  });
});

// ---------------------------------------------------------------------------

describe('the reply follows the language the business uses', () => {
  it('writes English by default', () => {
    expect(draftLanguageFor(voiceFor(clinic), 'en')).toBe('ENGLISH');
  });

  it('follows the customer when the business says "match them"', () => {
    const voice = { ...voiceFor(clinic), languageMix: 'MIXED' as const };
    expect(draftLanguageFor(voice, 'mr')).toBe('MARATHI');
    expect(draftLanguageFor(voice, 'mixed')).toBe('HINGLISH');
    expect(draftLanguageFor(voice, 'en')).toBe('ENGLISH');
  });

  it('writes a Marathi reply in Devanagari', () => {
    const context = contextFor('डॉक्टर छान आहेत पण खूप वेळ लागला', 3);
    const draft = templateDraft({
      ...context,
      voice: { ...context.voice, languageMix: 'MARATHI' },
    });
    expect(draft.language).toBe('MARATHI');
    expect(draft.text).toMatch(/[ऀ-ॿ]/);
    // Marathi names the point in Marathi, not with an English category name.
    // The business name stays as it is written, so only the body is checked.
    expect(draft.text).toContain('उशिरा');
    const body = draft.text.split('\n')[0] ?? '';
    expect(body).not.toMatch(/[A-Za-z]{4,}/);
  });

  it('writes a Hinglish reply in Latin script, not Devanagari', () => {
    const context = contextFor('Bahut wait karna pada lekin doctor accha tha', 3);
    const draft = templateDraft({
      ...context,
      voice: { ...context.voice, languageMix: 'HINGLISH' },
    });
    expect(draft.language).toBe('HINGLISH');
    expect(draft.text).not.toMatch(/[ऀ-ॿ]/);
    expect(draft.text.toLowerCase()).toContain('dhanyawaad');
    expect(draft.text.toLowerCase()).toContain('lambe intezaar');
  });
});

// ---------------------------------------------------------------------------

describe('voice comes from the client, then the pack', () => {
  it('falls back to the pack when the client left it blank', () => {
    const voice = resolveVoice(clinic, { businessName: 'X', vertical: 'clinic' }, null, null);
    expect(voice.formality).toBe(clinic.voicePreset.formality);
    expect(voice.greeting).toBe(clinic.voicePreset.greeting);
  });

  it('uses the client wording when they typed some', () => {
    const voice = resolveVoice(
      clinic,
      { businessName: 'X', vertical: 'clinic' },
      { formality: 'CASUAL', greeting: 'Hey, thanks for this.' },
      null,
    );
    expect(voice.formality).toBe('CASUAL');
    expect(voice.greeting).toBe('Hey, thanks for this.');
  });

  it('merges banned words instead of letting a client unban the pack list', () => {
    const voice = resolveVoice(
      clinic,
      { businessName: 'X', vertical: 'clinic' },
      { bannedWords: 'sorted\nquick fix' },
      null,
    );
    // The pack's medical bans survive alongside the client's own additions.
    expect(voice.bannedWords).toContain('cure');
    expect(voice.bannedWords).toContain('guaranteed');
    expect(voice.bannedWords).toContain('sorted');
  });

  it('reads a list however the operator typed it', () => {
    expect(splitList('one\ntwo, three\n\n')).toEqual(['one', 'two', 'three']);
    expect(splitList(null)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('safety refuses what must never be published', () => {
  const context = {
    voice: voiceFor(),
    sourceText: 'Waited over an hour past my appointment',
    allowedContext: [],
  };

  const blocked = (draft: string, code: string) => {
    const result = checkDraft(draft, context);
    expect(result.ok, draft).toBe(false);
    expect(result.storable, draft).toBe(false);
    expect(result.problems.map((p) => p.code), draft).toContain(code);
  };

  it('refuses to ask for a five-star rating', () => {
    blocked('Thank you. Please give us a 5 star rating if you were happy.', 'incentive');
  });

  it('refuses to ask for a review to be changed', () => {
    blocked('Sorry about that. Could you update your review once resolved?', 'incentive');
  });

  it('refuses to ask for a review to be removed', () => {
    blocked('We are sorry. Please remove your review.', 'incentive');
  });

  it('refuses to trade anything for a review', () => {
    blocked('Thanks! Here is a free consultation for writing a review.', 'incentive');
  });

  it('refuses to promise a refund', () => {
    blocked('We are sorry about the wait. We will refund you in full.', 'unsafe_promise');
  });

  it('refuses to promise compensation', () => {
    blocked('Sorry about this. We will compensate you for the trouble.', 'unsafe_promise');
  });

  it('refuses to claim someone was sacked', () => {
    blocked('We are sorry. We have fired the receptionist responsible.', 'unsafe_promise');
  });

  it('refuses to invent an operational change', () => {
    blocked('Thank you for telling us. We have hired more staff to fix this.', 'unsafe_promise');
  });

  it('refuses a legal admission', () => {
    blocked('We accept full liability for what happened to you.', 'unsafe_promise');
  });

  it('refuses a medical claim', () => {
    blocked('Thank you. Our treatment will cure this permanently.', 'banned_word');
  });

  it('refuses to confirm anyone treatment details in public', () => {
    blocked(
      'Thank you for visiting. Your diagnosis was straightforward and we are pleased.',
      'medical',
    );
  });

  it('refuses to leak a phone number', () => {
    blocked('Sorry about the wait. Please call us on 9876543210.', 'pii');
  });

  it('refuses to leak an email address', () => {
    blocked('Sorry about the wait. Write to us at care@example.com.', 'pii');
  });

  it('refuses a link', () => {
    blocked('Sorry about that. See https://example.com/contact for help.', 'link');
  });

  it('refuses to mention Headway or its analysis', () => {
    blocked('Our analysis classified this as negative. We are sorry.', 'internal');
  });

  it('refuses to admit it was machine-written', () => {
    blocked('As an AI, I apologise for the wait you experienced.', 'internal');
  });

  it('refuses a word the business banned', () => {
    blocked('Thank you. This treatment is guaranteed to work for you.', 'banned_word');
  });

  it('refuses a word the business policy says never to use', () => {
    const result = checkDraft('We are sorry, we will do a free redo for you.', {
      voice: { ...voiceFor(), neverPromise: ['free redo'] },
      sourceText: 'bad haircut',
      allowedContext: [],
    });
    expect(result.storable).toBe(false);
    expect(result.problems.map((p) => p.code)).toContain('banned_word');
  });

  it('flags a figure that came from nowhere', () => {
    const result = checkDraft(
      'Thank you for telling us. We keep waits under 15 minutes.',
      context,
    );
    expect(result.ok).toBe(false);
    expect(result.problems.map((p) => p.code)).toContain('invented_number');
  });

  it('allows a figure the customer themselves used', () => {
    const result = checkDraft('Thank you. An hour is far too long, and we are sorry.', {
      ...context,
      sourceText: 'Waited over an hour, 60 minutes at least',
    });
    expect(result.problems.map((p) => p.code)).not.toContain('invented_number');
  });

  it('flags a time frame nobody promised', () => {
    const result = checkDraft(
      'Thank you for telling us. Someone will call you within two days.',
      context,
    );
    expect(result.problems.map((p) => p.code)).toContain('invented_commitment');
  });

  it('flags a reply that just repeats the review', () => {
    const source = 'Waited over an hour past my appointment and nobody explained why';
    const result = checkDraft(`Thank you for telling us. ${source}. We are sorry.`, {
      ...context,
      sourceText: source,
    });
    expect(result.problems.map((p) => p.code)).toContain('parrots');
  });

  it('accepts a good reply cleanly', () => {
    const result = checkDraft(
      'Thank you for telling us. We are sorry the wait was longer than it should have been. Please get in touch and mention your visit so we can look at what happened.\n\n— Team Sunrise Dental Clinic',
      context,
    );
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it('separates "cannot store" from "worth another look"', () => {
    // An invented figure is a warning on text a human typed; an incentive
    // never is.
    const warning = checkDraft('Thank you. We aim for under 15 minutes always here.', context);
    expect(warning.storable).toBe(true);
    expect(warning.ok).toBe(false);

    const refusal = checkDraft('Thank you. Please leave us a 5 star review.', context);
    expect(refusal.storable).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('healthcare replies stay general', () => {
  it('never lets the clinic pack produce a medical claim', () => {
    for (const text of [
      'The treatment did not work for me at all',
      'Doctor was excellent and I feel much better',
      'I am still in pain after the procedure',
    ]) {
      const draft = templateDraft(contextFor(text, 2));
      const result = checkDraft(draft.text, {
        voice: voiceFor(),
        sourceText: text,
        allowedContext: [],
      });
      expect(result.problems.filter((p) => p.blocking), text).toEqual([]);
      expect(draft.text.toLowerCase()).not.toMatch(/cure|diagnos|prescription|test result/);
    }
  });

  it('keeps the pack medical bans in force for every clinic client', () => {
    expect(voiceFor().bannedWords).toEqual(
      expect.arrayContaining(['cure', 'guaranteed', '100% safe']),
    );
  });
});

// ---------------------------------------------------------------------------

describe('AI is optional and never trusted', () => {
  const context = () => contextFor('The wait was far too long today', 2);

  it('writes deterministically when AI is switched off', async () => {
    const outcome = await draftReply(context(), { useAi: false });
    expect(outcome.source).toBe('TEMPLATE');
    expect(outcome.text.length).toBeGreaterThan(20);
  });

  it('writes deterministically when there is no drafter at all', async () => {
    const outcome = await draftReply(context(), { useAi: true });
    expect(outcome.source).toBe('TEMPLATE');
  });

  it('uses a clean assisted draft when it gets one', async () => {
    const outcome = await draftReply(context(), {
      useAi: true,
      drafter: async () => ({
        ok: true,
        text: 'Thank you for telling us. We are sorry the wait was longer than it should have been, and we are looking at it.',
        model: 'test-model',
      }),
    });
    expect(outcome.source).toBe('AI');
    expect(outcome.problems).toEqual([]);
  });

  it('falls back when the provider fails', async () => {
    const outcome = await draftReply(context(), {
      useAi: true,
      drafter: async () => ({ ok: false, reason: 'the provider returned HTTP 503' }),
    });
    expect(outcome.source).toBe('TEMPLATE');
    expect(outcome.notes.join(' ')).toContain('503');
  });

  it('falls back when the provider throws', async () => {
    const outcome = await draftReply(context(), {
      useAi: true,
      drafter: async () => {
        throw new Error('socket hang up');
      },
    });
    expect(outcome.source).toBe('TEMPLATE');
    expect(outcome.notes.join(' ')).toContain('socket hang up');
  });

  it('discards an assisted draft that asks for a review', async () => {
    const outcome = await draftReply(context(), {
      useAi: true,
      drafter: async () => ({
        ok: true,
        text: 'Sorry about that! If we fixed it, please update your review to 5 stars.',
        model: 'test-model',
      }),
    });
    expect(outcome.source).toBe('TEMPLATE');
    expect(outcome.notes.join(' ')).toMatch(/discarded/i);
  });

  it('discards an assisted draft that invents a refund', async () => {
    const outcome = await draftReply(context(), {
      useAi: true,
      drafter: async () => ({
        ok: true,
        text: 'We are very sorry about this. We will refund you the full amount today.',
        model: 'test-model',
      }),
    });
    expect(outcome.source).toBe('TEMPLATE');
  });

  it('discards an assisted draft carrying a phone number', async () => {
    const outcome = await draftReply(context(), {
      useAi: true,
      drafter: async () => ({
        ok: true,
        text: 'Sorry about the wait. Please call our manager on 020 4455 6677 to discuss.',
        model: 'test-model',
      }),
    });
    expect(outcome.source).toBe('TEMPLATE');
  });

  it('discards an empty or malformed assisted draft', async () => {
    for (const bad of ['', '   ', 'ok']) {
      const outcome = await draftReply(context(), {
        useAi: true,
        drafter: async () => ({ ok: true, text: bad, model: null }),
      });
      expect(outcome.source, JSON.stringify(bad)).toBe('TEMPLATE');
    }
  });

  it('never fabricates a result when everything failed', async () => {
    const outcome = await draftReply(context(), {
      useAi: true,
      drafter: async () => ({ ok: false, reason: 'no provider configured' }),
    });
    // Fallback, clearly labelled — not a pretend AI answer.
    expect(outcome.source).toBe('TEMPLATE');
    expect(outcome.notes.join(' ')).toMatch(/Headway/);
  });
});

// ---------------------------------------------------------------------------

describe('wording shown to the operator has no jargon', () => {
  it('labels every state in plain words', () => {
    for (const value of ['PRAISE', 'COMPLAINT', 'MIXED', 'QUESTION', 'NEUTRAL']) {
      expect(responseClassLabel(value)).not.toMatch(/_/);
    }
    for (const value of [
      'REPLY_RECOMMENDED',
      'REPLY_OPTIONAL',
      'NO_RESPONSE_NEEDED',
      'NEEDS_HUMAN',
    ]) {
      expect(responseActionLabel(value)).not.toMatch(/_/);
    }
  });

  it('never shows a technical term in a draft note', async () => {
    const outcome = await draftReply(contextFor('The wait was long', 2), {
      useAi: true,
      drafter: async () => ({ ok: false, reason: 'HTTP 500' }),
    });
    expect(outcome.notes.join(' ')).not.toMatch(
      /token|inference|provider|model|embedding|prompt/i,
    );
  });
});
