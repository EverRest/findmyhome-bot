import {
  compositeScoreFromCriteria,
  parseCriteriaScores,
  parseLlmRatingResponse,
} from './llm-rating.parser';

const defs = [
  { key: 'price', label: 'Price' },
  { key: 'quality', label: 'Quality' },
  { key: 'value', label: 'Value' },
  { key: 'metroProximity', label: 'Metro' },
  { key: 'centerProximity', label: 'City center' },
  { key: 'greenAreas', label: 'Green areas' },
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'quietSafe', label: 'Quiet & safe' },
  { key: 'livingArea', label: 'Living area' },
  { key: 'piazzaRivoliProximity', label: 'Rivoli' },
];

describe('llm-rating.parser', () => {
  it('parses and sums ten criteria', () => {
    const raw = {
      price: 8,
      quality: 7,
      value: 8,
      metroProximity: 6,
      centerProximity: 5,
      greenAreas: 7,
      infrastructure: 8,
      quietSafe: 7,
      livingArea: 9,
      piazzaRivoliProximity: 6,
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
    const scores = parseCriteriaScores({
      price: 15,
      quality: -1,
      value: 5,
      metroProximity: 5,
      centerProximity: 5,
      greenAreas: 5,
      infrastructure: 5,
      quietSafe: 5,
      livingArea: 5,
      piazzaRivoliProximity: 5,
    });
    expect(scores.price).toBe(10);
    expect(scores.quality).toBe(0);
  });
});
