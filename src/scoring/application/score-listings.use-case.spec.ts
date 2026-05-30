import { ScoreListingsUseCase } from './score-listings.use-case';
import { RuleScorerService } from './rule-scorer.service';
import { createPrismaMock } from '../../../test/helpers/prisma-mock';
import {
  mockConfig,
  mockCriteriaLoader,
  mockStepLogger,
} from '../../../test/helpers/test-utils';

describe('ScoreListingsUseCase', () => {
  const prisma = createPrismaMock();
  const rules = new RuleScorerService(mockCriteriaLoader() as never);
  const ollama = { assessListing: jest.fn().mockResolvedValue(null) };
  const geocode = {
    isProximityEnabled: jest.fn().mockReturnValue(false),
    resolveProximity: jest.fn(),
  };

  const useCase = new ScoreListingsUseCase(
    prisma as never,
    rules,
    ollama as never,
    geocode as never,
    mockCriteriaLoader() as never,
    mockConfig({ OLLAMA_SCORING_ENABLED: 'false' }),
    mockStepLogger() as never,
  );

  beforeEach(() => jest.clearAllMocks());

  const listingBase = {
    lat: null,
    lng: null,
    distanceToRefM: null,
    proximityScore: null,
    condoFeeEur: null,
  };

  it('scores listings and skips cache hits', async () => {
    const now = new Date();
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'l1',
        canonicalUrl: 'https://x/1',
        title: 't',
        locationHint: 'cenisia',
        rentEur: 800,
        areaSqm: 70,
        rooms: 2,
        rawSnippet: 'cenisia',
        lastSeenAt: now,
        scores: [],
        ...listingBase,
      },
      {
        id: 'l2',
        canonicalUrl: 'https://x/2',
        title: 't2',
        locationHint: 'cenisia',
        rentEur: 800,
        areaSqm: 70,
        rooms: 2,
        rawSnippet: '',
        lastSeenAt: new Date('2020-01-01'),
        scores: [{ scoredAt: new Date(), score: 80 }],
        ...listingBase,
      },
    ]);
    prisma.listingScore.create.mockResolvedValue({});

    const n = await useCase.execute();
    expect(n).toBe(1);
    expect(prisma.listingScore.create).toHaveBeenCalledTimes(1);
  });

  it('skips cached scores when still fresh', async () => {
    const now = new Date();
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'cached',
        canonicalUrl: 'https://x/c',
        title: 't',
        locationHint: 'cenisia',
        rentEur: 800,
        areaSqm: 70,
        rooms: 2,
        rawSnippet: '',
        lastSeenAt: new Date(now.getTime() - 1000),
        scores: [{ scoredAt: now, score: 70 }],
        ...listingBase,
      },
    ]);
    expect(await useCase.execute()).toBe(0);
    expect(prisma.listingScore.create).not.toHaveBeenCalled();
  });

  it('applies LLM when enabled', async () => {
    const llmUseCase = new ScoreListingsUseCase(
      prisma as never,
      rules,
      {
        assessListing: jest.fn().mockResolvedValue({
          compositeScore: 65,
          criteria: {
            budgetFit: 8,
            sizeForFamily: 8,
            targetZone: 8,
            dataComplete: 8,
            costClarity: 8,
            notStudentShared: 8,
            layoutFit: 8,
            listingTrust: 8,
            descriptionQuality: 8,
            proximityToReference: 0,
          },
          displayReasons: ['🤖 AI (65/100): test'],
          summary: 'Good',
          riskLevel: 'none',
          riskReasons: [],
        }),
      } as never,
      geocode as never,
      mockCriteriaLoader() as never,
      mockConfig({ OLLAMA_SCORING_ENABLED: 'true' }),
      mockStepLogger() as never,
    );
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'l3',
        canonicalUrl: 'https://x/3',
        title: 't',
        locationHint: 'cenisia',
        rentEur: 800,
        areaSqm: 70,
        rooms: 2,
        rawSnippet: '',
        lastSeenAt: new Date(),
        scores: [],
        ...listingBase,
      },
    ]);
    expect(await llmUseCase.execute()).toBe(1);
  });

  it('stores LLM summary for Telegram', async () => {
    const llmUseCase = new ScoreListingsUseCase(
      prisma as never,
      rules,
      {
        assessListing: jest.fn().mockResolvedValue({
          compositeScore: 45,
          criteria: {
            budgetFit: 5,
            sizeForFamily: 5,
            targetZone: 5,
            dataComplete: 5,
            costClarity: 5,
            notStudentShared: 5,
            layoutFit: 5,
            listingTrust: 5,
            descriptionQuality: 5,
            proximityToReference: 0,
          },
          displayReasons: ['🤖 AI (45/100)'],
          summary: 'Average option',
          riskLevel: 'none',
          riskReasons: [],
        }),
      } as never,
      geocode as never,
      mockCriteriaLoader() as never,
      mockConfig({ OLLAMA_SCORING_ENABLED: 'true' }),
      mockStepLogger() as never,
    );
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'l4',
        canonicalUrl: 'https://x/4',
        title: 't',
        locationHint: 'cenisia',
        rentEur: 800,
        areaSqm: 70,
        rooms: 2,
        rawSnippet: '',
        lastSeenAt: new Date(),
        scores: [],
        ...listingBase,
      },
    ]);
    await llmUseCase.execute();
    const createArg = prisma.listingScore.create.mock.calls[0][0] as {
      data: { llmSummary: string; reasons: string };
    };
    expect(createArg.data.llmSummary).toBe('Average option');
    const reasons = JSON.parse(createArg.data.reasons) as string[];
    expect(reasons).not.toContain('Average option');
  });

  it('applies proximity when geocoding enabled', async () => {
    const geocodeEnabled = {
      isProximityEnabled: jest.fn().mockReturnValue(true),
      resolveProximity: jest.fn().mockResolvedValue({
        lat: 45.079,
        lng: 7.642,
        geocodeSource: 'cache',
        distanceM: 400,
        proximityScore: 10,
      }),
    };
    const proximityUseCase = new ScoreListingsUseCase(
      prisma as never,
      rules,
      ollama as never,
      geocodeEnabled as never,
      mockCriteriaLoader() as never,
      mockConfig({ OLLAMA_SCORING_ENABLED: 'false' }),
      mockStepLogger() as never,
    );
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'prox',
        canonicalUrl: 'https://x/p',
        title: 'Via Prali flat',
        locationHint: 'Via Prali 2, Cenisia',
        rentEur: 600,
        areaSqm: 65,
        rooms: 3,
        rawSnippet: '',
        lastSeenAt: new Date(),
        scores: [],
        ...listingBase,
      },
    ]);
    await proximityUseCase.execute();
    expect(geocodeEnabled.resolveProximity).toHaveBeenCalled();
    const createArg = prisma.listingScore.create.mock.calls[0][0] as {
      data: { reasons: string };
    };
    const reasons = JSON.parse(createArg.data.reasons) as string[];
    expect(reasons.some((r) => r.includes('Test Anchor'))).toBe(true);
  });

  it('skips listings that fail hard criteria', async () => {
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'tiny',
        canonicalUrl: 'https://x/tiny',
        title: 'Monolocale',
        locationHint: 'Torino',
        rentEur: 800,
        areaSqm: 27,
        rooms: 1,
        rawSnippet: '',
        lastSeenAt: new Date(),
        scores: [],
        ...listingBase,
      },
    ]);
    expect(await useCase.execute()).toBe(0);
    expect(prisma.listingScore.create).not.toHaveBeenCalled();
  });

  it('counts geocode misses when proximity enabled', async () => {
    const geocodeEnabled = {
      isProximityEnabled: jest.fn().mockReturnValue(true),
      resolveProximity: jest.fn().mockResolvedValue({
        lat: null,
        lng: null,
        geocodeSource: null,
        distanceM: null,
        proximityScore: null,
      }),
    };
    const proximityUseCase = new ScoreListingsUseCase(
      prisma as never,
      rules,
      ollama as never,
      geocodeEnabled as never,
      mockCriteriaLoader() as never,
      mockConfig({ OLLAMA_SCORING_ENABLED: 'false' }),
      mockStepLogger() as never,
    );
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'missing-geo',
        canonicalUrl: 'https://x/geo',
        title: 'Flat',
        locationHint: 'Cenisia',
        rentEur: 800,
        areaSqm: 70,
        rooms: 2,
        rawSnippet: '',
        lastSeenAt: new Date(),
        scores: [],
        ...listingBase,
      },
    ]);
    expect(await proximityUseCase.execute()).toBe(1);
  });

  it('merges LLM proximity and elevates high risk', async () => {
    const geocodeEnabled = {
      isProximityEnabled: jest.fn().mockReturnValue(true),
      resolveProximity: jest.fn().mockResolvedValue({
        lat: 45.079,
        lng: 7.642,
        geocodeSource: 'nominatim',
        distanceM: 200,
        proximityScore: 9,
      }),
    };
    const llmUseCase = new ScoreListingsUseCase(
      prisma as never,
      rules,
      {
        assessListing: jest.fn().mockResolvedValue({
          compositeScore: 70,
          criteria: {
            budgetFit: 8,
            sizeForFamily: 8,
            targetZone: 8,
            dataComplete: 8,
            costClarity: 8,
            notStudentShared: 8,
            layoutFit: 8,
            listingTrust: 8,
            descriptionQuality: 8,
            proximityToReference: 0,
          },
          displayReasons: ['🤖 AI (70/100): test'],
          summary: 'Risky',
          riskLevel: 'high',
          riskReasons: ['suspicious contact'],
        }),
      } as never,
      geocodeEnabled as never,
      mockCriteriaLoader() as never,
      mockConfig({ OLLAMA_SCORING_ENABLED: 'true' }),
      mockStepLogger() as never,
    );
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'llm-risk',
        canonicalUrl: 'https://x/risk',
        title: 'Flat',
        locationHint: 'Cenisia',
        rentEur: 800,
        areaSqm: 70,
        rooms: 2,
        rawSnippet: '',
        lastSeenAt: new Date(),
        scores: [],
        ...listingBase,
      },
    ]);
    await llmUseCase.execute();
    const createArg = prisma.listingScore.create.mock.calls[0][0] as {
      data: { riskLevel: string; riskReasons: string };
    };
    expect(createArg.data.riskLevel).toBe('high');
    expect(JSON.parse(createArg.data.riskReasons)).toContain(
      'suspicious contact',
    );
  });
});
