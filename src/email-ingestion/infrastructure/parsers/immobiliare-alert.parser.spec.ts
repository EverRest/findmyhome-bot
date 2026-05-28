import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ImmobiliareAlertParser } from './immobiliare-alert.parser';

describe('ImmobiliareAlertParser', () => {
  const parser = new ImmobiliareAlertParser();
  const html = readFileSync(
    resolve(
      __dirname,
      '../../../../test/fixtures/immobiliare-alert-snippet.html',
    ),
    'utf8',
  );

  const email = {
    gmailMessageId: '1',
    subject: '36 new listings for your search : Properties for rent in Torino',
    fromAddress: 'noreply@notifiche.immobiliare.it',
    receivedAt: new Date(),
    htmlBody: html,
    textBody: '',
  };

  it('matches immobiliare alert emails', () => {
    expect(parser.canParse(email)).toBe(true);
  });

  it('extracts real flats, not footer links', () => {
    const drafts = parser.parse(email);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].title).toContain('Ormea');
    expect(drafts[0].rentEur).toBe(750);
    expect(drafts[0].rooms).toBe(2);
    expect(drafts[0].areaSqm).toBe(41);
    expect(drafts[0].canonicalUrl).toContain('immobiliare.it/annunci/alert-');
    expect(drafts[0].listingUrl).toContain('clicks.immobiliare.it');
    expect(drafts[0].locationHint?.toLowerCase()).toContain('san salvario');
  });

  it('parses protocol-relative click links', () => {
    const drafts = parser.parse({
      ...email,
      htmlBody:
        '<a href="clicks.immobiliare.it/f/a/abc123">2-room flat via Ormea, San Salvario — 750 €/month, 41 m²</a>',
    });
    expect(drafts[0].listingUrl).toMatch(/^https:\/\//);
  });

  it('falls back to title slice for location hint', () => {
    const drafts = parser.parse({
      ...email,
      htmlBody:
        '<table><tr><td><a href="https://clicks.immobiliare.it/f/a/x">2-room studio Torino listings</a> 750 €/month, 41 m²</td></tr></table>',
    });
    expect(drafts[0].locationHint).toBe('2-room studio Torino listings');
  });

  it('extracts zone from Turin block pattern', () => {
    const drafts = parser.parse({
      ...email,
      htmlBody:
        '<table><tr><td><a href="https://clicks.immobiliare.it/f/a/x">2-room studio Torino listings</a>, San Salvario, Turin — 750 €/month, 41 m²</td></tr></table>',
    });
    expect(drafts[0].locationHint?.toLowerCase()).toContain('san salvario');
  });

  it('extracts zone from block when title has no via', () => {
    const drafts = parser.parse({
      ...email,
      htmlBody:
        '<table><tr><td><a href="https://clicks.immobiliare.it/f/a/x">2-room flat Torino</a>, San Salvario, Turin — 750 €/month, 41 m²</td></tr></table>',
    });
    expect(drafts[0].locationHint?.toLowerCase()).toMatch(
      /san salvario|torino/,
    );
  });
});
