import type { AnalysisResult } from '@/lib/analysis/aggregate';
import { runCompletion } from './index';
import { extractJson } from './types';
import { collectAllowedNumbers, guardFields } from './numeric-guard';

/**
 * Report prose.
 *
 * The deterministic template below is the source of truth and always runs. If
 * an AI provider is configured, it is offered the chance to rewrite the same
 * findings more naturally — but only through the numeric guard, and only using
 * figures the analysis already computed.
 */

export type Narrative = {
  healthHeadline: string;
  opportunityNote: string;
  praiseSummary: string;
  complaintSummary: string;
  emergingSummary: string;
  actionRationale: string;
};

export type NarrativeContext = {
  businessName: string;
  areaLabel: string | null;
  verticalLabel: string;
  languageMix: string;
  formality: string;
};

export type NarrativeResult = {
  narrative: Narrative;
  source: 'TEMPLATE' | `AI:${string}`;
  model: string | null;
  notes: string[];
};

function list(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] as string;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function themeSentence(
  themes: AnalysisResult['issues'],
  total: number,
  verb: string,
): string {
  const qualifying = themes.filter((t) => t.qualifies).slice(0, 3);
  if (qualifying.length === 0) return '';
  const parts = qualifying.map(
    (t) => `${t.label.toLowerCase()} (${t.count} of ${total})`,
  );
  return `Customers ${verb} ${list(parts)}.`;
}

/** Deterministic prose built only from the analysis object. */
export function templateNarrative(
  analysis: AnalysisResult,
  ctx: NarrativeContext,
): Narrative {
  const total = analysis.totals.reviewsAnalysed;

  const healthParts: string[] = [];
  healthParts.push(
    analysis.starDistribution === null
      ? `${ctx.businessName} snapshot taken with no star ratings supplied in the pasted feedback.`
      : `${ctx.businessName} snapshot covers ${total} review${total === 1 ? '' : 's'}, ${analysis.totals.withStars} of which carried a star rating.`,
  );
  healthParts.push(analysis.responseGap.statement);
  if (analysis.competitorSummary) healthParts.push(analysis.competitorSummary);

  const opportunityNote = analysis.clearestOpportunity
    ? `${analysis.clearestOpportunity.label}. ${analysis.clearestOpportunity.detail}`
    : 'No single opportunity stands out from the data entered this month.';

  let praiseSummary: string;
  if (!analysis.evidence.canClaimThemes) {
    praiseSummary = `Not enough feedback to report what customers consistently praise. ${analysis.evidence.statement}`;
  } else {
    const sentence = themeSentence(analysis.praises, total, 'consistently praise');
    praiseSummary =
      sentence ||
      `No praise theme reached the ${analysis.evidence.minMentions}-mention floor this month, so none is claimed.`;
  }

  let complaintSummary: string;
  if (!analysis.evidence.canClaimThemes) {
    complaintSummary = `Not enough feedback to report recurring complaints. ${analysis.evidence.statement}`;
  } else {
    const sentence = themeSentence(analysis.issues, total, 'repeatedly raise');
    complaintSummary =
      sentence ||
      `No complaint theme reached the ${analysis.evidence.minMentions}-mention floor this month, so none is claimed.`;
  }

  const actionRationale = [
    analysis.recommendation.action,
    ...analysis.recommendation.evidence,
    analysis.recommendation.caveat ?? '',
  ]
    .filter((s) => s.length > 0)
    .join(' ');

  return {
    healthHeadline: healthParts.filter((p) => p.length > 0).join(' '),
    opportunityNote,
    praiseSummary,
    complaintSummary,
    emergingSummary: analysis.emerging.statement,
    actionRationale,
  };
}

const SYSTEM_PROMPT = `You are a writing assistant inside RepOS, an internal tool used by a one-person agency in India that reports on customer feedback for local small businesses.

Your ONLY job is wording. You are given a finished analysis object. Every count, share, average, rating, delta and threshold in it was computed by application code.

ABSOLUTE RULES:
1. NEVER invent, estimate, extrapolate or adjust any number. You may only restate figures that appear verbatim in the supplied analysis.
2. NEVER introduce a percentage, count, rating or time period that is not in the analysis.
3. NEVER claim a trend, improvement or decline unless the analysis explicitly provides the comparison.
4. If the analysis says evidence is insufficient, say so plainly. Do not soften it, and do not fill the gap with a guess.
5. Write for a busy business owner: short, concrete, no marketing language, no hype, no emoji.
6. Do not name or invent any customer. The feedback is anonymous by design.
7. British English. 1-3 sentences per field.

Return ONLY a JSON object with exactly these string keys:
healthHeadline, opportunityNote, praiseSummary, complaintSummary, emergingSummary, actionRationale`;

function buildUserPrompt(
  analysis: AnalysisResult,
  ctx: NarrativeContext,
  fallback: Narrative,
): string {
  return [
    `BUSINESS: ${ctx.businessName}`,
    `AREA: ${ctx.areaLabel ?? 'not recorded'}`,
    `VERTICAL: ${ctx.verticalLabel}`,
    `TONE: ${ctx.formality.toLowerCase()}, language mix ${ctx.languageMix.toLowerCase()} (keep the report itself in English; mirror the mix only if it reads naturally)`,
    '',
    'ANALYSIS (the only source of facts and figures):',
    JSON.stringify(analysis, null, 2),
    '',
    'CURRENT DETERMINISTIC WORDING (rewrite this more naturally, keeping every figure exactly as-is):',
    JSON.stringify(fallback, null, 2),
  ].join('\n');
}

/**
 * Produces report prose. Always succeeds: on any AI failure, or on any number
 * the guard cannot verify, the deterministic template is returned instead.
 */
export async function buildNarrative(
  analysis: AnalysisResult,
  ctx: NarrativeContext,
): Promise<NarrativeResult> {
  const fallback = templateNarrative(analysis, ctx);
  const notes: string[] = [];

  const run = await runCompletion({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(analysis, ctx, fallback),
    json: true,
    temperature: 0.25,
    maxOutputTokens: 1400,
  });

  if (!run.ok) {
    notes.push(run.reason);
    notes.push(...run.attempts);
    return { narrative: fallback, source: 'TEMPLATE', model: null, notes };
  }

  const parsed = extractJson(run.text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    notes.push('AI response was not a usable JSON object; kept deterministic wording.');
    return { narrative: fallback, source: 'TEMPLATE', model: null, notes };
  }

  const allowed = collectAllowedNumbers({ analysis, fallback });
  const guarded = guardFields(
    parsed as Partial<Record<keyof Narrative, unknown>>,
    fallback,
    allowed,
  );

  if (guarded.rejected.length > 0) {
    notes.push(
      `Numeric guard rejected AI wording for: ${guarded.rejected.join('; ')}. Those fields kept the deterministic wording.`,
    );
  }

  return {
    narrative: guarded.value,
    source: `AI:${run.providerId}`,
    model: run.model,
    notes,
  };
}
