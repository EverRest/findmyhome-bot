import { isListingPageUrl } from './listing-url.utils';

describe('isListingPageUrl', () => {
  it('accepts immobiliare annunci', () => {
    expect(
      isListingPageUrl('https://www.immobiliare.it/annunci/12345678/'),
    ).toBe(true);
  });

  it('rejects click tracking', () => {
    expect(
      isListingPageUrl('https://clicks.immobiliare.it/f/a/abc~~/AAAHahA~/xyz'),
    ).toBe(false);
  });

  it('accepts idealista immobile pages', () => {
    expect(
      isListingPageUrl('https://www.idealista.it/immobile/35042946/'),
    ).toBe(true);
  });

  it('rejects idealista search hub pages', () => {
    expect(
      isListingPageUrl('https://www.idealista.it/vendita-case/torino/'),
    ).toBe(false);
  });

  it('rejects invalid urls and accepts other portals', () => {
    expect(isListingPageUrl('not-a-url')).toBe(false);
    expect(isListingPageUrl('https://www.fotocasa.es/alquiler/x/')).toBe(true);
    expect(isListingPageUrl('https://www.casa.it/annunci/123/')).toBe(true);
    expect(isListingPageUrl('https://www.casa.it/immobili/54077076/')).toBe(
      true,
    );
    expect(isListingPageUrl('https://www.casa.it/srp/?tr=affitti')).toBe(false);
    expect(isListingPageUrl('https://www.subito.it/affitto/torino/')).toBe(
      true,
    );
    expect(isListingPageUrl('https://unknown.example/foo')).toBe(false);
  });
});
