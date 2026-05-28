import { readFileSync } from 'fs';
import { resolve } from 'path';
import { IdealistaAlertParser } from './idealista-alert.parser';

describe('IdealistaAlertParser', () => {
  const parser = new IdealistaAlertParser();

  it('matches idealista alert emails', () => {
    expect(
      parser.canParse({
        gmailMessageId: '1',
        subject: 'Test',
        fromAddress: 'idealista <nonrispondere@idealista.it>',
        receivedAt: new Date(),
        htmlBody: '',
        textBody: '',
      }),
    ).toBe(true);
  });

  it('returns no drafts for vendita (sale) alerts', () => {
    const html = readFileSync(
      resolve(
        __dirname,
        '../../../../test/fixtures/idealista-alert-snippet.html',
      ),
      'utf8',
    );
    const drafts = parser.parse({
      gmailMessageId: '1',
      subject: 'Diminuzione di prezzo: Case e appartamenti a Torino Ovest!',
      fromAddress: 'idealista <nonrispondere@idealista.it>',
      receivedAt: new Date(),
      htmlBody: html,
      textBody: '',
    });
    expect(drafts).toHaveLength(0);
  });

  it('extracts affitto listing with monthly rent', () => {
    const html = readFileSync(
      resolve(
        __dirname,
        '../../../../test/fixtures/idealista-affitto-alert-snippet.html',
      ),
      'utf8',
    );
    const drafts = parser.parse({
      gmailMessageId: '2',
      subject: 'Nuovo annuncio affitto Torino',
      fromAddress: 'idealista <nonrispondere@idealista.it>',
      receivedAt: new Date(),
      htmlBody: html,
      textBody: '',
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].title).toContain('Morandi');
    expect(drafts[0].canonicalUrl).toBe(
      'https://www.idealista.it/immobile/35042946/',
    );
    expect(drafts[0].rentEur).toBe(750);
    expect(drafts[0].areaSqm).toBe(80);
    expect(drafts[0].rooms).toBe(3);
  });

  it('keeps longer title for duplicate immobile ids', () => {
    const html = `
      <a href="https://www.idealista.it/immobile/5/">Mono</a>
      <a href="https://www.idealista.it/immobile/5/">Monolocale ampio in Via Roma 750 €/mese</a>
    `;
    const drafts = parser.parse({
      gmailMessageId: '5',
      subject: 'affitto',
      fromAddress: 'idealista <nonrispondere@idealista.it>',
      receivedAt: new Date(),
      htmlBody: html,
      textBody: '',
    });
    expect(drafts[0].title).toContain('Monolocale ampio');
  });

  it('falls back when ancestor walk finds no price block', () => {
    const nested =
      '<div>'.repeat(35) +
      '<a href="https://www.idealista.it/immobile/777/">Trilocale in Via Roma</a>' +
      '</div>'.repeat(35);
    const drafts = parser.parse({
      gmailMessageId: '4',
      subject: 'affitto',
      fromAddress: 'idealista <nonrispondere@idealista.it>',
      receivedAt: new Date(),
      htmlBody: nested,
      textBody: '',
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].canonicalUrl).toContain('777');
  });

  it('uses table text when parent walk has no price block', () => {
    const html = `
      <div><a href="https://www.idealista.it/immobile/12345/">Monolocale in Via Roma</a></div>
      <table><tr><td>230 €/mese · 30 m² · 1 stanza</td></tr></table>
    `;
    const drafts = parser.parse({
      gmailMessageId: '3',
      subject: 'Nuovo annuncio affitto',
      fromAddress: 'idealista <nonrispondere@idealista.it>',
      receivedAt: new Date(),
      htmlBody: html,
      textBody: '',
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].rentEur).toBe(230);
  });
});
