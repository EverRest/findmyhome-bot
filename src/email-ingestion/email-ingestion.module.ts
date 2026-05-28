import { Module } from '@nestjs/common';
import { ListingModule } from '../listing/listing.module';
import { FetchAndParseEmailsUseCase } from './application/fetch-and-parse-emails.use-case';
import { GMAIL_PORT } from './domain/gmail.port';
import { LISTING_PARSER_REGISTRY } from './domain/listing-parser.port';
import { GmailApiAdapter } from './infrastructure/gmail-api.adapter';
import { GenericLinkParser } from './infrastructure/parsers/generic-link.parser';
import { IdealistaAlertParser } from './infrastructure/parsers/idealista-alert.parser';
import { ImmobiliareAlertParser } from './infrastructure/parsers/immobiliare-alert.parser';
import { ParserRegistry } from './infrastructure/parsers/parser.registry';

@Module({
  imports: [ListingModule],
  providers: [
    GmailApiAdapter,
    GenericLinkParser,
    ImmobiliareAlertParser,
    IdealistaAlertParser,
    ParserRegistry,
    FetchAndParseEmailsUseCase,
    { provide: GMAIL_PORT, useExisting: GmailApiAdapter },
    { provide: LISTING_PARSER_REGISTRY, useExisting: ParserRegistry },
  ],
  exports: [FetchAndParseEmailsUseCase, GMAIL_PORT],
})
export class EmailIngestionModule {}
