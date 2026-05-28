import type { RiskLevel } from '../../shared/domain/risk-level';
import type { LlmRatingCriterion } from '../../shared/infrastructure/criteria.types';
import {
  LLM_RATING_KEYS,
  LLM_RATING_LLM_KEYS,
  type LlmCriteriaScores,
  type LlmRatingKey,
  type LlmRatingResult,
} from './llm-rating.types';

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}

export function parseCriteriaScores(
  raw: Record<string, unknown>,
): LlmCriteriaScores {
  const out = {} as LlmCriteriaScores;
  for (const key of LLM_RATING_LLM_KEYS) {
    const v = raw[key];
    out[key] = clampScore(typeof v === 'number' ? v : Number(v));
  }
  out.proximityToReference = 0;
  return out;
}

export function injectProximityScore(
  criteria: LlmCriteriaScores,
  proximityScore: number,
): LlmCriteriaScores {
  return { ...criteria, proximityToReference: clampScore(proximityScore) };
}

export function applyProximityToLlmResult(
  llm: LlmRatingResult,
  proximityScore: number,
  definitions: LlmRatingCriterion[],
): LlmRatingResult {
  const criteria = injectProximityScore(llm.criteria, proximityScore);
  return {
    ...llm,
    criteria,
    compositeScore: compositeScoreFromCriteria(criteria),
    displayReasons: formatCriteriaReasons(criteria, definitions),
  };
}

export function compositeScoreFromCriteria(
  criteria: LlmCriteriaScores,
): number {
  let sum = 0;
  for (const key of LLM_RATING_KEYS) {
    sum += criteria[key];
  }
  return Math.max(0, Math.min(100, sum));
}

export function formatCriteriaReasons(
  criteria: LlmCriteriaScores,
  definitions: LlmRatingCriterion[],
): string[] {
  const labelByKey = new Map(definitions.map((d) => [d.key, d.label]));
  const parts = LLM_RATING_KEYS.map((key) => {
    const label = labelByKey.get(key) ?? key;
    return `${label} ${criteria[key]}/10`;
  });
  const composite = compositeScoreFromCriteria(criteria);
  return [`🤖 AI (${composite}/100): ${parts.join(', ')}`];
}

export function parseLlmRatingResponse(
  parsed: Record<string, unknown>,
  definitions: LlmRatingCriterion[],
): LlmRatingResult | null {
  const criteria = parseCriteriaScores(parsed);
  const sum = LLM_RATING_LLM_KEYS.reduce((acc, k) => acc + criteria[k], 0);
  if (sum === 0 && !LLM_RATING_LLM_KEYS.some((k) => parsed[k] != null)) {
    return null;
  }

  const riskLevel = (parsed.riskLevel as RiskLevel) ?? 'none';
  const riskReasons = Array.isArray(parsed.riskReasons)
    ? (parsed.riskReasons as unknown[]).map(String)
    : [];
  const summary =
    typeof parsed.summary === 'string' ? parsed.summary.trim() : undefined;

  return {
    compositeScore: compositeScoreFromCriteria(criteria),
    criteria,
    summary,
    riskLevel,
    riskReasons,
    displayReasons: formatCriteriaReasons(criteria, definitions),
  };
}

export function listingPayloadForPrompt(listing: {
  title?: string;
  rentEur?: number;
  condoFeeEur?: number;
  areaSqm?: number;
  rooms?: number;
  locationHint?: string;
  rawSnippet?: string;
}): Record<string, unknown> {
  return {
    title: listing.title,
    rentEur: listing.rentEur,
    condoFeeEur: listing.condoFeeEur,
    totalCostEur:
      listing.rentEur != null && listing.condoFeeEur != null
        ? listing.rentEur + listing.condoFeeEur
        : listing.rentEur,
    areaSqm: listing.areaSqm,
    rooms: listing.rooms,
    location: listing.locationHint,
    snippet: listing.rawSnippet?.slice(0, 800),
  };
}

export function interpolatePrompt(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

export function isLlmRatingKey(key: string): key is LlmRatingKey {
  return (LLM_RATING_KEYS as readonly string[]).includes(key);
}
