import {
  baseDomainFromHost,
  formatSourceLine,
  inferListingSource,
  portalHomeFromUrl,
  portalHomeUrl,
} from './listing-source';

describe('listing-source', () => {
  it('extracts base domain from host', () => {
    expect(baseDomainFromHost('clicks.immobiliare.it')).toBe('immobiliare.it');
    expect(baseDomainFromHost('www.idealista.it')).toBe('idealista.it');
    expect(baseDomainFromHost('www.fotocasa.es')).toBe('fotocasa.es');
  });

  it('builds portal home from url without hardcoded map', () => {
    expect(portalHomeFromUrl('https://clicks.immobiliare.it/f/a/x')).toBe(
      'https://www.immobiliare.it',
    );
    expect(portalHomeFromUrl('https://www.idealista.it/affitto/1/')).toBe(
      'https://www.idealista.it',
    );
  });

  it('formatSourceLine from listing url', () => {
    expect(
      formatSourceLine(null, 'https://clicks.immobiliare.it/f/a/abc'),
    ).toBe('📌 https://www.immobiliare.it');
  });

  it('formatSourceLine from stored source key', () => {
    expect(formatSourceLine('idealista.it', null, null)).toBe(
      '📌 https://www.idealista.it',
    );
  });

  it('formatSourceLine for facebook group', () => {
    expect(
      formatSourceLine(
        'facebook.group',
        'https://www.facebook.com/groups/1/posts/2/',
      ),
    ).toContain('Facebook');
    expect(formatSourceLine('facebook.group', '/groups/1/posts/2/', null)).toBe(
      '📌 Facebook group',
    );
  });

  it('handles invalid urls and short hosts', () => {
    expect(baseDomainFromHost('localhost')).toBeNull();
    expect(portalHomeFromUrl('not-a-url')).toBeNull();
    expect(inferListingSource('nodot', null, undefined)).toBeUndefined();
    expect(portalHomeUrl(undefined, null, null)).toBeNull();
    expect(inferListingSource('idealista.it', null, null)).toBe('idealista.it');
  });
});
