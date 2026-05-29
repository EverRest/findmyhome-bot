import { RunDailyPipelineUseCase } from './run-daily-pipeline.use-case';
import { createPrismaMock } from '../../../test/helpers/prisma-mock';
import {
  mockConfig,
  mockCriteriaLoader,
  mockStepLogger,
} from '../../../test/helpers/test-utils';

describe('RunDailyPipelineUseCase', () => {
  const prisma = createPrismaMock();
  const fetchEmails = { execute: jest.fn() };
  const fetchFacebook = {
    execute: jest.fn().mockResolvedValue({
      postsProcessed: 0,
      listingsParsed: 0,
      listingsNew: 0,
      duplicatesSkipped: 0,
      skippedStudent: 0,
      skippedNonRent: 0,
      postsSkippedAlreadyProcessed: 0,
    }),
  };
  const scoreListings = { execute: jest.fn() };
  const sendDigest = { execute: jest.fn() };
  const listings = {
    findTopForDigest: jest.fn().mockResolvedValue([]),
    reconcilePossibleDuplicates: jest.fn().mockResolvedValue(0),
  };
  const log = mockStepLogger();

  const useCase = new RunDailyPipelineUseCase(
    prisma as never,
    mockConfig(),
    mockCriteriaLoader() as never,
    fetchEmails as never,
    fetchFacebook as never,
    scoreListings as never,
    sendDigest as never,
    listings as never,
    log as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('completes pipeline run', async () => {
    prisma.pipelineRun.create.mockResolvedValue({ id: 'run1' });
    prisma.pipelineRun.update.mockResolvedValue({});
    fetchEmails.execute.mockResolvedValue({
      emailsProcessed: 1,
      listingsParsed: 1,
      listingsNew: 1,
      duplicatesSkipped: 0,
      emailsSkippedAlreadyProcessed: 0,
    });
    scoreListings.execute.mockResolvedValue(1);
    sendDigest.execute.mockResolvedValue(2);
    listings.findTopForDigest.mockResolvedValue([
      {
        id: 'p1',
        canonicalUrl: 'https://www.idealista.it/immobile/1/',
        listingUrl: 'https://www.idealista.it/immobile/1/',
        source: 'idealista.it',
        title: 'Test',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'Cenisia',
        listingFingerprint: null,
        distanceToRefM: null,
        score: 80,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);

    const summary = await useCase.execute();
    expect(summary.runId).toBe('run1');
    expect(summary.telegramSent).toBe(2);
    expect(summary.preview.length).toBe(1);
    expect(prisma.pipelineRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });

  it('marks run failed on non-Error throw', async () => {
    prisma.pipelineRun.create.mockResolvedValue({ id: 'run3' });
    prisma.pipelineRun.update.mockResolvedValue({});
    fetchEmails.execute.mockRejectedValue('plain-fail');

    await expect(useCase.execute()).rejects.toBe('plain-fail');
  });

  it('marks run failed on error', async () => {
    prisma.pipelineRun.create.mockResolvedValue({ id: 'run2' });
    prisma.pipelineRun.update.mockResolvedValue({});
    fetchEmails.execute.mockRejectedValue(new Error('fail'));

    await expect(useCase.execute()).rejects.toThrow('fail');
    expect(prisma.pipelineRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });
});
