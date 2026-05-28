import { computeListingFingerprint } from './listing-fingerprint';

describe('computeListingFingerprint', () => {
  it('matches Immobiliare and Idealista titles for same flat', () => {
    const immobiliare = computeListingFingerprint({
      title: '3-room flat via Prali 2, Cenisia, Turin',
      locationHint: 'via Prali 2, Cenisia, Turin',
      rentEur: 600,
      rooms: 3,
      areaSqm: 60,
    });
    const idealista = computeListingFingerprint({
      title: 'Trilocale in Via Prali, 2, Cenisia, Torino',
      locationHint: 'Via Prali, 2, Cenisia, Torino',
      rentEur: 600,
      rooms: 3,
      areaSqm: 60,
    });
    expect(immobiliare).toBeTruthy();
    expect(immobiliare).toBe(idealista);
  });

  it('returns null without rent', () => {
    expect(
      computeListingFingerprint({
        title: 'Bilocale via Roma 1',
        rentEur: undefined,
        rooms: 2,
        areaSqm: 70,
      }),
    ).toBeNull();
  });

  it('returns null without a parseable street', () => {
    expect(
      computeListingFingerprint({
        title: 'Bilocale Cenisia',
        rentEur: 600,
        rooms: 2,
        areaSqm: 60,
      }),
    ).toBeNull();
  });

  it('differs when rent differs', () => {
    const a = computeListingFingerprint({
      title: 'Bilocale via Roma 1, Torino',
      rentEur: 600,
      rooms: 2,
      areaSqm: 60,
    });
    const b = computeListingFingerprint({
      title: 'Bilocale via Roma 1, Torino',
      rentEur: 700,
      rooms: 2,
      areaSqm: 60,
    });
    expect(a).not.toBe(b);
  });
});
