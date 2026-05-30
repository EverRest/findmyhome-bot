import {
  canonicalizeUrl,
  extractCondoFee,
  extractEur,
  extractRooms,
  extractRoomsFromItalianTitle,
  extractSqm,
  normalizeImmobiliareRent,
  parseEuropeanAmount,
} from './url.utils';

describe('url.utils', () => {
  it('strips utm params', () => {
    expect(
      canonicalizeUrl('https://www.idealista.it/immobile/123?utm_source=alert'),
    ).toBe('https://www.idealista.it/immobile/123');
  });

  it('normalizes casa.it immobili id and drops aid param', () => {
    expect(
      canonicalizeUrl(
        'https://www.casa.it/immobili/54086676/?aid=MTU1NjA4MTY%3D&utm_source=alerts',
      ),
    ).toBe('https://www.casa.it/immobili/54086676/');
    expect(
      canonicalizeUrl(
        'https://www.casa.it/immobili/54086676/?aid=MTU1NjA4MzU%3D',
      ),
    ).toBe('https://www.casa.it/immobili/54086676/');
    expect(
      canonicalizeUrl('https://www.casa.it/annunci/12345/?utm_source=alert'),
    ).toBe('https://www.casa.it/annunci/12345/');
  });

  it('extracts eur and rooms', () => {
    expect(extractEur('Affitto 850 €/mese')).toBe(850);
    expect(extractEur('San Salvario € 750/month')).toBe(750);
    expect(extractEur('€ 1,200/month')).toBe(1200);
    expect(extractEur('€ 1.200/month')).toBe(1200);
    expect(extractEur('| 2 rooms | 1 bathroom')).toBeUndefined();
    expect(extractRooms('3 locali luminosi')).toBe(3);
    expect(extractRooms('80 m² 3 stanze 3º piano')).toBe(3);
    expect(extractRooms('41 m² | 2 rooms | 1 bathroom')).toBe(2);
    expect(extractSqm('72 m²')).toBe(72);
    expect(extractSqm('88 mq')).toBe(88);
  });

  it('parseEuropeanAmount handles IT formats', () => {
    expect(parseEuropeanAmount('1.200')).toBe(1200);
    expect(parseEuropeanAmount('1,200')).toBe(1200);
    expect(parseEuropeanAmount('1.000')).toBe(1000);
  });

  it('maps misparsed 1€ to 1000€ for Immobiliare', () => {
    expect(normalizeImmobiliareRent(1, '€ 1/month')).toBe(1000);
    expect(extractEur('€ 1.000/month 80 m²')).toBe(1000);
    expect(extractEur('€ 1,000/month')).toBe(1000);
  });

  it('ignores sale prices without monthly hint', () => {
    expect(extractEur('155.000 € 155 m²')).toBeUndefined();
    expect(extractEur('124.000 €')).toBeUndefined();
  });

  it('returns null for invalid canonicalizeUrl input', () => {
    expect(canonicalizeUrl('not-a-url')).toBeNull();
  });

  it('extracts rent before € symbol and rejects m² tail', () => {
    expect(extractEur('800 € al mese')).toBe(800);
    expect(extractEur('€ 50.000 senza mese')).toBeUndefined();
  });

  it('parseEuropeanAmount handles mixed separators', () => {
    expect(parseEuropeanAmount('')).toBeUndefined();
    expect(parseEuropeanAmount('2.500,50')).toBe(2501);
    expect(parseEuropeanAmount('1,234.56')).toBe(1235);
    expect(parseEuropeanAmount('1.0')).toBe(1000);
    expect(parseEuropeanAmount('1.000')).toBe(1000);
    expect(normalizeImmobiliareRent(750, 'x')).toBe(750);
    expect(normalizeImmobiliareRent(undefined, '€ 1.000')).toBe(1000);
  });

  it('extracts Italian title rooms and condo fee', () => {
    expect(extractRoomsFromItalianTitle('Monolocale luminoso')).toBe(1);
    expect(extractRoomsFromItalianTitle('Bilocale')).toBe(2);
    expect(extractRoomsFromItalianTitle('Trilocale')).toBe(3);
    expect(extractRoomsFromItalianTitle('Quadrilocale')).toBe(4);
    expect(extractRoomsFromItalianTitle('Villa')).toBeUndefined();
    expect(extractCondoFee('spese condominio 120 euro')).toBe(120);
    expect(extractRooms('5 camere')).toBe(5);
  });
});
