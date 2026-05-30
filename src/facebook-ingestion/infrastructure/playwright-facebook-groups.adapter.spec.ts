import { existsSync } from 'fs';
import { PlaywrightFacebookGroupsAdapter } from './playwright-facebook-groups.adapter';
import { getChromium } from './playwright-client';
import { mockConfig, mockStepLogger } from '../../../test/helpers/test-utils';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

jest.mock('./playwright-client', () => ({
  getChromium: jest.fn(),
}));

const existsSyncMock = existsSync as jest.MockedFunction<typeof existsSync>;
const getChromiumMock = getChromium as jest.MockedFunction<typeof getChromium>;

describe('PlaywrightFacebookGroupsAdapter', () => {
  const log = mockStepLogger();

  beforeEach(() => {
    jest.clearAllMocks();
    existsSyncMock.mockReturnValue(true);
  });

  function createAdapter(
    config: Record<string, string | undefined> = {},
  ): PlaywrightFacebookGroupsAdapter {
    return new PlaywrightFacebookGroupsAdapter(
      mockConfig({
        FACEBOOK_INGESTION_ENABLED: 'true',
        FACEBOOK_GROUP_IDS: '123456',
        FACEBOOK_STORAGE_STATE_PATH: './secrets/facebook-storage.json',
        FACEBOOK_GROUP_DELAY_MS: '0',
        FACEBOOK_MAX_SCROLLS: '1',
        ...config,
      }),
      log as never,
    );
  }

  it('is not configured when ingestion is disabled', () => {
    const adapter = createAdapter({ FACEBOOK_INGESTION_ENABLED: 'false' });
    expect(adapter.isConfigured()).toBe(false);
  });

  it('is not configured when group ids are empty', () => {
    const adapter = createAdapter({ FACEBOOK_GROUP_IDS: '' });
    expect(adapter.isConfigured()).toBe(false);
  });

  it('is not configured when storage state file is missing', () => {
    existsSyncMock.mockReturnValue(false);
    const adapter = createAdapter();
    expect(adapter.isConfigured()).toBe(false);
  });

  it('is configured when enabled, groups, and storage exist', () => {
    const adapter = createAdapter();
    expect(adapter.isConfigured()).toBe(true);
  });

  it('returns no posts when not configured', async () => {
    existsSyncMock.mockReturnValue(false);
    const adapter = createAdapter();
    await expect(
      adapter.fetchRecentPosts(['123456'], new Date()),
    ).resolves.toEqual([]);
    expect(log._ctx.warn).toHaveBeenCalledWith(
      'facebook',
      'Not configured — skip fetch',
    );
  });

  it('fetches and parses group feeds with Playwright', async () => {
    const page = {
      goto: jest.fn().mockResolvedValue(undefined),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue(undefined),
      content: jest.fn().mockResolvedValue(`
        <div role="article">
          <a href="/groups/123456/posts/999001/">link</a>
          <div>Affitto bilocale Cenisia 650 euro</div>
        </div>
      `),
    };
    const context = {
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const browser = {
      newContext: jest.fn().mockResolvedValue(context),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const launch = jest.fn().mockResolvedValue(browser);
    getChromiumMock.mockResolvedValue({ launch } as never);

    const adapter = createAdapter();
    const since = new Date('2020-01-01T00:00:00.000Z');
    const posts = await adapter.fetchRecentPosts(['123456'], since);

    expect(launch).toHaveBeenCalledWith({ headless: true });
    expect(page.goto).toHaveBeenCalledWith(
      'https://www.facebook.com/groups/123456',
      expect.objectContaining({ waitUntil: 'domcontentloaded' }),
    );
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      postId: '999001',
      groupId: '123456',
      message: expect.stringMatching(/Affitto bilocale/i),
    });
    expect(log._ctx.info).toHaveBeenCalledWith(
      'facebook',
      'Group feed parsed',
      expect.objectContaining({ groupId: '123456', posts: 1 }),
    );
    expect(browser.close).toHaveBeenCalled();
  });

  it('deduplicates posts across groups and logs fetch failures', async () => {
    const goodHtml = `
      <div role="article">
        <a href="/groups/111/posts/555/">link</a>
        <div>Affitto trilocale 700 euro</div>
      </div>
    `;
    const page = {
      goto: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('blocked')),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue(undefined),
      content: jest.fn().mockResolvedValue(goodHtml),
    };
    const context = {
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const browser = {
      newContext: jest.fn().mockResolvedValue(context),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const launch = jest.fn().mockResolvedValue(browser);
    getChromiumMock.mockResolvedValue({ launch } as never);

    const adapter = createAdapter({ FACEBOOK_HEADLESS: 'false' });
    const posts = await adapter.fetchRecentPosts(['111', '222'], new Date());

    expect(posts).toHaveLength(1);
    expect(log._ctx.error).toHaveBeenCalledWith(
      'facebook',
      'Group fetch failed',
      expect.any(Error),
      { groupId: '222' },
    );
    expect(launch).toHaveBeenCalledWith({ headless: false });
  });
});
