import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { CriteriaLoaderService } from '../../shared/infrastructure/criteria-loader.service';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import { FetchAndParseEmailsUseCase } from '../../email-ingestion/application/fetch-and-parse-emails.use-case';
import { FetchAndParseFacebookPostsUseCase } from '../../facebook-ingestion/application/fetch-and-parse-facebook-posts.use-case';
import { ScoreListingsUseCase } from '../../scoring/application/score-listings.use-case';
import { SendDigestUseCase } from '../../notification/application/send-digest.use-case';
import { formatListingCard } from '../../notification/application/format-listing-card';
import { LISTING_REPOSITORY } from '../../listing/domain/listing.repository.port';
import type { ListingRepositoryPort } from '../../listing/domain/listing.repository.port';

export interface PipelineRunSummary {
  runId: string;
  fetch: {
    emailsProcessed: number;
    listingsParsed: number;
    listingsNew: number;
    duplicatesSkipped: number;
  };
  facebook: {
    postsProcessed: number;
    listingsParsed: number;
    listingsNew: number;
    duplicatesSkipped: number;
    skippedStudent: number;
  };
  listingsScored: number;
  telegramSent: number;
  preview: string[];
}

@Injectable()
export class RunDailyPipelineUseCase {
  private readonly log;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly criteria: CriteriaLoaderService,
    private readonly fetchEmails: FetchAndParseEmailsUseCase,
    private readonly fetchFacebook: FetchAndParseFacebookPostsUseCase,
    private readonly scoreListings: ScoreListingsUseCase,
    private readonly sendDigest: SendDigestUseCase,
    @Inject(LISTING_REPOSITORY)
    private readonly listings: ListingRepositoryPort,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(RunDailyPipelineUseCase.name);
  }

  async execute(): Promise<PipelineRunSummary> {
    const dryRun = this.config.get('PIPELINE_DRY_RUN') === 'true';

    const run = await this.prisma.pipelineRun.create({
      data: { status: 'running' },
    });

    this.log.step('pipeline', 'Run started', { runId: run.id, dryRun });

    try {
      const since = new Date(Date.now() - 26 * 60 * 60 * 1000);

      const lookbackHours = Number(
        this.config.get('FACEBOOK_LOOKBACK_HOURS') ?? 24,
      );
      const fbSince = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

      const fetchResult = await this.log.timed(
        'pipeline',
        '1/4 Fetch & parse emails',
        () => this.fetchEmails.execute(since),
        { since: since.toISOString() },
      );

      const facebookResult = await this.log.timed(
        'pipeline',
        '2/4 Fetch & parse Facebook groups',
        () => this.fetchFacebook.execute(fbSince),
        { since: fbSince.toISOString() },
      );

      const possibleDuplicatesLinked =
        await this.listings.reconcilePossibleDuplicates();
      if (possibleDuplicatesLinked > 0) {
        this.log.info('pipeline', 'Possible duplicates linked', {
          updated: possibleDuplicatesLinked,
        });
      }

      const scored = await this.log.timed(
        'pipeline',
        '3/4 Score listings',
        () => this.scoreListings.execute(),
      );

      const listingsNewTotal =
        fetchResult.listingsNew + facebookResult.listingsNew;
      const duplicatesTotal =
        fetchResult.duplicatesSkipped + facebookResult.duplicatesSkipped;

      const telegramSent = await this.log.timed(
        'pipeline',
        '4/4 Send Telegram digest',
        () =>
          this.sendDigest.execute({
            listingsNew: listingsNewTotal,
            duplicatesSkipped: duplicatesTotal,
          }),
        { dryRun },
      );

      const topN = Number(this.config.get('TOP_N') ?? 10);
      const top = await this.listings.findTopForDigest(topN);
      const refName = this.criteria.get().scoring.referencePoint?.name;
      const cardOpts = refName ? { referencePointName: refName } : undefined;
      const preview = top.map((t) => formatListingCard(t, cardOpts));

      await this.prisma.pipelineRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          finishedAt: new Date(),
          emailsProcessed: fetchResult.emailsProcessed,
          listingsParsed: fetchResult.listingsParsed,
          listingsNew: fetchResult.listingsNew,
          duplicatesSkipped: fetchResult.duplicatesSkipped,
          listingsScored: scored,
          telegramSent,
        },
      });

      this.log.step('pipeline', 'Run completed', {
        runId: run.id,
        ...fetchResult,
        facebook: facebookResult,
        listingsScored: scored,
        telegramSent,
        previewCount: preview.length,
      });

      return {
        runId: run.id,
        fetch: fetchResult,
        facebook: {
          postsProcessed: facebookResult.postsProcessed,
          listingsParsed: facebookResult.listingsParsed,
          listingsNew: facebookResult.listingsNew,
          duplicatesSkipped: facebookResult.duplicatesSkipped,
          skippedStudent: facebookResult.skippedStudent,
        },
        listingsScored: scored,
        telegramSent,
        preview,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.pipelineRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: message,
        },
      });
      this.log.error('pipeline', 'Run failed', err, { runId: run.id });
      throw err;
    }
  }
}
