import type { RiskLevel } from '../../shared/domain/risk-level';

/**
 * Ten practical criteria scoreable from listing JSON + email snippet (no guessed distances).
 */
export const LLM_RATING_KEYS = [
  'budgetFit',
  'sizeForFamily',
  'targetZone',
  'dataComplete',
  'costClarity',
  'notStudentShared',
  'layoutFit',
  'listingTrust',
  'metroLandmark',
  'descriptionQuality',
] as const;

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
