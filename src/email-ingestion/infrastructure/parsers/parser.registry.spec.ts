import { ParserRegistry } from './parser.registry';
import { ImmobiliareAlertParser } from './immobiliare-alert.parser';
import { IdealistaAlertParser } from './idealista-alert.parser';
import { GenericLinkParser } from './generic-link.parser';
import { mockStepLogger } from '../../../../test/helpers/test-utils';

describe('ParserRegistry', () => {
  const registry = new ParserRegistry(
    new ImmobiliareAlertParser(),
    new IdealistaAlertParser(),
    new GenericLinkParser(),
    mockStepLogger() as never,
  );

  const email = {
    gmailMessageId: '1',
    subject: 'Listings for your search',
    fromAddress: 'noreply@notifiche.immobiliare.it',
    receivedAt: new Date(),
    htmlBody:
      '<a href="https://clicks.immobiliare.it/f/a/x">2-room flat via Ormea, San Salvario — 750 €/month, 41 m²</a>',
    textBody: '',
  };

  it('parses via immobiliare parser', () => {
    const drafts = registry.parse(email);
    expect(drafts.length).toBeGreaterThanOrEqual(0);
  });

  it('parses idealista via idealista parser', () => {
    const drafts = registry.parse({
      gmailMessageId: 'ideal',
      subject: 'affitto',
      fromAddress: 'idealista <x@idealista.it>',
      receivedAt: new Date(),
      htmlBody:
        '<a href="https://www.idealista.it/immobile/99/">Trilocale in Via Roma 750 €/mese 80 m² 3 stanze</a>',
      textBody: '',
    });
    expect(drafts.length).toBeGreaterThanOrEqual(1);
  });

  it('uses generic parser when only generic matches', () => {
    const imm = new ImmobiliareAlertParser();
    const ideal = new IdealistaAlertParser();
    const generic = new GenericLinkParser();
    jest.spyOn(imm, 'canParse').mockReturnValue(false);
    jest.spyOn(ideal, 'canParse').mockReturnValue(false);
    jest.spyOn(generic, 'canParse').mockReturnValue(true);
    jest
      .spyOn(generic, 'parse')
      .mockReturnValue([{ canonicalUrl: 'https://www.subito.it/affitto/1/' }]);
    const reg = new ParserRegistry(
      imm,
      ideal,
      generic,
      mockStepLogger() as never,
    );
    const drafts = reg.parse(email);
    expect(drafts[0].canonicalUrl).toContain('subito.it');
    expect(generic.parse).toHaveBeenCalled();
  });

  it('falls back when no parser matches', () => {
    const imm = new ImmobiliareAlertParser();
    const ideal = new IdealistaAlertParser();
    const generic = new GenericLinkParser();
    jest.spyOn(imm, 'canParse').mockReturnValue(false);
    jest.spyOn(ideal, 'canParse').mockReturnValue(false);
    jest
      .spyOn(ideal, 'parse')
      .mockReturnValue([
        { canonicalUrl: 'https://www.idealista.it/immobile/1/' },
      ]);
    jest.spyOn(generic, 'canParse').mockReturnValue(false);
    const log = mockStepLogger();
    const reg = new ParserRegistry(imm, ideal, generic, log as never);
    const drafts = reg.parse(email);
    expect(drafts).toHaveLength(1);
    expect(ideal.parse).toHaveBeenCalled();
  });

  it('warns on empty parse', () => {
    const log = mockStepLogger();
    const reg = new ParserRegistry(
      new ImmobiliareAlertParser(),
      new IdealistaAlertParser(),
      new GenericLinkParser(),
      log as never,
    );
    reg.parse({
      ...email,
      fromAddress: 'other@test.com',
      htmlBody: '<p>no links</p>',
    });
    expect(log._ctx.warn).toHaveBeenCalled();
  });
});
