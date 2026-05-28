import { processTelegramSendJob } from './process-telegram-send-job';

describe('processTelegramSendJob', () => {
  const telegram = { sendText: jest.fn().mockResolvedValue('99') };
  const listings = {
    shouldSendToTelegram: jest.fn(),
    findByIdForDigest: jest.fn(),
    markTelegramSent: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('sends plain text jobs', async () => {
    await processTelegramSendJob(
      { kind: 'text', text: 'hello' },
      telegram as never,
      listings as never,
    );
    expect(telegram.sendText).toHaveBeenCalledWith('hello');
  });

  it('sends listing card when allowed', async () => {
    listings.shouldSendToTelegram.mockResolvedValue(true);
    listings.findByIdForDigest.mockResolvedValue({
      id: 'l1',
      canonicalUrl: 'https://x',
      listingUrl: 'https://x',
      source: null,
      title: 'Flat',
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
    });
    await processTelegramSendJob(
      { kind: 'listing-card', listingId: 'l1' },
      telegram as never,
      listings as never,
    );
    expect(listings.markTelegramSent).toHaveBeenCalledWith('l1', '99');
  });

  it('skips listing when should not send', async () => {
    listings.shouldSendToTelegram.mockResolvedValue(false);
    await processTelegramSendJob(
      { kind: 'listing-card', listingId: 'l1' },
      telegram as never,
      listings as never,
    );
    expect(telegram.sendText).not.toHaveBeenCalled();
  });

  it('skips when listing not found in DB', async () => {
    listings.shouldSendToTelegram.mockResolvedValue(true);
    listings.findByIdForDigest.mockResolvedValue(null);
    await processTelegramSendJob(
      { kind: 'listing-card', listingId: 'missing' },
      telegram as never,
      listings as never,
    );
    expect(telegram.sendText).not.toHaveBeenCalled();
    expect(listings.markTelegramSent).not.toHaveBeenCalled();
  });
});
