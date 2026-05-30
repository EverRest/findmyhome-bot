import {
  extractPostsFromFeedHtml,
  toIncomingPost,
} from './extract-facebook-feed';

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

  it('falls back to post links when article blocks are missing', () => {
    const html = `
      <div role="article"><div>No post link here</div></div>
      <a href="https://www.facebook.com/groups/999/posts/333444/?ref=feed&amp;foo=1">x</a>
    `;
    const posts = extractPostsFromFeedHtml(html, '999');
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      postId: '333444',
      permalink: 'https://www.facebook.com/groups/999/posts/333444/',
    });
  });

  it('normalizes absolute and relative permalinks', () => {
    const absolute = extractPostsFromFeedHtml(
      `<div role="article"><a href="https://www.facebook.com/groups/999/posts/555666/?comment_id=1">x</a><div>text</div></div>`,
      '999',
    );
    expect(absolute[0].permalink).toBe(
      'https://www.facebook.com/groups/999/posts/555666/',
    );

    const relative = extractPostsFromFeedHtml(
      `<div role="article"><a href="/groups/999/posts/777888/?foo=1">x</a><div>text</div></div>`,
      '999',
    );
    expect(relative[0].permalink).toBe(
      'https://www.facebook.com/groups/999/posts/777888/',
    );
  });

  it('skips article chunks without a post id', () => {
    const posts = extractPostsFromFeedHtml(
      `<div role="article"><div>No post link here</div></div>`,
      '999',
    );
    expect(posts).toEqual([]);
  });

  it('deduplicates fallback post links', () => {
    const html = `
      <a href="https://www.facebook.com/groups/999/posts/333444/">first</a>
      <a href="https://www.facebook.com/groups/999/posts/333444/?ref=feed">dup</a>
    `;
    const posts = extractPostsFromFeedHtml(html, '999');
    expect(posts).toHaveLength(1);
    expect(posts[0].postId).toBe('333444');
  });

  it('builds default permalink when href is missing from article chunk', () => {
    const posts = extractPostsFromFeedHtml(
      `<div role="article">/groups/999/posts/888999/ Affitto bilocale</div>`,
      '999',
    );
    expect(posts[0].permalink).toBe(
      'https://www.facebook.com/groups/999/posts/888999/',
    );
  });

  it('truncates comment UI from extracted message', () => {
    const html = `
      <div role="article">
        <a href="/groups/999/posts/111222/">link</a>
        <div>Affitto bilocale 800 euro zona Cenisia Like Reply See translation Share</div>
      </div>
    `;
    const posts = extractPostsFromFeedHtml(html, '999');
    expect(posts[0].message).toMatch(/Affitto bilocale 800 euro zona Cenisia/);
    expect(posts[0].message).not.toMatch(/Like Reply/i);
  });

  it('decodes html entities in href and text', () => {
    const html = `
      <div role="article">
        <a href="/groups/999/posts/444555/?q=1&amp;foo=bar">link</a>
        <div>It&#39;s available &amp; ready</div>
      </div>
    `;
    const posts = extractPostsFromFeedHtml(html, '999');
    expect(posts[0].permalink).toBe(
      'https://www.facebook.com/groups/999/posts/444555/',
    );
    expect(posts[0].message).toContain("It's available & ready");
  });
});

describe('toIncomingPost', () => {
  it('maps raw feed posts to incoming facebook posts', () => {
    const postedAt = new Date('2026-05-29T08:00:00.000Z');
    expect(
      toIncomingPost(
        {
          postId: '123',
          permalink: 'https://www.facebook.com/groups/999/posts/123/',
          message: 'Affitto bilocale',
        },
        '999',
        postedAt,
      ),
    ).toEqual({
      postId: '123',
      groupId: '999',
      permalink: 'https://www.facebook.com/groups/999/posts/123/',
      message: 'Affitto bilocale',
      postedAt,
    });
  });
});
