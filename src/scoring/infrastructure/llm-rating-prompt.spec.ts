import { loadTestCriteria } from '../../../test/helpers/test-utils';
import { buildLlmRatingPrompt } from './llm-rating-prompt';
import type { SearchCriteria } from '../../shared/infrastructure/criteria.types';

const draft = {
  canonicalUrl: 'https://x',
  title: 'Trilocale Cenisia',
  rentEur: 750,
  areaSqm: 70,
  locationHint: 'Cenisia',
};

describe('buildLlmRatingPrompt', () => {
  it('includes listing, criteria keys, and hard area bounds', () => {
    const prompt = buildLlmRatingPrompt(loadTestCriteria(), draft);
    expect(prompt).toContain('Trilocale Cenisia');
    expect(prompt).toContain('price');
    expect(prompt).toContain('piazzaRivoliProximity');
    expect(prompt).toContain('summary');
    expect(prompt).toContain('area 60-80 m²');
  });

  it('injects telegram.aiSuggestion prompt from criteria config', () => {
    const prompt = buildLlmRatingPrompt(loadTestCriteria(), draft);
    expect(prompt).toContain(
      'Write "summary" as one short English sentence for the family.',
    );
  });

  it('uses default aiSuggestion text when telegram block is missing', () => {
    const criteria: SearchCriteria = {
      ...loadTestCriteria(),
      telegram: undefined,
    };
    const prompt = buildLlmRatingPrompt(criteria, draft);
    expect(prompt).toContain('max 30 words');
    expect(prompt).toContain('Do not repeat scores, rent, rooms, or m²');
  });

  it('accepts preferredMetro as a string in llmRating.reference', () => {
    const criteria: SearchCriteria = {
      ...loadTestCriteria(),
      llmRating: {
        ...loadTestCriteria().llmRating!,
        reference: {
          preferredMetro: 'Bernini, Rivoli, Monte Grappa',
        },
      },
    };
    expect(() => buildLlmRatingPrompt(criteria, draft)).not.toThrow();
  });

  it('throws when llmRating.prompt is missing', () => {
    const criteria: SearchCriteria = {
      ...loadTestCriteria(),
      llmRating: undefined,
    };
    expect(() => buildLlmRatingPrompt(criteria, draft)).toThrow(
      'criteria.llmRating.prompt is missing',
    );
  });
});
