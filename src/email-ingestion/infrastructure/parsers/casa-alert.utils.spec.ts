import { parseCasaAlertSubject } from './casa-alert.utils';

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
