import { FetchAndParseEmailsUseCase } from './fetch-and-parse-emails.use-case';
import {
  mockConfig,
  mockCriteriaLoader,
  mockStepLogger,
} from '../../../test/helpers/test-utils';

describe('FetchAndParseEmailsUseCase', () => {
  const gmail = {
    isConfigured: jest.fn(),
    fetchSince: jest.fn(),
  };
  const parsers = { parse: jest.fn() };
  const listings = {
    existsProcessedEmail: jest.fn(),
    upsertFromDraft: jest.fn(),
    markEmailProcessed: jest.fn(),
  };
  const log = mockStepLogger();

  const useCase = new FetchAndParseEmailsUseCase(
    gmail,
    parsers,
    listings as never,
    mockConfig(),
    mockCriteriaLoader() as never,
    log as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('skips when gmail not configured', async () => {
    gmail.isConfigured.mockReturnValue(false);
    const r = await useCase.execute(new Date());
    expect(r.emailsProcessed).toBe(0);
  });

  it('processes emails and upserts drafts', async () => {
    gmail.isConfigured.mockReturnValue(true);
    gmail.fetchSince.mockResolvedValue([
      {
        gmailMessageId: 'm1',
        subject: 'affitto',
        fromAddress: 'idealista <x@idealista.it>',
        receivedAt: new Date(),
        htmlBody:
          '<a href="https://www.idealista.it/affitto-case/torino/">x</a>',
        textBody: '',
      },
    ]);
    listings.existsProcessedEmail.mockResolvedValue(false);
    parsers.parse.mockReturnValue([
      {
        canonicalUrl: 'https://www.idealista.it/immobile/1/',
        title: 'Bilocale Cenisia',
        locationHint: 'Cenisia, Torino',
        rooms: 2,
        areaSqm: 70,
        rentEur: 750,
        rawSnippet: '750 €/mese Cenisia',
      },
    ]);
    listings.upsertFromDraft.mockResolvedValue({
      isNew: true,
      priceChanged: false,
      materialChanged: false,
    });

    const r = await useCase.execute(new Date());
    expect(r.emailsProcessed).toBe(1);
    expect(r.listingsNew).toBe(1);
  });

  it('updates existing listing without counting as new', async () => {
    gmail.isConfigured.mockReturnValue(true);
    gmail.fetchSince.mockResolvedValue([
      {
        gmailMessageId: 'm3',
        subject: 'affitto',
        fromAddress: 'idealista <x@idealista.it>',
        receivedAt: new Date(),
        htmlBody:
          '<a href="https://www.idealista.it/immobile/2/">750 €/mese</a>',
        textBody: '',
      },
    ]);
    listings.existsProcessedEmail.mockResolvedValue(false);
    parsers.parse.mockReturnValue([
      {
        canonicalUrl: 'https://www.idealista.it/immobile/2/',
        title: 'Bilocale Cenisia',
        locationHint: 'Cenisia, Torino',
        rooms: 2,
        areaSqm: 70,
        rentEur: 750,
        rawSnippet: '750 €/mese Cenisia',
      },
    ]);
    listings.upsertFromDraft.mockResolvedValue({
      isNew: false,
      priceChanged: false,
      materialChanged: true,
    });
    const r = await useCase.execute(new Date());
    expect(r.listingsNew).toBe(0);
    expect(r.duplicatesSkipped).toBe(1);
  });

  it('skips non-rent drafts from sale-like alerts', async () => {
    gmail.isConfigured.mockReturnValue(true);
    gmail.fetchSince.mockResolvedValue([
      {
        gmailMessageId: 'm-sale',
        subject: 'vendita',
        fromAddress: 'idealista <x@idealista.it>',
        receivedAt: new Date(),
        htmlBody:
          '<a href="https://www.idealista.it/vendita-case/torino/">x</a>',
        textBody: '',
      },
    ]);
    listings.existsProcessedEmail.mockResolvedValue(false);
    parsers.parse.mockReturnValue([
      {
        canonicalUrl: 'https://www.idealista.it/vendita-case/torino/',
        rawSnippet: 'vendita',
      },
    ]);
    const r = await useCase.execute(new Date());
    expect(r.listingsParsed).toBe(0);
  });

  it('skips drafts failing hard criteria', async () => {
    gmail.isConfigured.mockReturnValue(true);
    gmail.fetchSince.mockResolvedValue([
      {
        gmailMessageId: 'm-hard',
        subject: 'Un nuovo annuncio: 500 € | 27 mq | Crocetta, Torino',
        fromAddress: '"Casa.it" <noreply@casa.it>',
        receivedAt: new Date(),
        htmlBody: '<a href="https://www.casa.it/immobili/99/">monolocale</a>',
        textBody: '',
      },
    ]);
    listings.existsProcessedEmail.mockResolvedValue(false);
    parsers.parse.mockReturnValue([
      {
        canonicalUrl: 'https://www.casa.it/immobili/99/',
        title: 'Monolocale Crocetta Torino',
        locationHint: 'Crocetta, Torino',
        rooms: 1,
        areaSqm: 27,
        rentEur: 500,
        rawSnippet: 'affitto monolocale 500 euro/mese',
      },
    ]);

    const r = await useCase.execute(new Date());
    expect(r.listingsParsed).toBe(0);
    expect(listings.upsertFromDraft).not.toHaveBeenCalled();
    expect(log._ctx.debug).toHaveBeenCalledWith(
      'listing',
      'Skip — hard criteria',
      expect.objectContaining({
        url: 'https://www.casa.it/immobili/99/',
      }),
    );
  });

  it('skips already processed emails', async () => {
    gmail.isConfigured.mockReturnValue(true);
    gmail.fetchSince.mockResolvedValue([
      {
        gmailMessageId: 'm2',
        subject: 's',
        fromAddress: 'x',
        receivedAt: new Date(),
        htmlBody: '',
        textBody: '',
      },
    ]);
    listings.existsProcessedEmail.mockResolvedValue(true);
    const r = await useCase.execute(new Date());
    expect(r.emailsSkippedAlreadyProcessed).toBe(1);
  });
});
