import { OllamaAdapter } from './ollama.adapter';
import {
  mockConfig,
  mockCriteriaLoader,
  mockStepLogger,
} from '../../../test/helpers/test-utils';

const tenCriteriaResponse = {
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
  summary: 'Nice option',
  riskLevel: 'none',
  riskReasons: [],
};

describe('OllamaAdapter', () => {
  const adapter = new OllamaAdapter(
    mockConfig(),
    mockCriteriaLoader() as never,
    mockStepLogger() as never,
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null when HTTP fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    const r = await adapter.assessListing({
      canonicalUrl: 'https://x',
      rentEur: 800,
    });
    expect(r).toBeNull();
  });

  it('parses ten-criteria rating response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        response: JSON.stringify(tenCriteriaResponse),
      }),
    } as Response);
    const r = await adapter.assessListing({
      canonicalUrl: 'https://x',
      rentEur: 800,
      rooms: 2,
      areaSqm: 70,
      locationHint: 'Cenisia',
    });
    expect(r?.compositeScore).toBe(71);
    expect(r?.criteria.price).toBe(8);
    expect(r?.displayReasons[0]).toContain('Price 8/10');
  });

  it('returns null on network error', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    const r = await adapter.assessListing({ canonicalUrl: 'https://x' });
    expect(r).toBeNull();
  });

  it('returns null when response JSON is invalid', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'not-json' }),
    } as Response);
    const r = await adapter.assessListing({ canonicalUrl: 'https://x' });
    expect(r).toBeNull();
  });

  it('returns null when criteria missing in criteria file', async () => {
    const noRating = new OllamaAdapter(
      mockConfig(),
      {
        get: () => ({ hard: {}, soft: {}, scoring: {}, locale: 'en' }),
      } as never,
      mockStepLogger() as never,
    );
    const r = await noRating.assessListing({ canonicalUrl: 'https://x' });
    expect(r).toBeNull();
  });
});
