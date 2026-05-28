import {
  applyProximityToLlmResult,
  compositeScoreFromCriteria,
  injectProximityScore,
  parseCriteriaScores,
  parseLlmRatingResponse,
} from './llm-rating.parser';
import { LLM_RATING_KEYS } from './llm-rating.types';

const defs = LLM_RATING_KEYS.map((key) => ({
  key,
  label: key,
}));

describe('llm-rating.parser', () => {
  it('parses nine LLM criteria and defaults proximity to 0', () => {
    const raw: Record<string, number | string | string[]> = {
      budgetFit: 8,
      sizeForFamily: 9,
      targetZone: 7,
      dataComplete: 8,
      costClarity: 6,
      notStudentShared: 10,
      layoutFit: 8,
      listingTrust: 7,
      descriptionQuality: 2,
      summary: 'Good fit',
      riskLevel: 'none',
      riskReasons: [],
    };
    const scores = parseCriteriaScores(raw);
    expect(scores.proximityToReference).toBe(0);
    expect(compositeScoreFromCriteria(scores)).toBe(65);
    const result = parseLlmRatingResponse(raw, defs);
    expect(result?.compositeScore).toBe(65);
    expect(result?.displayReasons[0]).toContain('65/100');
  });

  it('injects proximity score server-side', () => {
    const raw = Object.fromEntries(
      LLM_RATING_KEYS.filter((k) => k !== 'proximityToReference').map((k) => [
        k,
        5,
      ]),
    ) as Record<string, number>;
    const base = parseLlmRatingResponse(raw, defs);
    expect(base).not.toBeNull();
    const withProximity = applyProximityToLlmResult(base!, 9, defs);
    expect(withProximity.criteria.proximityToReference).toBe(9);
    expect(withProximity.compositeScore).toBe(54);
  });

  it('clamps scores to 0-10', () => {
    const scores = parseCriteriaScores({
      budgetFit: 15,
      sizeForFamily: -1,
    });
    expect(scores.budgetFit).toBe(10);
    expect(scores.sizeForFamily).toBe(0);
    expect(injectProximityScore(scores, 11).proximityToReference).toBe(10);
  });
});
