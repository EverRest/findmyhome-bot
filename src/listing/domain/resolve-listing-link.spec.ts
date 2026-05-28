import { resolveListingLink } from './resolve-listing-link';

describe('resolveListingLink', () => {
  it('prefers listingUrl over synthetic canonical', () => {
    expect(
      resolveListingLink({
        canonicalUrl: 'https://www.immobiliare.it/annunci/alert-abc/',
        listingUrl: 'https://clicks.immobiliare.it/f/a/xyz',
      }),
    ).toBe('https://clicks.immobiliare.it/f/a/xyz');
  });

  it('returns null for synthetic canonical without listingUrl', () => {
    expect(
      resolveListingLink({
        canonicalUrl: 'https://www.immobiliare.it/annunci/alert-abc/',
        listingUrl: null,
      }),
    ).toBeNull();
  });

  it('uses canonicalUrl when it is a real http link', () => {
    expect(
      resolveListingLink({
        canonicalUrl: 'https://www.idealista.it/immobile/1/',
        listingUrl: null,
      }),
    ).toBe('https://www.idealista.it/immobile/1/');
  });

  it('returns null when canonical is not http', () => {
    expect(
      resolveListingLink({
        canonicalUrl: '/relative/path',
        listingUrl: null,
      }),
    ).toBeNull();
  });
});
