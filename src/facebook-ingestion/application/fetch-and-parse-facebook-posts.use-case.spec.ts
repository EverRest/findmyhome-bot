import { readFileSync } from 'fs';
import { resolve } from 'path';
import { FetchAndParseFacebookPostsUseCase } from './fetch-and-parse-facebook-posts.use-case';
import { FacebookRentalPostParser } from '../infrastructure/facebook-rental-post.parser';
import {
  mockConfig,
  mockCriteriaLoader,
  mockStepLogger,
} from '../../../test/helpers/test-utils';

const studentText = readFileSync(
  resolve(__dirname, '../../../test/fixtures/facebook-post-student.txt'),
  'utf8',
);
const rentalMessage =
  'Affitto bilocale in Cenisia, Torino. 70 mq 750 euro/mese https://www.idealista.it/immobile/123456/';

describe('FetchAndParseFacebookPostsUseCase', () => {
  const listings = {
    existsProcessedFacebookPost: jest.fn(),
    markFacebookPostProcessed: jest.fn(),
    upsertFromDraft: jest.fn(),
  };
  const facebook = {
    isConfigured: jest.fn().mockReturnValue(true),
    fetchRecentPosts: jest.fn(),
  };
  const log = mockStepLogger();

  const useCase = new FetchAndParseFacebookPostsUseCase(
    facebook,
    listings as never,
    new FacebookRentalPostParser(),
    mockConfig({
      FACEBOOK_INGESTION_ENABLED: 'true',
      FACEBOOK_GROUP_IDS: '123',
    }),
    mockCriteriaLoader() as never,
    log as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    facebook.isConfigured.mockReturnValue(true);
    log._ctx.timed.mockImplementation((_s, _l, fn: () => Promise<unknown>) =>
      fn(),
    );
  });

  it('returns empty result when facebook is not configured', async () => {
    facebook.isConfigured.mockReturnValue(false);
    const result = await useCase.execute(new Date(0));
    expect(result).toEqual({
      postsProcessed: 0,
      listingsParsed: 0,
      listingsNew: 0,
      duplicatesSkipped: 0,
      skippedStudent: 0,
      skippedNonRent: 0,
      postsSkippedAlreadyProcessed: 0,
    });
    expect(facebook.fetchRecentPosts).not.toHaveBeenCalled();
  });

  it('returns empty result when group ids are empty', async () => {
    const emptyGroupsUseCase = new FetchAndParseFacebookPostsUseCase(
      facebook,
      listings as never,
      new FacebookRentalPostParser(),
      mockConfig({
        FACEBOOK_INGESTION_ENABLED: 'true',
        FACEBOOK_GROUP_IDS: '',
      }),
      mockCriteriaLoader() as never,
      log as never,
    );

    const result = await emptyGroupsUseCase.execute(new Date(0));
    expect(result.postsProcessed).toBe(0);
    expect(facebook.fetchRecentPosts).not.toHaveBeenCalled();
  });

  it('skips already processed posts', async () => {
    listings.existsProcessedFacebookPost.mockResolvedValue(true);
    facebook.fetchRecentPosts.mockResolvedValue([
      {
        postId: 'p-done',
        groupId: '123',
        permalink: 'https://www.facebook.com/groups/123/posts/p-done/',
        message: rentalMessage,
        postedAt: new Date(),
      },
    ]);

    const result = await useCase.execute(new Date(0));
    expect(result.postsSkippedAlreadyProcessed).toBe(1);
    expect(listings.markFacebookPostProcessed).not.toHaveBeenCalled();
  });

  it('skips student posts and marks processed', async () => {
    listings.existsProcessedFacebookPost.mockResolvedValue(false);
    facebook.fetchRecentPosts.mockResolvedValue([
      {
        postId: 'p-student',
        groupId: '123',
        permalink: 'https://www.facebook.com/groups/123/posts/p-student/',
        message: studentText,
        postedAt: new Date(),
      },
    ]);

    const result = await useCase.execute(new Date(0));
    expect(result.skippedStudent).toBe(1);
    expect(result.listingsParsed).toBe(0);
    expect(listings.upsertFromDraft).not.toHaveBeenCalled();
    expect(listings.markFacebookPostProcessed).toHaveBeenCalled();
  });

  it('parses rental posts and upserts new listings', async () => {
    listings.existsProcessedFacebookPost.mockResolvedValue(false);
    listings.upsertFromDraft.mockResolvedValue({
      isNew: true,
      priceChanged: false,
      materialChanged: false,
    });
    facebook.fetchRecentPosts.mockResolvedValue([
      {
        postId: 'p-rental',
        groupId: '123',
        permalink: 'https://www.facebook.com/groups/123/posts/p-rental/',
        message: rentalMessage,
        postedAt: new Date(),
      },
    ]);

    const result = await useCase.execute(new Date(0));
    expect(result.postsProcessed).toBe(1);
    expect(result.listingsParsed).toBe(1);
    expect(result.listingsNew).toBe(1);
    expect(listings.upsertFromDraft).toHaveBeenCalled();
  });

  it('counts duplicate upserts separately from new listings', async () => {
    listings.existsProcessedFacebookPost.mockResolvedValue(false);
    listings.upsertFromDraft.mockResolvedValue({
      isNew: false,
      priceChanged: false,
      materialChanged: false,
    });
    facebook.fetchRecentPosts.mockResolvedValue([
      {
        postId: 'p-dup',
        groupId: '123',
        permalink: 'https://www.facebook.com/groups/123/posts/p-dup/',
        message: rentalMessage,
        postedAt: new Date(),
      },
    ]);

    const result = await useCase.execute(new Date(0));
    expect(result.listingsNew).toBe(0);
    expect(result.duplicatesSkipped).toBe(1);
  });

  it('skips drafts failing hard criteria', async () => {
    listings.existsProcessedFacebookPost.mockResolvedValue(false);
    facebook.fetchRecentPosts.mockResolvedValue([
      {
        postId: 'p-small',
        groupId: '123',
        permalink: 'https://www.facebook.com/groups/123/posts/p-small/',
        message:
          'Affitto monolocale 27 mq Crocetta Torino 500 euro https://www.idealista.it/immobile/999/',
        postedAt: new Date(),
      },
    ]);

    const result = await useCase.execute(new Date(0));
    expect(result.listingsParsed).toBe(0);
    expect(result.skippedNonRent).toBe(1);
    expect(listings.upsertFromDraft).not.toHaveBeenCalled();
  });
});
