import { existsSync } from 'fs';
import { PlaywrightFacebookGroupsAdapter } from './playwright-facebook-groups.adapter';
import { mockConfig, mockStepLogger } from '../../../test/helpers/test-utils';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

const existsSyncMock = existsSync as jest.MockedFunction<typeof existsSync>;

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
});
