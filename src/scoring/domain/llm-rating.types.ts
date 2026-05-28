import type { RiskLevel } from '../../shared/domain/risk-level';

/** Criteria scored by the LLM from listing JSON + snippet. */
export const LLM_RATING_LLM_KEYS = [
  'budgetFit',
  'sizeForFamily',
  'targetZone',
  'dataComplete',
  'costClarity',
  'notStudentShared',
  'layoutFit',
  'listingTrust',
  'descriptionQuality',
] as const;

/** All ten criteria including server-computed proximity. */
export const LLM_RATING_KEYS = [
  ...LLM_RATING_LLM_KEYS,
  'proximityToReference',
] as const;

export type LlmRatingLlmKey = (typeof LLM_RATING_LLM_KEYS)[number];
export type LlmRatingKey = (typeof LLM_RATING_KEYS)[number];

export type LlmCriteriaScores = Record<LlmRatingKey, number>;

export interface LlmRatingResult {
  /** Sum of 10 criteria (each 0–10) → 0–100. */
  compositeScore: number;
  criteria: LlmCriteriaScores;
  summary?: string;
  riskLevel: RiskLevel;
  riskReasons: string[];
  /** Human-readable lines for ListingScore.reasons */
  displayReasons: string[];
}
