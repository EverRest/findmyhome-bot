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
    listingFingerprint: null,
    possibleDuplicateOf: null,
    distanceToRefM: null,
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

  it('shows distance when reference point configured', () => {
    const text = formatListingCard(base({ distanceToRefM: 650 }), {
      referencePointName: 'Piazza Bernini',
    });
    expect(text).toContain('📍 ~650 m from Piazza Bernini');
  });

  it('hides distance without reference point name', () => {
    const text = formatListingCard(base({ distanceToRefM: 650 }));
    expect(text).not.toContain('📍');
  });

  it('shows possible duplicate hint with primary link', () => {
    const text = formatListingCard(
      base({
        possibleDuplicateOf: {
          id: 'primary',
          source: 'idealista.it',
          canonicalUrl: 'https://www.idealista.it/immobile/99/',
          title: 'Trilocale Via Prali 2',
        },
      }),
    );
    expect(text).toContain('↔️ Possible duplicate');
    expect(text).toContain('Trilocale Via Prali 2');
    expect(text).toContain('idealista.it/immobile/99');
  });

  it('shows possible duplicate without link when primary URL is alert-only', () => {
    const text = formatListingCard(
      base({
        possibleDuplicateOf: {
          id: 'primary',
          source: 'immobiliare.it',
          canonicalUrl: 'https://www.immobiliare.it/annunci/alert-abc123/',
          title: 'Flat via Prali',
        },
      }),
    );
    expect(text).toContain(
      '↔️ Possible duplicate (same address/rent/rooms): Flat via Prali',
    );
    expect(text).not.toMatch(/immobile\/99/);
    expect(
      text.split('\n').filter((l) => l.startsWith('   http')),
    ).toHaveLength(0);
  });

  it('uses portal source as duplicate label when primary title is blank', () => {
    const text = formatListingCard(
      base({
        possibleDuplicateOf: {
          id: 'primary',
          source: 'idealista.it',
          canonicalUrl: 'https://www.idealista.it/immobile/42/',
          title: '   ',
        },
      }),
    );
    expect(text).toContain('↔️ Possible duplicate');
    expect(text).toContain('idealista.it');
  });

  it('uses fallback duplicate label when primary has no title or source', () => {
    const text = formatListingCard(
      base({
        possibleDuplicateOf: {
          id: 'primary',
          source: null,
          canonicalUrl: 'not-a-valid-listing-url',
          title: null,
        },
      }),
    );
    expect(text).toContain('earlier listing');
  });

  it('omits duplicate line when possibleDuplicateOf is null', () => {
    expect(formatListingCard(base())).not.toContain('↔️');
  });

  it('limits reasons to three items', () => {
    const text = formatListingCard(
      base({ reasons: ['a', 'b', 'c', 'd', 'e'] }),
    );
    expect(text).toContain('✅ a; b; c');
    expect(text).not.toContain('; d');
  });

  it('shows rent and condo without total line when totalCostEur is absent', () => {
    const text = formatListingCard(
      base({ rentEur: 700, condoFeeEur: 50, totalCostEur: null }),
    );
    expect(text).toContain('700');
    expect(text).toContain('spese 50');
    expect(text).not.toContain('total ~');
  });

  it('shows distance in km for long ranges', () => {
    const text = formatListingCard(base({ distanceToRefM: 2500 }), {
      referencePointName: 'Anchor',
    });
    expect(text).toContain('📍 ~2.5 km from Anchor');
  });

  it('ignores distance when reference point name is blank', () => {
    const text = formatListingCard(base({ distanceToRefM: 400 }), {
      referencePointName: '   ',
    });
    expect(text).not.toContain('📍');
  });

  it('has no risk emoji prefix for none risk level', () => {
    const text = formatListingCard(base({ riskLevel: 'none' }));
    expect(text).toMatch(/^🏠 80\/100/);
    expect(text).not.toMatch(/^🚨|^⚠️ 🏠/);
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
