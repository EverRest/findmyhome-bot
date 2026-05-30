import {
  buildCasaListingTitle,
  isMeaningfulListingTitle,
  parseCasaAlertSubject,
} from './casa-alert.utils';

describe('parseCasaAlertSubject', () => {
  it('parses rent, area and address from subject', () => {
    const p = parseCasaAlertSubject(
      'Un nuovo annuncio: 1.060 € | 88 mq | Via Filadelfia, Torino',
    );
    expect(p.rentEur).toBe(1060);
    expect(p.areaSqm).toBe(88);
    expect(p.locationHint).toContain('Filadelfia');
    expect(p.title).toContain('88 m²');
  });
});

describe('isMeaningfulListingTitle', () => {
  it('rejects empty, Listing, and CTA text', () => {
    expect(isMeaningfulListingTitle(undefined)).toBe(false);
    expect(isMeaningfulListingTitle('Listing')).toBe(false);
    expect(isMeaningfulListingTitle('Vedi 1 foto e dettagli')).toBe(false);
    expect(
      isMeaningfulListingTitle('65 m² — Via Cesare Balbo 42, Torino'),
    ).toBe(true);
  });
});

describe('buildCasaListingTitle', () => {
  it('builds title from area and location when CTA has no text', () => {
    expect(
      buildCasaListingTitle({
        title: 'Vedi foto',
        areaSqm: 66,
        locationHint: 'Via Bligny 9, Torino',
        rentEur: 550,
      }),
    ).toBe('66 m² — Via Bligny 9, Torino');
  });

  it('falls back to rent-only title when area and location are missing', () => {
    expect(
      buildCasaListingTitle({
        title: 'Vedi foto',
        rentEur: 550,
      }),
    ).toBe('Affitto 550 €/mese');
  });

  it('returns undefined when no meaningful title fields exist', () => {
    expect(
      buildCasaListingTitle({
        title: 'Vedi foto',
      }),
    ).toBeUndefined();
  });
});
