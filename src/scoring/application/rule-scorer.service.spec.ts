import { RuleScorerService } from './rule-scorer.service';
import {
  loadTestCriteria,
  mockCriteriaLoader,
} from '../../../test/helpers/test-utils';

describe('RuleScorerService', () => {
  const service = new RuleScorerService(mockCriteriaLoader() as never);
  const sparse = new RuleScorerService(
    mockCriteriaLoader({
      ...loadTestCriteria(),
      hard: {
        ...loadTestCriteria().hard,
        zones: [],
        metroStations: [],
        roomsMin: undefined,
        roomsMax: undefined,
        areaMinSqm: undefined,
        areaMaxSqm: undefined,
        rentMinEur: undefined,
        rentMaxEur: undefined,
        totalCostMaxEur: undefined,
      },
    }) as never,
  );

  it('scores a matching listing highly', () => {
    const result = service.score(
      {
        canonicalUrl: 'https://example.com/1',
        rentEur: 750,
        areaSqm: 72,
        rooms: 2,
        locationHint: 'Cenisia, Turin',
      },
      'near bernini metro',
    );
    expect(result.score).toBeGreaterThan(50);
    expect(result.riskLevel).toBe('none');
    expect(result.riskSource).toBe('none');
  });

  it('penalizes out-of-range rooms and rent', () => {
    const result = service.score(
      {
        canonicalUrl: 'https://example.com/2',
        rentEur: 2000,
        areaSqm: 30,
        rooms: 1,
      },
      'random area',
    );
    expect(result.score).toBeLessThan(50);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('flags risk rules', () => {
    const result = service.score(
      {
        canonicalUrl: 'https://example.com/3',
        rentEur: 300,
        rooms: 2,
        areaSqm: 70,
      },
      'western union only whatsapp',
    );
    expect(result.riskLevel).toBe('high');
    expect(result.riskReasons.length).toBeGreaterThan(0);
  });

  it('handles total cost with condo fee', () => {
    const result = service.score(
      {
        canonicalUrl: 'https://example.com/4',
        rentEur: 850,
        condoFeeEur: 50,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'cenisia',
      },
      '',
    );
    expect(result.reasons.some((r) => r.includes('spese'))).toBe(true);
  });

  it('penalizes total cost above max with condo fee', () => {
    const result = service.score(
      {
        canonicalUrl: 'https://example.com/6',
        rentEur: 950,
        condoFeeEur: 200,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'cenisia',
      },
      '',
    );
    expect(result.reasons.some((r) => r.includes('>'))).toBe(true);
  });

  it('flags messenger-only contact', () => {
    const result = service.score(
      {
        canonicalUrl: 'https://example.com/7',
        rentEur: 800,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'cenisia',
      },
      'solo whatsapp per info',
    );
    expect(result.riskReasons.some((r) => r.includes('messenger'))).toBe(true);
  });

  it('scores listing with sparse criteria defaults', () => {
    const result = sparse.score(
      { canonicalUrl: 'https://example.com/8' },
      'random',
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('handles missing rooms area and rent', () => {
    const result = service.score(
      { canonicalUrl: 'https://example.com/9' },
      'text',
    );
    expect(result.score).toBeLessThan(50);
    expect(result.riskLevel).toBe('none');
  });

  it('warns when spese missing', () => {
    const result = service.score(
      {
        canonicalUrl: 'https://example.com/5',
        rentEur: 800,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'cenisia',
      },
      '',
    );
    expect(result.reasons.some((r) => r.includes('spese'))).toBe(true);
  });
});
