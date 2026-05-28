import { GenericLinkParser } from './generic-link.parser';

describe('GenericLinkParser', () => {
  const parser = new GenericLinkParser();

  it('parses idealista link from html fixture', () => {
    const html = `<a href="https://www.idealista.it/affitto/99/">3 locali, 72 m², Monte Grappa — 750 €/mese</a>`;
    const drafts = parser.parse({
      gmailMessageId: '1',
      subject: 'alert',
      fromAddress: 'alert@idealista.com',
      receivedAt: new Date(),
      htmlBody: html,
      textBody: '',
    });
    expect(drafts.length).toBe(1);
    expect(drafts[0].canonicalUrl).toContain('idealista.it');
    expect(drafts[0].rentEur).toBe(750);
    expect(drafts[0].rooms).toBe(3);
  });

  it('uses textBody when html is empty', () => {
    const drafts = parser.parse({
      gmailMessageId: '3',
      subject: 'x',
      fromAddress: 'x',
      receivedAt: new Date(),
      htmlBody: '',
      textBody:
        '<a href="https://www.idealista.it/immobile/2/">Bilocale 650 €/mese</a>',
    });
    expect(drafts.length).toBe(1);
  });

  it('ignores non-listing and invalid links', () => {
    const drafts = parser.parse({
      gmailMessageId: '4',
      subject: 'x',
      fromAddress: 'x',
      receivedAt: new Date(),
      htmlBody:
        '<a>x</a><a href="https://example.com/foo">x</a><a href="not-a-url">y</a><a href="https://www.idealista.it/vendita-case/torino/">z</a>',
      textBody: '',
    });
    expect(drafts).toHaveLength(0);
  });

  it('rejects malformed urls in isAllowed', () => {
    const p = parser as unknown as {
      isAllowed(url: string): boolean;
      detectSource(url: string): string | undefined;
    };
    expect(p.isAllowed('not-a-valid-url')).toBe(false);
    expect(p.detectSource('not-a-valid-url')).toBeUndefined();
  });

  it('canParse always true', () => {
    expect(
      parser.canParse({
        gmailMessageId: '5',
        subject: '',
        fromAddress: '',
        receivedAt: new Date(),
        htmlBody: '',
        textBody: '',
      }),
    ).toBe(true);
  });

  it('parses casa.it CTA link using email subject', () => {
    const html = `<a href="https://www.casa.it/immobili/54076163/?utm_source=alerts-casa&amp;utm_medium=email"> Vedi 1 foto e dettagli </a>`;
    const drafts = parser.parse({
      gmailMessageId: 'casa1',
      subject: 'Un nuovo annuncio: 1.060 € | 88 mq | Via Filadelfia, Torino',
      fromAddress: '"Casa.it" <noreply@casa.it>',
      receivedAt: new Date(),
      htmlBody: html,
      textBody: '',
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].canonicalUrl).toContain('/immobili/54076163');
    expect(drafts[0].rentEur).toBe(1060);
    expect(drafts[0].areaSqm).toBe(88);
    expect(drafts[0].title).toContain('Via Filadelfia');
    expect(drafts[0].title).not.toMatch(/vedi\s+foto/i);
  });

  it('parses Turin zone in snippet', () => {
    const html = `<a href="https://www.idealista.it/affitto/1/">3 locali, Cenisia, 750 €/mese</a>`;
    const drafts = parser.parse({
      gmailMessageId: '2',
      subject: 'x',
      fromAddress: 'x',
      receivedAt: new Date(),
      htmlBody: html,
      textBody: '',
    });
    expect(drafts[0].rawSnippet?.toLowerCase()).toContain('cenisia');
  });
});
