import { computePropertyMatchKey } from './listing-property-match';
import { computeListingFingerprint } from './listing-fingerprint';

describe('computePropertyMatchKey', () => {
  it('matches same flat when area differs', () => {
    const a = computePropertyMatchKey({
      title: 'Trilocale via Prali 2, Cenisia',
      locationHint: 'via Prali 2, Cenisia, Torino',
      rentEur: 600,
      rooms: 3,
      areaSqm: 50,
    });
    const b = computePropertyMatchKey({
      title: 'Trilocale via Prali 2, Cenisia',
      locationHint: 'Via Prali, 2, Cenisia, Torino',
      rentEur: 600,
      rooms: 3,
      areaSqm: 62,
    });
    expect(a).toBeTruthy();
    expect(a).toBe(b);
    expect(
      computeListingFingerprint({
        title: 'Trilocale via Prali 2',
        locationHint: 'via Prali 2',
        rentEur: 600,
        rooms: 3,
        areaSqm: 50,
      }),
    ).not.toBe(
      computeListingFingerprint({
        title: 'Trilocale via Prali 2',
        locationHint: 'via Prali 2',
        rentEur: 600,
        rooms: 3,
        areaSqm: 62,
      }),
    );
  });

  it('differs when rent differs', () => {
    const a = computePropertyMatchKey({
      title: 'Bilocale via Roma 1',
      rentEur: 600,
      rooms: 2,
    });
    const b = computePropertyMatchKey({
      title: 'Bilocale via Roma 1',
      rentEur: 700,
      rooms: 2,
    });
    expect(a).not.toBe(b);
  });

  it('uses ? for rooms when missing', () => {
    const key = computePropertyMatchKey({
      title: 'Monolocale via Roma 1, Torino',
      rentEur: 500,
    });
    expect(key).toBe('via-roma-1|r?|€500');
  });

  it('returns null without parseable street', () => {
    expect(
      computePropertyMatchKey({
        title: 'Bilocale Cenisia',
        rentEur: 600,
        rooms: 2,
      }),
    ).toBeNull();
  });
});
