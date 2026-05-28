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

  const useCase = new ScoreListingsUseCase(
    prisma as never,
    rules,
    ollama as never,
    mockCriteriaLoader() as never,
    mockConfig({ OLLAMA_SCORING_ENABLED: 'false' }),
    mockStepLogger() as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('scores listings and skips cache hits', async () => {
    const now = new Date();
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'l1',
        canonicalUrl: 'https://x/1',
        title: 't',
        locationHint: 'cenisia',
        rentEur: 800,
        condoFeeEur: null,
        areaSqm: 70,
        rooms: 2,
        rawSnippet: 'cenisia',
        lastSeenAt: now,
        scores: [],
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
          compositeScore: 80,
          criteria: {
            budgetFit: 8,
            sizeForFamily: 8,
            targetZone: 8,
            dataComplete: 8,
            costClarity: 8,
            notStudentShared: 8,
            layoutFit: 8,
            listingTrust: 8,
            metroLandmark: 8,
            descriptionQuality: 8,
          },
          displayReasons: ['🤖 AI (80/100): test'],
          summary: 'Good',
          riskLevel: 'none',
          riskReasons: [],
        }),
      } as never,
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
          compositeScore: 50,
          criteria: {
            budgetFit: 5,
            sizeForFamily: 5,
            targetZone: 5,
            dataComplete: 5,
            costClarity: 5,
            notStudentShared: 5,
            layoutFit: 5,
            listingTrust: 5,
            metroLandmark: 5,
            descriptionQuality: 5,
          },
          displayReasons: ['🤖 AI (50/100)'],
          summary: 'Average option',
          riskLevel: 'none',
          riskReasons: [],
        }),
      } as never,
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
});
