import {
  listingUrlScore,
  pickBetterTitle,
  pickPreferredListingUrl,
} from './listing-url-preference';

describe('listingUrlScore', () => {
  it('ranks direct portal URLs above tracking links', () => {
    expect(listingUrlScore('https://clicks.immobiliare.it/track')).toBe(1);
    expect(
      listingUrlScore('https://www.immobiliare.it/annunci/alert-abc/'),
    ).toBe(2);
    expect(listingUrlScore('https://www.immobiliare.it/annunci/123456/')).toBe(
      8,
    );
    expect(listingUrlScore('https://www.idealista.it/immobile/34232782/')).toBe(
      10,
    );
    expect(listingUrlScore('https://www.casa.it/immobili/54080187/')).toBe(10);
    expect(listingUrlScore('https://example.com/listing')).toBe(5);
    expect(listingUrlScore('not-a-url')).toBe(0);
  });
});

describe('pickPreferredListingUrl', () => {
  it('prefers idealista over alert and tracking links', () => {
    expect(
      pickPreferredListingUrl(
        'https://www.immobiliare.it/annunci/alert-abc/',
        'https://www.idealista.it/immobile/1/',
      ),
    ).toBe('https://www.idealista.it/immobile/1/');
  });

  it('returns undefined when both URLs are empty', () => {
    expect(pickPreferredListingUrl(null, undefined)).toBeUndefined();
    expect(pickPreferredListingUrl('  ', '')).toBeUndefined();
  });

  it('trims whitespace and keeps the only candidate', () => {
    expect(
      pickPreferredListingUrl(undefined, '  https://www.casa.it/immobili/1/  '),
    ).toBe('  https://www.casa.it/immobili/1/  ');
  });
});

describe('pickBetterTitle', () => {
  it('keeps the longer incoming title when both are present', () => {
    expect(pickBetterTitle('Short', 'Much longer incoming title')).toBe(
      'Much longer incoming title',
    );
  });

  it('keeps existing title when incoming is shorter or equal length', () => {
    expect(pickBetterTitle('Existing title here', 'Short')).toBe(
      'Existing title here',
    );
    expect(pickBetterTitle('Same len!!', 'Same len!!')).toBe('Same len!!');
  });

  it('returns the non-empty side when one title is missing', () => {
    expect(pickBetterTitle(undefined, 'Incoming only')).toBe('Incoming only');
    expect(pickBetterTitle('Existing only', undefined)).toBe('Existing only');
  });
});
