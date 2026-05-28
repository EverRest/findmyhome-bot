import {
  compositeScoreFromCriteria,
  parseCriteriaScores,
  parseLlmRatingResponse,
} from './llm-rating.parser';
import { LLM_RATING_KEYS } from './llm-rating.types';

const defs = LLM_RATING_KEYS.map((key) => ({
  key,
  label: key,
}));

describe('llm-rating.parser', () => {
  it('parses and sums ten criteria', () => {
    const raw: Record<string, number | string | string[]> = {
      budgetFit: 8,
      sizeForFamily: 9,
      targetZone: 7,
      dataComplete: 8,
      costClarity: 6,
      notStudentShared: 10,
      layoutFit: 8,
      listingTrust: 7,
      metroLandmark: 6,
      descriptionQuality: 2,
      summary: 'Good fit',
      riskLevel: 'none',
      riskReasons: [],
    };
    const scores = parseCriteriaScores(raw);
    expect(compositeScoreFromCriteria(scores)).toBe(71);
    const result = parseLlmRatingResponse(raw, defs);
    expect(result?.compositeScore).toBe(71);
    expect(result?.displayReasons[0]).toContain('71/100');
  });

  it('clamps scores to 0-10', () => {
    const base = Object.fromEntries(
      LLM_RATING_KEYS.map((k) => [k, 5]),
    ) as Record<string, number>;
    const scores = parseCriteriaScores({
      ...base,
      budgetFit: 15,
      sizeForFamily: -1,
    });
    expect(scores.budgetFit).toBe(10);
    expect(scores.sizeForFamily).toBe(0);
  });
});
