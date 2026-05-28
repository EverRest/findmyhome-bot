import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import { LISTING_REPOSITORY } from '../../listing/domain/listing.repository.port';
import type { ListingRepositoryPort } from '../../listing/domain/listing.repository.port';
import { GMAIL_PORT } from '../domain/gmail.port';
import type { GmailPort } from '../domain/gmail.port';
import { LISTING_PARSER_REGISTRY } from '../domain/listing-parser.port';
import type { ListingParserRegistryPort } from '../domain/listing-parser.port';
import {
  getHardCriteriaFailures,
  meetsHardCriteria,
} from '../../listing/domain/listing-hard-criteria';
import { CriteriaLoaderService } from '../../shared/infrastructure/criteria-loader.service';
import { shouldPersistListingDraft } from '../infrastructure/parsers/rental-listing.utils';

export interface FetchAndParseResult {
  emailsProcessed: number;
  listingsParsed: number;
  listingsNew: number;
  duplicatesSkipped: number;
  emailsSkippedAlreadyProcessed: number;
}

@Injectable()
export class FetchAndParseEmailsUseCase {
  private readonly log;

  constructor(
    @Inject(GMAIL_PORT) private readonly gmail: GmailPort,
    @Inject(LISTING_PARSER_REGISTRY)
    private readonly parsers: ListingParserRegistryPort,
    @Inject(LISTING_REPOSITORY)
    private readonly listings: ListingRepositoryPort,
    private readonly config: ConfigService,
    private readonly criteria: CriteriaLoaderService,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(FetchAndParseEmailsUseCase.name);
  }

  async execute(since: Date): Promise<FetchAndParseResult> {
    const query = this.config.get<string>('GMAIL_QUERY') ?? 'newer_than:1d';

    if (!this.gmail.isConfigured()) {
      this.log.warn('gmail', 'Gmail not configured — skipping fetch');
      return {
        emailsProcessed: 0,
        listingsParsed: 0,
        listingsNew: 0,
        duplicatesSkipped: 0,
        emailsSkippedAlreadyProcessed: 0,
      };
    }

    const emails = await this.log.timed(
      'gmail',
      'Fetch messages',
      () => this.gmail.fetchSince(since, query),
      { query, since: since.toISOString() },
    );

    this.log.info('gmail', 'Messages fetched', { count: emails.length });

    let listingsParsed = 0;
    let listingsNew = 0;
    let duplicatesSkipped = 0;
    let listingsSkippedNonRent = 0;
    let listingsSkippedHardLimits = 0;
    const searchCriteria = this.criteria.get();
    let emailsProcessed = 0;
    let emailsSkippedAlreadyProcessed = 0;

    for (const email of emails) {
      if (await this.listings.existsProcessedEmail(email.gmailMessageId)) {
        emailsSkippedAlreadyProcessed++;
        this.log.debug('gmail', 'Email already processed — skip', {
          messageId: email.gmailMessageId,
          subject: email.subject?.slice(0, 60),
        });
        continue;
      }

      this.log.info('gmail', 'Processing email', {
        messageId: email.gmailMessageId,
        from: email.fromAddress,
        subject: email.subject?.slice(0, 80),
        receivedAt: email.receivedAt.toISOString(),
      });

      const allDrafts = this.parsers.parse(email);
      const drafts = allDrafts.filter((d) => {
        if (!shouldPersistListingDraft(d, email)) return false;
        if (!meetsHardCriteria(d, searchCriteria)) {
          listingsSkippedHardLimits++;
          this.log.debug('listing', 'Skip — hard criteria', {
            url: d.canonicalUrl,
            failures: getHardCriteriaFailures(d, searchCriteria),
          });
          return false;
        }
        return true;
      });
      const skippedNonRent =
        allDrafts.length - drafts.length - listingsSkippedHardLimits;
      listingsSkippedNonRent += skippedNonRent;
      listingsParsed += drafts.length;

      this.log.info('parse', 'Listings extracted from email', {
        messageId: email.gmailMessageId,
        count: drafts.length,
        skippedNonRent,
        saleAlert: skippedNonRent > 0 && drafts.length === 0,
      });

      for (const draft of drafts) {
        const result = await this.listings.upsertFromDraft(draft);
        if (result.isNew) {
          listingsNew++;
          this.log.debug('listing', 'New listing', {
            url: draft.canonicalUrl,
            rentEur: draft.rentEur,
            rooms: draft.rooms,
            areaSqm: draft.areaSqm,
          });
        } else {
          duplicatesSkipped++;
          this.log.debug('listing', 'Existing listing updated', {
            url: draft.canonicalUrl,
            priceChanged: result.priceChanged,
            materialChanged: result.materialChanged,
          });
        }
      }

      await this.listings.markEmailProcessed(email.gmailMessageId, {
        subject: email.subject,
        fromAddress: email.fromAddress,
        receivedAt: email.receivedAt,
        listingsFound: drafts.length,
      });
      emailsProcessed++;
    }

    this.log.step('parse', 'Fetch & parse finished', {
      emailsProcessed,
      emailsSkippedAlreadyProcessed,
      listingsParsed,
      listingsNew,
      duplicatesSkipped,
      listingsSkippedNonRent,
    });

    return {
      emailsProcessed,
      listingsParsed,
      listingsNew,
      duplicatesSkipped,
      emailsSkippedAlreadyProcessed,
    };
  }
}
