import { formatListingCard } from './format-listing-card';
import type { ListingForDigest } from '../../listing/domain/listing.repository.port';

function base(overrides: Partial<ListingForDigest> = {}): ListingForDigest {
  return {
    id: '1',
    canonicalUrl: 'https://www.idealista.it/immobile/1/',
    listingUrl: 'https://www.idealista.it/immobile/1/',
    source: 'idealista.it',
    title: 'Trilocale Cenisia',
    rentEur: 750,
    condoFeeEur: 90,
    totalCostEur: 840,
    areaSqm: 72,
    rooms: 2,
    locationHint: 'Cenisia',
    score: 80,
    reasons: ['ok'],
    aiSuggestion: null,
    riskLevel: 'none',
    riskReasons: [],
    telegramSentAt: null,
    priceChangedAt: null,
    ...overrides,
  };
}

describe('formatListingCard', () => {
  it('shows AI suggestion when present', () => {
    const text = formatListingCard(
      base({ aiSuggestion: 'Strong Cenisia fit; confirm elevator.' }),
    );
    expect(text).toContain('💡 Strong Cenisia fit');
  });

  it('formats full card with link', () => {
    const text = formatListingCard(base());
    expect(text).toContain('80/100');
    expect(text).toContain('idealista.it');
    expect(text).toContain('🔗');
  });

  it('shows risk prefix for high risk', () => {
    const text = formatListingCard(
      base({ riskLevel: 'high', riskReasons: ['suspicious'] }),
    );
    expect(text).toContain('🚨');
    expect(text).toContain('suspicious');
  });

  it('shows medium/low risk prefix', () => {
    expect(formatListingCard(base({ riskLevel: 'medium' }))).toContain('⚠️');
    expect(formatListingCard(base({ riskLevel: 'low' }))).toContain('⚠️');
  });

  it('formats minimal card without optional fields', () => {
    const text = formatListingCard(
      base({
        title: null,
        rooms: null,
        areaSqm: null,
        locationHint: null,
        rentEur: null,
        condoFeeEur: null,
        totalCostEur: null,
        reasons: [],
        source: null,
        listingUrl: 'https://www.idealista.it/immobile/1/',
      }),
    );
    expect(text).toContain('Listing');
    expect(text).not.toContain('€/mo');
  });

  it('shows total cost only with condo fee', () => {
    const withTotal = formatListingCard(
      base({ totalCostEur: 900, condoFeeEur: 100 }),
    );
    expect(withTotal).toContain('total');
    const noCondo = formatListingCard(
      base({ totalCostEur: 900, condoFeeEur: null }),
    );
    expect(noCondo).not.toContain('total');
  });

  it('falls back when no openable link', () => {
    const text = formatListingCard(
      base({
        listingUrl: null,
        canonicalUrl: 'https://www.immobiliare.it/annunci/alert-abc/',
      }),
    );
    expect(text).toContain('pipeline/run');
  });
});
