import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import { LISTING_REPOSITORY } from '../../listing/domain/listing.repository.port';
import type { ListingRepositoryPort } from '../../listing/domain/listing.repository.port';
import { FACEBOOK_GROUPS_PORT } from '../domain/facebook-groups.port';
import type { FacebookGroupsPort } from '../domain/facebook-groups.port';
import { FacebookRentalPostParser } from '../infrastructure/facebook-rental-post.parser';
import {
  isStudentHousingPost,
  shouldPersistFacebookListing,
} from '../infrastructure/facebook-rental-post.utils';

export interface FetchFacebookResult {
  postsProcessed: number;
  listingsParsed: number;
  listingsNew: number;
  duplicatesSkipped: number;
  skippedStudent: number;
  skippedNonRent: number;
  postsSkippedAlreadyProcessed: number;
}

@Injectable()
export class FetchAndParseFacebookPostsUseCase {
  private readonly log;

  constructor(
    @Inject(FACEBOOK_GROUPS_PORT)
    private readonly facebook: FacebookGroupsPort,
    @Inject(LISTING_REPOSITORY)
    private readonly listings: ListingRepositoryPort,
    private readonly parser: FacebookRentalPostParser,
    private readonly config: ConfigService,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(FetchAndParseFacebookPostsUseCase.name);
  }

  async execute(since: Date): Promise<FetchFacebookResult> {
    if (!this.facebook.isConfigured()) {
      this.log.info('facebook', 'Ingestion disabled or not configured — skip');
      return this.emptyResult();
    }

    const groupIds = this.parseGroupIds();
    if (groupIds.length === 0) {
      this.log.warn('facebook', 'FACEBOOK_GROUP_IDS empty — skip');
      return this.emptyResult();
    }

    const posts = await this.log.timed(
      'facebook',
      'Fetch group posts',
      () => this.facebook.fetchRecentPosts(groupIds, since),
      { groups: groupIds.length, since: since.toISOString() },
    );

    let postsProcessed = 0;
    let listingsParsed = 0;
    let listingsNew = 0;
    let duplicatesSkipped = 0;
    let skippedStudent = 0;
    let skippedNonRent = 0;
    let postsSkippedAlreadyProcessed = 0;

    for (const post of posts) {
      if (await this.listings.existsProcessedFacebookPost(post.postId)) {
        postsSkippedAlreadyProcessed++;
        continue;
      }

      if (isStudentHousingPost(post.message)) {
        skippedStudent++;
        this.log.debug('facebook', 'Skip — student housing', {
          postId: post.postId,
        });
        await this.listings.markFacebookPostProcessed(post.postId, {
          groupId: post.groupId,
          permalink: post.permalink,
          message: post.message.slice(0, 500),
          postedAt: post.postedAt,
          listingsFound: 0,
        });
        continue;
      }

      const allDrafts = this.parser.parse(post);
      const drafts = allDrafts.filter((d) =>
        shouldPersistFacebookListing(d, post.message),
      );
      const skippedFromPost = allDrafts.length - drafts.length;
      if (skippedFromPost > 0) {
        skippedNonRent += skippedFromPost;
      }

      listingsParsed += drafts.length;

      for (const draft of drafts) {
        const result = await this.listings.upsertFromDraft(draft);
        if (result.isNew) {
          listingsNew++;
        } else {
          duplicatesSkipped++;
        }
      }

      await this.listings.markFacebookPostProcessed(post.postId, {
        groupId: post.groupId,
        permalink: post.permalink,
        message: post.message.slice(0, 500),
        postedAt: post.postedAt,
        listingsFound: drafts.length,
      });
      postsProcessed++;
    }

    this.log.step('facebook', 'Facebook ingestion done', {
      postsFetched: posts.length,
      postsProcessed,
      listingsParsed,
      listingsNew,
      skippedStudent,
      skippedNonRent,
    });

    return {
      postsProcessed,
      listingsParsed,
      listingsNew,
      duplicatesSkipped,
      skippedStudent,
      skippedNonRent,
      postsSkippedAlreadyProcessed,
    };
  }

  private parseGroupIds(): string[] {
    const raw = this.config.get<string>('FACEBOOK_GROUP_IDS') ?? '';
    return raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s));
  }

  private emptyResult(): FetchFacebookResult {
    return {
      postsProcessed: 0,
      listingsParsed: 0,
      listingsNew: 0,
      duplicatesSkipped: 0,
      skippedStudent: 0,
      skippedNonRent: 0,
      postsSkippedAlreadyProcessed: 0,
    };
  }
}
