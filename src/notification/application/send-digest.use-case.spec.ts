import { SendDigestUseCase } from './send-digest.use-case';
import type { TelegramSendJob } from '../queue/telegram-send-job';
import {
  loadTestCriteria,
  mockConfig,
  mockCriteriaLoader,
  mockStepLogger,
} from '../../../test/helpers/test-utils';

const criteriaLoader = mockCriteriaLoader();

describe('SendDigestUseCase', () => {
  const listings = {
    findTopForDigest: jest.fn(),
    shouldSendToTelegram: jest.fn(),
    markTelegramSent: jest.fn(),
  };
  const telegram = {
    isConfigured: jest.fn(),
    sendText: jest.fn(),
  };
  const telegramQueue = {
    isEnabled: jest.fn().mockReturnValue(false),
    enqueueJobs: jest.fn(),
    getQueueStats: jest.fn().mockResolvedValue(null),
  };
  const log = mockStepLogger();

  const useCase = new SendDigestUseCase(
    listings as never,
    telegram,
    telegramQueue,
    mockConfig({ PIPELINE_DRY_RUN: 'true' }),
    criteriaLoader as never,
    log as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('skips incomplete Casa listings', async () => {
    telegram.isConfigured.mockReturnValue(true);
    listings.findTopForDigest.mockResolvedValue([
      {
        id: 'casa-bad',
        canonicalUrl: 'https://www.casa.it/annunci/1/',
        listingUrl: 'https://www.casa.it/annunci/1/',
        source: 'casa.it',
        title: 'x',
        rentEur: null,
        areaSqm: null,
        rooms: 2,
        locationHint: null,
        score: 80,
        riskLevel: 'none',
        reasons: [],
        riskReasons: [],
        aiSuggestion: null,
      },
      {
        id: 'ok',
        canonicalUrl: 'https://www.idealista.it/immobile/1/',
        listingUrl: 'https://www.idealista.it/immobile/1/',
        source: 'idealista',
        title: 'Bilocale',
        rentEur: 750,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'Cenisia',
        score: 60,
        riskLevel: 'none',
        reasons: [],
        riskReasons: [],
        aiSuggestion: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);

    const sent = await useCase.execute({
      listingsNew: 1,
      duplicatesSkipped: 0,
    });
    expect(sent).toBe(1);
    expect(log._ctx.debug).toHaveBeenCalledWith(
      'telegram',
      'Skip — incomplete Casa listing',
      expect.objectContaining({ id: 'casa-bad' }),
    );
  });

  it('skips incomplete Facebook comment-thread listings', async () => {
    telegram.isConfigured.mockReturnValue(true);
    listings.findTopForDigest.mockResolvedValue([
      {
        id: 'fb-bad',
        canonicalUrl:
          'https://www.facebook.com/groups/946456072043414/posts/28024420223820299/',
        listingUrl:
          'https://www.facebook.com/groups/946456072043414/posts/28024420223820299/',
        source: 'facebook.group',
        title:
          'Elle Pillosu Ciao Leonardo. Mia mamma ha un bilocale Like Reply See translation Share',
        rentEur: null,
        areaSqm: null,
        rooms: null,
        locationHint: null,
        score: 47,
        riskLevel: 'none',
        reasons: [],
        riskReasons: [],
        aiSuggestion: null,
      },
      {
        id: 'ok',
        canonicalUrl: 'https://www.idealista.it/immobile/1/',
        listingUrl: 'https://www.idealista.it/immobile/1/',
        source: 'idealista',
        title: 'Bilocale',
        rentEur: 750,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'Cenisia',
        score: 60,
        riskLevel: 'none',
        reasons: [],
        riskReasons: [],
        aiSuggestion: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);

    const sent = await useCase.execute({
      listingsNew: 1,
      duplicatesSkipped: 0,
    });
    expect(sent).toBe(1);
  });

  it('skips listings outside hard digest limits (1 room, tiny area, rent > 800)', async () => {
    telegram.isConfigured.mockReturnValue(true);
    listings.findTopForDigest.mockResolvedValue([
      {
        id: 'tiny',
        canonicalUrl: 'https://www.idealista.it/immobile/35831720/',
        listingUrl: 'https://www.idealista.it/immobile/35831720/',
        source: 'idealista',
        title: 'Monolocale',
        rentEur: 500,
        areaSqm: 27,
        rooms: 1,
        locationHint: 'Torino',
        score: 51,
        riskLevel: 'none',
        reasons: [],
        riskReasons: [],
        aiSuggestion: null,
      },
      {
        id: 'ok',
        canonicalUrl: 'https://www.idealista.it/immobile/1/',
        listingUrl: 'https://www.idealista.it/immobile/1/',
        source: 'idealista',
        title: 'Bilocale',
        rentEur: 750,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'Cenisia',
        score: 60,
        riskLevel: 'none',
        reasons: [],
        riskReasons: [],
        aiSuggestion: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);

    const sent = await useCase.execute({
      listingsNew: 1,
      duplicatesSkipped: 0,
    });
    expect(sent).toBe(1);
  });

  it('sends both listings when same fingerprint (duplicate marked on card)', async () => {
    telegram.isConfigured.mockReturnValue(true);
    const fp = 'via-prali-2|r3|a60|€600';
    listings.findTopForDigest.mockResolvedValue([
      {
        id: 'idealista',
        canonicalUrl: 'https://www.idealista.it/immobile/35847065/',
        listingUrl: 'https://www.idealista.it/immobile/35847065/',
        source: 'idealista',
        title: 'Trilocale in Via Prali, 2, Cenisia, Torino',
        rentEur: 600,
        areaSqm: 65,
        rooms: 3,
        locationHint: 'Via Prali, 2, Cenisia, Torino',
        listingFingerprint: fp,
        possibleDuplicateOf: null,
        score: 59,
        riskLevel: 'none',
        reasons: [],
        riskReasons: [],
        aiSuggestion: null,
      },
      {
        id: 'immobiliare',
        canonicalUrl: 'https://www.immobiliare.it/annunci/alert-abc/',
        listingUrl: 'https://clicks.immobiliare.it/track',
        source: 'immobiliare',
        title: '3-room flat via Prali 2, Cenisia, Turin',
        rentEur: 600,
        areaSqm: 65,
        rooms: 3,
        locationHint: 'via Prali 2, Cenisia, Turin',
        listingFingerprint: fp,
        possibleDuplicateOf: {
          id: 'idealista',
          source: 'idealista',
          canonicalUrl: 'https://www.idealista.it/immobile/35847065/',
          title: 'Trilocale in Via Prali, 2',
        },
        score: 59,
        riskLevel: 'none',
        reasons: [],
        riskReasons: [],
        aiSuggestion: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);

    const sent = await useCase.execute({
      listingsNew: 0,
      duplicatesSkipped: 0,
    });
    expect(sent).toBe(2);
  });

  it('returns 0 when telegram not configured', async () => {
    telegram.isConfigured.mockReturnValue(false);
    expect(
      await useCase.execute({ listingsNew: 0, duplicatesSkipped: 0 }),
    ).toBe(0);
  });

  it('dry-run includes suspicious listings in preview', async () => {
    telegram.isConfigured.mockReturnValue(true);
    listings.findTopForDigest.mockResolvedValue([
      {
        id: 's1',
        canonicalUrl: 'https://x',
        listingUrl: 'https://x',
        source: null,
        title: 't',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 80,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'high',
        riskReasons: ['x'],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    const n = await useCase.execute({ listingsNew: 1, duplicatesSkipped: 0 });
    expect(n).toBe(1);
  });

  it('skips listings below min score threshold', async () => {
    telegram.isConfigured.mockReturnValue(true);
    listings.findTopForDigest.mockResolvedValue([
      {
        id: 'low-score',
        canonicalUrl: 'https://www.idealista.it/immobile/1/',
        listingUrl: 'https://www.idealista.it/immobile/1/',
        source: 'idealista',
        title: 'Flat',
        rentEur: 750,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'Cenisia',
        score: 10,
        riskLevel: 'none',
        reasons: [],
        riskReasons: [],
        aiSuggestion: null,
      },
      {
        id: 'ok',
        canonicalUrl: 'https://www.idealista.it/immobile/2/',
        listingUrl: 'https://www.idealista.it/immobile/2/',
        source: 'idealista',
        title: 'Flat 2',
        rentEur: 750,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'Cenisia',
        score: 80,
        riskLevel: 'none',
        reasons: [],
        riskReasons: [],
        aiSuggestion: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);

    const sent = await useCase.execute({
      listingsNew: 0,
      duplicatesSkipped: 0,
    });
    expect(sent).toBe(1);
  });

  it('skips listings below min rent threshold', async () => {
    telegram.isConfigured.mockReturnValue(true);
    listings.findTopForDigest.mockResolvedValue([
      {
        id: '1',
        canonicalUrl: 'https://x',
        listingUrl: 'https://x',
        source: null,
        title: 't',
        rentEur: 50,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 80,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    const n = await useCase.execute({ listingsNew: 0, duplicatesSkipped: 0 });
    expect(n).toBe(0);
    expect(telegram.sendText).not.toHaveBeenCalled();
  });

  it('skips rent below digest threshold when hard criteria still pass', async () => {
    const relaxedCriteria = mockCriteriaLoader({
      ...loadTestCriteria(),
      hard: {
        ...loadTestCriteria().hard,
        rentMinEur: 100,
        rentMaxEur: 1000,
      },
    });
    const digestUseCase = new SendDigestUseCase(
      listings as never,
      telegram,
      telegramQueue,
      mockConfig({ PIPELINE_DRY_RUN: 'true', MIN_DIGEST_RENT_EUR: '300' }),
      relaxedCriteria as never,
      log as never,
    );
    telegram.isConfigured.mockReturnValue(true);
    listings.findTopForDigest.mockResolvedValue([
      {
        id: 'low-rent',
        canonicalUrl: 'https://www.idealista.it/immobile/1/',
        listingUrl: 'https://www.idealista.it/immobile/1/',
        source: 'idealista',
        title: 'Flat',
        rentEur: 250,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'Cenisia',
        score: 80,
        riskLevel: 'none',
        reasons: [],
        riskReasons: [],
        aiSuggestion: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    expect(
      await digestUseCase.execute({ listingsNew: 0, duplicatesSkipped: 0 }),
    ).toBe(0);
  });

  it('skips low score and rent and already sent', async () => {
    telegram.isConfigured.mockReturnValue(true);
    listings.findTopForDigest.mockResolvedValue([
      {
        id: '1',
        canonicalUrl: 'https://x',
        listingUrl: 'https://x',
        source: null,
        title: 't',
        rentEur: 100,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 10,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
      {
        id: '2',
        canonicalUrl: 'https://y',
        listingUrl: 'https://y',
        source: null,
        title: 't2',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 80,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(false);
    const n = await useCase.execute({ listingsNew: 0, duplicatesSkipped: 0 });
    expect(n).toBe(0);
  });

  it('dry-run logs cards without sending', async () => {
    telegram.isConfigured.mockReturnValue(true);
    listings.findTopForDigest.mockResolvedValue([
      {
        id: '1',
        canonicalUrl: 'https://www.idealista.it/immobile/1/',
        listingUrl: 'https://www.idealista.it/immobile/1/',
        source: 'idealista.it',
        title: 'Flat',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'Cenisia',
        score: 80,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    const n = await useCase.execute({ listingsNew: 1, duplicatesSkipped: 0 });
    expect(n).toBe(1);
    expect(telegram.sendText).not.toHaveBeenCalled();
  });

  it('includes AI suggestion in sent card text', async () => {
    jest.useFakeTimers();
    const live = new SendDigestUseCase(
      listings as never,
      telegram,
      telegramQueue,
      mockConfig({ PIPELINE_DRY_RUN: 'false', TOP_N: '10' }),
      criteriaLoader as never,
      log as never,
    );
    telegram.isConfigured.mockReturnValue(true);
    telegram.sendText.mockResolvedValue('mid');
    listings.findTopForDigest.mockResolvedValue([
      {
        id: 'ai1',
        canonicalUrl: 'https://www.idealista.it/immobile/1/',
        listingUrl: 'https://www.idealista.it/immobile/1/',
        source: 'idealista.it',
        title: 'Flat',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'Cenisia',
        score: 80,
        reasons: ['2 rooms — ok'],
        aiSuggestion: 'Quiet street near Bernini metro.',
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    const run = live.execute({ listingsNew: 1, duplicatesSkipped: 0 });
    await jest.runAllTimersAsync();
    expect(await run).toBe(1);
    expect(telegram.sendText).toHaveBeenCalledWith(
      expect.stringContaining('💡 Quiet street near Bernini metro.'),
    );
    jest.useRealTimers();
  });

  it('sends suspicious listings in live mode', async () => {
    jest.useFakeTimers();
    const live = new SendDigestUseCase(
      listings as never,
      telegram,
      telegramQueue,
      mockConfig({ PIPELINE_DRY_RUN: 'false' }),
      criteriaLoader as never,
      log as never,
    );
    telegram.isConfigured.mockReturnValue(true);
    telegram.sendText.mockResolvedValue('mid');
    listings.findTopForDigest.mockResolvedValue([
      {
        id: 'risk',
        canonicalUrl: 'https://x',
        listingUrl: 'https://x',
        source: null,
        title: 't',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 80,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'high',
        riskReasons: ['scam'],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    const run = live.execute({ listingsNew: 1, duplicatesSkipped: 0 });
    await jest.runAllTimersAsync();
    expect(await run).toBe(1);
    expect(telegram.sendText).toHaveBeenCalledWith(
      expect.stringContaining('Suspicious'),
    );
    jest.useRealTimers();
  });

  it('sends header and cards when not dry-run', async () => {
    jest.useFakeTimers();
    const live = new SendDigestUseCase(
      listings as never,
      telegram,
      telegramQueue,
      mockConfig({ PIPELINE_DRY_RUN: 'false' }),
      criteriaLoader as never,
      log as never,
    );
    telegram.isConfigured.mockReturnValue(true);
    telegram.sendText.mockResolvedValue('mid');
    listings.findTopForDigest.mockResolvedValue([
      {
        id: '1',
        canonicalUrl: 'https://www.idealista.it/immobile/1/',
        listingUrl: 'https://www.idealista.it/immobile/1/',
        source: 'idealista.it',
        title: 'Normal',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'Cenisia',
        score: 80,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
      {
        id: '2',
        canonicalUrl: 'https://www.idealista.it/immobile/2/',
        listingUrl: 'https://www.idealista.it/immobile/2/',
        source: 'idealista.it',
        title: 'Risky',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: 'Cenisia',
        score: 70,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'high',
        riskReasons: ['x'],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);

    const run = live.execute({ listingsNew: 2, duplicatesSkipped: 0 });
    await jest.runAllTimersAsync();
    const n = await run;
    expect(n).toBe(2);
    expect(telegram.sendText).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('limits live sends per run (batch)', async () => {
    jest.useFakeTimers();
    const live = new SendDigestUseCase(
      listings as never,
      telegram,
      telegramQueue,
      mockConfig({
        PIPELINE_DRY_RUN: 'false',
        TELEGRAM_MAX_SEND_PER_RUN: '1',
        TELEGRAM_SEND_DELAY_MS: '10',
      }),
      criteriaLoader as never,
      log as never,
    );
    telegram.isConfigured.mockReturnValue(true);
    telegram.sendText.mockResolvedValue('mid');
    listings.findTopForDigest.mockResolvedValue([
      {
        id: '1',
        canonicalUrl: 'https://a',
        listingUrl: 'https://a',
        source: null,
        title: 'A',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 90,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
      {
        id: '2',
        canonicalUrl: 'https://b',
        listingUrl: 'https://b',
        source: null,
        title: 'B',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 80,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    const run = live.execute({ listingsNew: 2, duplicatesSkipped: 0 });
    await jest.runAllTimersAsync();
    expect(await run).toBe(1);
    expect(listings.markTelegramSent).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('rethrows when header fails with non-rate-limit error', async () => {
    const live = new SendDigestUseCase(
      listings as never,
      telegram,
      telegramQueue,
      mockConfig({ PIPELINE_DRY_RUN: 'false' }),
      criteriaLoader as never,
      log as never,
    );
    telegram.isConfigured.mockReturnValue(true);
    telegram.sendText.mockRejectedValue(new Error('bad gateway'));
    listings.findTopForDigest.mockResolvedValue([
      {
        id: '1',
        canonicalUrl: 'https://a',
        listingUrl: 'https://a',
        source: null,
        title: 'A',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 90,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    await expect(
      live.execute({ listingsNew: 1, duplicatesSkipped: 0 }),
    ).rejects.toThrow('bad gateway');
  });

  it('returns 0 when header hits rate limit', async () => {
    const live = new SendDigestUseCase(
      listings as never,
      telegram,
      telegramQueue,
      mockConfig({ PIPELINE_DRY_RUN: 'false' }),
      criteriaLoader as never,
      log as never,
    );
    telegram.isConfigured.mockReturnValue(true);
    telegram.sendText.mockRejectedValue(new Error('429: retry after 2'));
    listings.findTopForDigest.mockResolvedValue([
      {
        id: '1',
        canonicalUrl: 'https://a',
        listingUrl: 'https://a',
        source: null,
        title: 'A',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 90,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    expect(await live.execute({ listingsNew: 1, duplicatesSkipped: 0 })).toBe(
      0,
    );
  });

  it('stops suspicious section on rate limit after normal cards', async () => {
    jest.useFakeTimers();
    const live = new SendDigestUseCase(
      listings as never,
      telegram,
      telegramQueue,
      mockConfig({ PIPELINE_DRY_RUN: 'false', TELEGRAM_SEND_DELAY_MS: '10' }),
      criteriaLoader as never,
      log as never,
    );
    telegram.isConfigured.mockReturnValue(true);
    telegram.sendText
      .mockResolvedValueOnce('header')
      .mockResolvedValueOnce('card')
      .mockRejectedValueOnce(new Error('429: retry after 1'));
    listings.findTopForDigest.mockResolvedValue([
      {
        id: 'n1',
        canonicalUrl: 'https://n',
        listingUrl: 'https://n',
        source: null,
        title: 'Normal',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 90,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
      {
        id: 's1',
        canonicalUrl: 'https://s',
        listingUrl: 'https://s',
        source: null,
        title: 'Risk',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 80,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'high',
        riskReasons: ['x'],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    const run = live.execute({ listingsNew: 2, duplicatesSkipped: 0 });
    await jest.runAllTimersAsync();
    expect(await run).toBe(1);
    jest.useRealTimers();
  });

  it('rethrows when suspicious divider fails with non-rate-limit error', async () => {
    jest.useRealTimers();
    const live = new SendDigestUseCase(
      listings as never,
      telegram,
      telegramQueue,
      mockConfig({
        PIPELINE_DRY_RUN: 'false',
        TELEGRAM_SEND_DELAY_MS: '0',
      }),
      criteriaLoader as never,
      log as never,
    );
    telegram.isConfigured.mockReturnValue(true);
    telegram.sendText
      .mockResolvedValueOnce('header')
      .mockResolvedValueOnce('card')
      .mockRejectedValueOnce(new Error('telegram down'));
    listings.findTopForDigest.mockResolvedValue([
      {
        id: 'n1',
        canonicalUrl: 'https://n',
        listingUrl: 'https://n',
        source: null,
        title: 'Normal',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 90,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
      {
        id: 's1',
        canonicalUrl: 'https://s',
        listingUrl: 'https://s',
        source: null,
        title: 'Risk',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 80,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'high',
        riskReasons: ['x'],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    await expect(
      live.execute({ listingsNew: 2, duplicatesSkipped: 0 }),
    ).rejects.toThrow('telegram down');
  });

  it('rethrows non-rate-limit telegram errors', async () => {
    const live = new SendDigestUseCase(
      listings as never,
      telegram,
      telegramQueue,
      mockConfig({ PIPELINE_DRY_RUN: 'false' }),
      criteriaLoader as never,
      log as never,
    );
    telegram.isConfigured.mockReturnValue(true);
    telegram.sendText
      .mockResolvedValueOnce('header')
      .mockRejectedValueOnce(new Error('network down'));
    listings.findTopForDigest.mockResolvedValue([
      {
        id: '1',
        canonicalUrl: 'https://a',
        listingUrl: 'https://a',
        source: null,
        title: 'A',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 90,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    await expect(
      live.execute({ listingsNew: 1, duplicatesSkipped: 0 }),
    ).rejects.toThrow('network down');
  });

  it('stops batch on rate limit without throwing', async () => {
    jest.useFakeTimers();
    const live = new SendDigestUseCase(
      listings as never,
      telegram,
      telegramQueue,
      mockConfig({
        PIPELINE_DRY_RUN: 'false',
        TELEGRAM_MAX_SEND_PER_RUN: '10',
        TELEGRAM_SEND_DELAY_MS: '10',
      }),
      criteriaLoader as never,
      log as never,
    );
    telegram.isConfigured.mockReturnValue(true);
    telegram.sendText
      .mockResolvedValueOnce('header')
      .mockRejectedValueOnce(new Error('429: retry after 1'));
    listings.findTopForDigest.mockResolvedValue([
      {
        id: '1',
        canonicalUrl: 'https://a',
        listingUrl: 'https://a',
        source: null,
        title: 'A',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 90,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    const run = live.execute({ listingsNew: 1, duplicatesSkipped: 0 });
    await jest.runAllTimersAsync();
    expect(await run).toBe(0);
    expect(listings.markTelegramSent).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('enqueues jobs when BullMQ enabled', async () => {
    const queue = {
      isEnabled: jest.fn().mockReturnValue(true),
      enqueueJobs: jest.fn().mockResolvedValue(1),
      getQueueStats: jest.fn().mockResolvedValue({ waiting: 2, active: 0 }),
    };
    const bull = new SendDigestUseCase(
      listings as never,
      telegram,
      queue,
      mockConfig({
        PIPELINE_DRY_RUN: 'false',
        BULLMQ_ENABLED: 'true',
      }),
      criteriaLoader as never,
      log as never,
    );
    telegram.isConfigured.mockReturnValue(true);
    listings.findTopForDigest.mockResolvedValue([
      {
        id: '1',
        canonicalUrl: 'https://a',
        listingUrl: 'https://a',
        source: null,
        title: 'A',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 90,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    const n = await bull.execute({ listingsNew: 1, duplicatesSkipped: 0 });
    expect(n).toBe(1);
    expect(queue.enqueueJobs).toHaveBeenCalled();
    expect(telegram.sendText).not.toHaveBeenCalled();
  });

  it('enqueues suspicious jobs when BullMQ enabled', async () => {
    const queue = {
      isEnabled: jest.fn().mockReturnValue(true),
      enqueueJobs: jest.fn().mockResolvedValue(2),
      getQueueStats: jest.fn().mockResolvedValue({ waiting: 3, active: 0 }),
    };
    const bull = new SendDigestUseCase(
      listings as never,
      telegram,
      queue,
      mockConfig({
        PIPELINE_DRY_RUN: 'false',
        BULLMQ_ENABLED: 'true',
      }),
      criteriaLoader as never,
      log as never,
    );
    telegram.isConfigured.mockReturnValue(true);
    listings.findTopForDigest.mockResolvedValue([
      {
        id: 'n1',
        canonicalUrl: 'https://n',
        listingUrl: 'https://n',
        source: null,
        title: 'N',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 90,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'none',
        riskReasons: [],
        telegramSentAt: null,
        priceChangedAt: null,
      },
      {
        id: 's1',
        canonicalUrl: 'https://s',
        listingUrl: 'https://s',
        source: null,
        title: 'S',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        score: 70,
        reasons: [],
        aiSuggestion: null,
        riskLevel: 'high',
        riskReasons: ['scam'],
        telegramSentAt: null,
        priceChangedAt: null,
      },
    ]);
    listings.shouldSendToTelegram.mockResolvedValue(true);
    await bull.execute({ listingsNew: 2, duplicatesSkipped: 0 });
    const enqueueCall = queue.enqueueJobs.mock.calls[0] as
      | [TelegramSendJob[]]
      | undefined;
    const jobs = enqueueCall?.[0] ?? [];
    expect(
      jobs.some((j) => j.kind === 'listing-card' && j.listingId === 's1'),
    ).toBe(true);
    expect(
      jobs.some((j) => j.kind === 'text' && j.text.includes('Suspicious')),
    ).toBe(true);
  });
});
