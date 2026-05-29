import { NoopFacebookGroupsAdapter } from './noop-facebook-groups.adapter';

describe('NoopFacebookGroupsAdapter', () => {
  const adapter = new NoopFacebookGroupsAdapter();

  it('is not configured', () => {
    expect(adapter.isConfigured()).toBe(false);
  });

  it('returns no posts', async () => {
    await expect(
      adapter.fetchRecentPosts(['123'], new Date()),
    ).resolves.toEqual([]);
  });
});
