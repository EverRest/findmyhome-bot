import { extractPostsFromFeedHtml } from './extract-facebook-feed';

describe('extractPostsFromFeedHtml', () => {
  it('extracts post id and permalink from feed HTML', () => {
    const html = `
      <div role="article">
        <a href="/groups/999/posts/111222/?comment_id=1">link</a>
        <div>Affitto bilocale Cenisia 800 euro</div>
      </div>
    `;
    const posts = extractPostsFromFeedHtml(html, '999');
    expect(posts).toHaveLength(1);
    expect(posts[0].postId).toBe('111222');
    expect(posts[0].permalink).toContain('/groups/999/posts/111222');
    expect(posts[0].message).toMatch(/Affitto/i);
  });
});
