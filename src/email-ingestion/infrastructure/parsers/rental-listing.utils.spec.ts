import {
  isSaleAlertEmail,
  shouldPersistListingDraft,
} from './rental-listing.utils';

describe('rental-listing.utils', () => {
  it('detects Idealista vendita alerts from email HTML', () => {
    expect(
      isSaleAlertEmail({
        fromAddress: 'idealista <nonrispondere@idealista.it>',
        subject:
          'Nuova villa per la tua ricerca: Case e appartamenti a Torino Ovest!',
        htmlBody:
          '<a href="https://www.idealista.it/vendita-case/torino/">Vedi tutti</a> utm_campaign=express_newAd_sale_professional',
        textBody: '',
      }),
    ).toBe(true);
  });

  it('does not flag affitto search emails', () => {
    expect(
      isSaleAlertEmail({
        fromAddress: 'idealista <nonrispondere@idealista.it>',
        subject: 'Nuovo annuncio affitto Torino',
        htmlBody:
          '<a href="https://www.idealista.it/affitto-case/torino/">Vedi tutti</a> 750 €/mese',
        textBody: '',
      }),
    ).toBe(false);
  });

  it('detects immobiliare vendita in subject or body', () => {
    expect(
      isSaleAlertEmail({
        fromAddress: 'noreply@notifiche.immobiliare.it',
        subject: 'Appartamenti in vendita a Torino',
        htmlBody: 'solo annunci',
        textBody: '',
      }),
    ).toBe(true);
  });

  it('rejects high sale-like rent without monthly hint', () => {
    expect(
      shouldPersistListingDraft(
        {
          canonicalUrl: 'https://x',
          rentEur: 2000,
          rawSnippet: '2000 €',
        },
        {
          fromAddress: 'other@test.com',
          subject: 'x',
          htmlBody: '',
          textBody: '',
        },
      ),
    ).toBe(false);
  });

  it('allows draft with monthly rent hint', () => {
    expect(
      shouldPersistListingDraft(
        {
          canonicalUrl: 'https://x',
          rentEur: 800,
          rawSnippet: '800 €/mese',
        },
        {
          fromAddress: 'other@test.com',
          subject: 'x',
          htmlBody: '',
          textBody: '',
        },
      ),
    ).toBe(true);
  });

  it('shouldPersist returns false for sale alerts', () => {
    expect(
      shouldPersistListingDraft(
        { canonicalUrl: 'https://x', rentEur: 800, rawSnippet: '750 €/mese' },
        {
          fromAddress: 'idealista <x@idealista.it>',
          subject: 'vendita torino',
          htmlBody: 'vendita-case',
          textBody: '',
        },
      ),
    ).toBe(false);
  });

  it('skips Idealista drafts without monthly rent', () => {
    expect(
      shouldPersistListingDraft(
        {
          canonicalUrl: 'https://www.idealista.it/immobile/1/',
          title: 'Trilocale in Via X',
          rentEur: undefined,
          rawSnippet: '124.000 € 80 m² 3 stanze',
        },
        {
          fromAddress: 'idealista <nonrispondere@idealista.it>',
          subject: 'Diminuzione di prezzo',
          htmlBody: 'affitto-case',
          textBody: '',
        },
      ),
    ).toBe(false);
  });
});
