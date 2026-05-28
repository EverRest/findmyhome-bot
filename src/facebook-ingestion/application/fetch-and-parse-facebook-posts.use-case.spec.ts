import { readFileSync } from 'fs';
import { resolve } from 'path';
import { FetchAndParseFacebookPostsUseCase } from './fetch-and-parse-facebook-posts.use-case';
import { FacebookRentalPostParser } from '../infrastructure/facebook-rental-post.parser';
import { mockConfig, mockStepLogger } from '../../../test/helpers/test-utils';

const studentText = readFileSync(
  resolve(__dirname, '../../../test/fixtures/facebook-post-student.txt'),
  'utf8',
);

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

  const useCase = new FetchAndParseFacebookPostsUseCase(
    facebook,
    listings as never,
    new FacebookRentalPostParser(),
    mockConfig({
      FACEBOOK_INGESTION_ENABLED: 'true',
      FACEBOOK_GROUP_IDS: '123',
    }),
    mockStepLogger() as never,
  );

  beforeEach(() => jest.clearAllMocks());

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
});
