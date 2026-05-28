import { Injectable } from '@nestjs/common';
import { StepLoggerService } from '../../../shared/infrastructure/step-logger.service';
import { ListingDraft } from '../../../listing/domain/listing-draft';
import { IncomingEmail } from '../../domain/incoming-email';
import { ListingParserRegistryPort } from '../../domain/listing-parser.port';
import { GenericLinkParser } from './generic-link.parser';
import { IdealistaAlertParser } from './idealista-alert.parser';
import { ImmobiliareAlertParser } from './immobiliare-alert.parser';

@Injectable()
export class ParserRegistry implements ListingParserRegistryPort {
  private readonly log;
  private readonly parsers: Array<{
    name: string;
    canParse: (email: IncomingEmail) => boolean;
    parse: (email: IncomingEmail) => ListingDraft[];
  }>;

  constructor(
    private readonly immobiliare: ImmobiliareAlertParser,
    private readonly idealista: IdealistaAlertParser,
    private readonly generic: GenericLinkParser,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(ParserRegistry.name);
    this.parsers = [
      {
        name: this.immobiliare.name,
        canParse: (e) => this.immobiliare.canParse(e),
        parse: (e) => this.immobiliare.parse(e),
      },
      {
        name: this.idealista.name,
        canParse: (e) => this.idealista.canParse(e),
        parse: (e) => this.idealista.parse(e),
      },
      {
        name: this.generic.name,
        canParse: (e) => this.generic.canParse(e),
        parse: (e) => this.generic.parse(e),
      },
    ];
  }

  parse(email: IncomingEmail): ListingDraft[] {
    const parser =
      this.parsers.find((p) => p.canParse(email)) ?? this.parsers[1];
    const drafts = parser.parse(email);
    this.log.debug('parse', 'Registry parse complete', {
      messageId: email.gmailMessageId,
      parser: parser.name,
      count: drafts.length,
      urls: drafts.map((d) => d.canonicalUrl).slice(0, 5),
    });
    if (drafts.length === 0) {
      this.log.warn('parse', 'No listings in email', {
        messageId: email.gmailMessageId,
        subject: email.subject?.slice(0, 80),
        htmlLen: email.htmlBody.length,
      });
    }
    return drafts;
  }
}
