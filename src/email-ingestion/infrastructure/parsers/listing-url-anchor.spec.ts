import {
  extractIdealistaImmobileId,
  idealistaImmobileUrl,
  isIdealistaAlertEmail,
  isIdealistaListingAnchorText,
  isImmobiliareAlertEmail,
  isImmobiliareListingAnchorText,
} from './listing-url.utils';

describe('listing-url anchor helpers', () => {
  it('detects alert senders', () => {
    expect(
      isImmobiliareAlertEmail({
        fromAddress: 'noreply@immobiliare.it',
        subject: 'hello',
      }),
    ).toBe(true);
    expect(
      isImmobiliareAlertEmail({
        fromAddress: 'x',
        subject: 'nuovi annunci torino',
      }),
    ).toBe(true);
    expect(
      isIdealistaAlertEmail({ fromAddress: 'idealista <x@idealista.it>' }),
    ).toBe(true);
  });

  it('filters immobiliare anchor text', () => {
    expect(isImmobiliareListingAnchorText('short')).toBe(false);
    expect(isImmobiliareListingAnchorText('Disable search')).toBe(false);
    expect(
      isImmobiliareListingAnchorText(
        '2-room flat via Ormea, San Salvario — 750 €/month',
      ),
    ).toBe(true);
  });

  it('filters idealista anchor text', () => {
    expect(isIdealistaListingAnchorText('short')).toBe(false);
    expect(isIdealistaListingAnchorText('Vedi tutti gli annunci')).toBe(false);
    expect(isIdealistaListingAnchorText('Vedi 12 foto')).toBe(false);
    expect(isIdealistaListingAnchorText('Contatta')).toBe(false);
    expect(
      isIdealistaListingAnchorText('Trilocale in Via Roma 750 €/mese'),
    ).toBe(true);
    expect(isIdealistaListingAnchorText('Appartamento a Via Roma')).toBe(true);
  });

  it('builds idealista immobile urls', () => {
    expect(
      extractIdealistaImmobileId('https://www.idealista.it/immobile/42/'),
    ).toBe('42');
    expect(idealistaImmobileUrl('42')).toBe(
      'https://www.idealista.it/immobile/42/',
    );
  });
});
