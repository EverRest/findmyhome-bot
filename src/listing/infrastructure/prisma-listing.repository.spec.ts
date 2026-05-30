import { PrismaListingRepository } from './prisma-listing.repository';
import { createPrismaMock } from '../../../test/helpers/prisma-mock';

describe('PrismaListingRepository', () => {
  const prisma = createPrismaMock();
  const repo = new PrismaListingRepository(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.listing.findMany.mockResolvedValue([]);
  });

  it('existsProcessedEmail', async () => {
    prisma.processedEmail.findUnique.mockResolvedValue({ id: '1' });
    expect(await repo.existsProcessedEmail('g1')).toBe(true);
    prisma.processedEmail.findUnique.mockResolvedValue(null);
    expect(await repo.existsProcessedEmail('g2')).toBe(false);
  });

  it('markEmailProcessed', async () => {
    await repo.markEmailProcessed('g1', {
      subject: 's',
      receivedAt: new Date(),
      listingsFound: 1,
    });
    expect(prisma.processedEmail.create).toHaveBeenCalled();
  });

  it('tracks processed facebook posts', async () => {
    prisma.processedFacebookPost.findUnique.mockResolvedValue({ id: 'fb1' });
    expect(await repo.existsProcessedFacebookPost('fb-post-1')).toBe(true);
    prisma.processedFacebookPost.findUnique.mockResolvedValue(null);
    expect(await repo.existsProcessedFacebookPost('fb-post-2')).toBe(false);

    await repo.markFacebookPostProcessed('fb-post-3', {
      groupId: '123',
      permalink: 'https://www.facebook.com/groups/123/posts/1/',
      message: 'Affitto bilocale',
      postedAt: new Date('2026-05-01T00:00:00.000Z'),
      listingsFound: 1,
    });
    expect(prisma.processedFacebookPost.create).toHaveBeenCalled();
  });

  it('reconciles property match group after create', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);
    prisma.listing.findFirst.mockResolvedValue(null);
    prisma.listing.create.mockResolvedValue({ id: 'new-id' });
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'older',
        firstSeenAt: new Date('2020-01-01T00:00:00.000Z'),
        possibleDuplicateOfId: null,
      },
      {
        id: 'new-id',
        firstSeenAt: new Date('2026-01-01T00:00:00.000Z'),
        possibleDuplicateOfId: null,
      },
    ]);
    prisma.listing.update.mockResolvedValue({});

    await repo.upsertFromDraft({
      canonicalUrl: 'https://www.idealista.it/immobile/999/',
      title: 'Bilocale via Roma 1, Torino',
      locationHint: 'via Roma 1, Torino',
      rentEur: 600,
      rooms: 2,
      areaSqm: 70,
    });

    expect(prisma.listing.update).toHaveBeenCalled();
  });

  it('upsertFromDraft creates new', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);
    prisma.listing.findFirst.mockResolvedValue(null);
    prisma.listing.create.mockResolvedValue({ id: 'lid' });
    const r = await repo.upsertFromDraft({
      canonicalUrl: 'https://x/1',
      rentEur: 800,
      areaSqm: 70,
      rooms: 2,
    });
    expect(r.isNew).toBe(true);
  });

  it('upsertFromDraft merges by fingerprint when canonical URL differs', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);
    prisma.listing.findFirst.mockResolvedValue({
      id: 'existing-id',
      canonicalUrl: 'https://www.immobiliare.it/annunci/alert-abc/',
      listingUrl: 'https://clicks.immobiliare.it/track',
      alternateUrls: '[]',
      rentEur: 600,
      materialHash: 'old',
      listingFingerprint: 'via-prali-2|r3|a60|€600',
      title: '3-room flat via Prali 2',
      condoFeeEur: null,
      totalCostEur: 600,
      areaSqm: 60,
      rooms: 3,
      addressRaw: null,
      locationHint: 'via Prali 2',
      floor: null,
      hasLift: null,
      rawSnippet: null,
      priceChangedAt: null,
      source: 'immobiliare',
      externalId: null,
    });
    prisma.listing.update.mockResolvedValue({ id: 'existing-id' });

    const r = await repo.upsertFromDraft({
      canonicalUrl: 'https://www.idealista.it/immobile/35847065/',
      listingUrl: 'https://www.idealista.it/immobile/35847065/',
      title: 'Trilocale in Via Prali, 2, Cenisia, Torino',
      locationHint: 'Via Prali, 2, Cenisia, Torino',
      rentEur: 600,
      rooms: 3,
      areaSqm: 60,
    });

    expect(r.isNew).toBe(false);
    expect(prisma.listing.create).not.toHaveBeenCalled();
    expect(prisma.listing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-id' },
        data: expect.objectContaining({
          listingUrl: 'https://www.idealista.it/immobile/35847065/',
        }),
      }),
    );
  });

  it('upsertFromDraft updates existing', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      id: 'lid',
      canonicalUrl: 'https://x/1',
      rentEur: 700,
      materialHash: 'old',
      alternateUrls: '[]',
      listingUrl: null,
      title: null,
      condoFeeEur: null,
      totalCostEur: null,
      areaSqm: null,
      rooms: null,
      addressRaw: null,
      locationHint: null,
      floor: null,
      hasLift: null,
      rawSnippet: null,
      priceChangedAt: null,
      listingFingerprint: null,
      source: null,
      externalId: null,
    });
    prisma.listing.update.mockResolvedValue({ id: 'lid' });
    const r = await repo.upsertFromDraft({
      canonicalUrl: 'https://x/1',
      rentEur: 800,
      areaSqm: 70,
      rooms: 2,
    });
    expect(r.isNew).toBe(false);
    expect(r.priceChanged).toBe(true);
  });

  it('reconcilePossibleDuplicates backfills propertyMatchKey before linking', async () => {
    prisma.listing.findMany
      .mockResolvedValueOnce([
        {
          id: 'lid',
          title: 'Bilocale via Roma 1, Torino',
          locationHint: 'Via Roma 1, Torino',
          rentEur: 600,
          rooms: 2,
          rawSnippet: null,
        },
      ])
      .mockResolvedValueOnce([{ propertyMatchKey: 'via-roma-1|r2|€600' }])
      .mockResolvedValueOnce([
        {
          id: 'lid',
          firstSeenAt: new Date('2026-01-01'),
          possibleDuplicateOfId: null,
        },
      ]);
    prisma.listing.update.mockResolvedValue({});

    await repo.reconcilePossibleDuplicates();

    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: 'lid' },
      data: { propertyMatchKey: 'via-roma-1|r2|€600' },
    });
  });

  it('reconcilePossibleDuplicates marks newer row as possible duplicate', async () => {
    prisma.listing.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ propertyMatchKey: 'via-prali-2|r3|€600' }])
      .mockResolvedValueOnce([
        {
          id: 'older',
          firstSeenAt: new Date('2026-01-01'),
          possibleDuplicateOfId: null,
        },
        {
          id: 'newer',
          firstSeenAt: new Date('2026-02-01'),
          possibleDuplicateOfId: null,
        },
      ]);
    prisma.listing.update.mockResolvedValue({});

    const updated = await repo.reconcilePossibleDuplicates();
    expect(updated).toBe(1);
    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: 'newer' },
      data: { possibleDuplicateOfId: 'older' },
    });
  });

  it('shouldSendToTelegram', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);
    expect(await repo.shouldSendToTelegram('x')).toBe(false);

    prisma.listing.findUnique.mockResolvedValue({ dismissedAt: new Date() });
    expect(await repo.shouldSendToTelegram('x')).toBe(false);

    prisma.listing.findUnique.mockResolvedValue({ telegramSentAt: null });
    expect(await repo.shouldSendToTelegram('x')).toBe(true);

    const sent = new Date('2020-01-01');
    const changed = new Date('2021-01-01');
    prisma.listing.findUnique.mockResolvedValue({
      telegramSentAt: sent,
      priceChangedAt: changed,
    });
    expect(await repo.shouldSendToTelegram('x')).toBe(true);

    prisma.listing.findUnique.mockResolvedValue({
      telegramSentAt: new Date('2022-01-01'),
      priceChangedAt: new Date('2021-01-01'),
    });
    expect(await repo.shouldSendToTelegram('x')).toBe(false);
  });

  it('markTelegramSent and markDismissed', async () => {
    await repo.markTelegramSent('id', 'mid');
    await repo.markDismissed('id');
    expect(prisma.listing.update).toHaveBeenCalledTimes(2);
  });

  it('findTopForDigest deprioritizes high risk then sorts by score', async () => {
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'low',
        canonicalUrl: 'u1',
        listingUrl: null,
        source: null,
        title: 't',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        telegramSentAt: null,
        priceChangedAt: null,
        scores: [
          {
            score: 50,
            reasons: '[]',
            llmSummary: null,
            riskLevel: 'none',
            riskReasons: '[]',
          },
        ],
      },
      {
        id: 'high',
        canonicalUrl: 'u2',
        listingUrl: null,
        source: null,
        title: 't2',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        telegramSentAt: null,
        priceChangedAt: null,
        scores: [
          {
            score: 40,
            reasons: '[]',
            llmSummary: null,
            riskLevel: 'high',
            riskReasons: '[]',
          },
        ],
      },
    ]);
    const top = await repo.findTopForDigest(5);
    expect(top[0].id).toBe('low');
    expect(top[1].id).toBe('high');
  });

  it('findByIdForDigest returns mapped listing', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      id: 'x1',
      canonicalUrl: 'u',
      listingUrl: null,
      source: null,
      title: 't',
      rentEur: 800,
      condoFeeEur: null,
      totalCostEur: null,
      areaSqm: 70,
      rooms: 2,
      locationHint: 'Cenisia',
      telegramSentAt: null,
      priceChangedAt: null,
      dismissedAt: null,
      scores: [
        {
          score: 80,
          reasons: '[]',
          llmSummary: 'Nice area for families.',
          riskLevel: 'none',
          riskReasons: '[]',
        },
      ],
    });
    const row = await repo.findByIdForDigest('x1');
    expect(row?.id).toBe('x1');
    expect(row?.score).toBe(80);
    expect(row?.aiSuggestion).toBe('Nice area for families.');
  });

  it('findByIdForDigest returns null when dismissed or no score', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      id: 'x2',
      dismissedAt: new Date(),
      scores: [],
    });
    expect(await repo.findByIdForDigest('x2')).toBeNull();
    prisma.listing.findUnique.mockResolvedValue({
      id: 'x3',
      dismissedAt: null,
      scores: [],
    });
    expect(await repo.findByIdForDigest('x3')).toBeNull();
  });

  it('findTopForDigest sorts by score when risk is equal', async () => {
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'b',
        canonicalUrl: 'u2',
        listingUrl: null,
        source: null,
        title: 't2',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        telegramSentAt: null,
        priceChangedAt: null,
        scores: [
          {
            score: 40,
            reasons: '[]',
            llmSummary: null,
            riskLevel: 'none',
            riskReasons: '[]',
          },
        ],
      },
      {
        id: 'a',
        canonicalUrl: 'u1',
        listingUrl: null,
        source: null,
        title: 't',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        telegramSentAt: null,
        priceChangedAt: null,
        scores: [
          {
            score: 90,
            reasons: '[]',
            llmSummary: null,
            riskLevel: 'none',
            riskReasons: '[]',
          },
        ],
      },
    ]);
    const top = await repo.findTopForDigest(5);
    expect(top[0].score).toBe(90);
  });

  it('findTopForDigest sorts and filters', async () => {
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'a',
        canonicalUrl: 'u1',
        listingUrl: null,
        source: null,
        title: 't',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        telegramSentAt: null,
        priceChangedAt: null,
        scores: [
          {
            score: 90,
            reasons: '[]',
            llmSummary: null,
            riskLevel: 'none',
            riskReasons: '[]',
          },
        ],
      },
      {
        id: 'b',
        canonicalUrl: 'u2',
        listingUrl: null,
        source: null,
        title: 't2',
        rentEur: 800,
        condoFeeEur: null,
        totalCostEur: null,
        areaSqm: 70,
        rooms: 2,
        locationHint: null,
        telegramSentAt: null,
        priceChangedAt: null,
        scores: [],
      },
    ]);
    const top = await repo.findTopForDigest(5);
    expect(top).toHaveLength(1);
    expect(top[0].score).toBe(90);
  });

  it('countDuplicateSkipsSince', async () => {
    expect(await repo.countDuplicateSkipsSince(new Date())).toBe(0);
  });
});
