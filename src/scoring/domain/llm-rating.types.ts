import type { RiskLevel } from '../../shared/domain/risk-level';

/** JSON keys returned by the model (stable English identifiers). */
export const LLM_RATING_KEYS = [
  'price',
  'quality',
  'value',
  'metroProximity',
  'centerProximity',
  'greenAreas',
  'infrastructure',
  'quietSafe',
  'livingArea',
  'piazzaRivoliProximity',
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
