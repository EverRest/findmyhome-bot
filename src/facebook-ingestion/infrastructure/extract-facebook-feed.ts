import type { IncomingFacebookPost } from '../domain/incoming-facebook-post';

export interface RawFacebookFeedPost {
  postId: string;
  permalink: string;
  message: string;
}

/** Parse group feed HTML (Playwright page content) for post links and text. */
export function extractPostsFromFeedHtml(
  html: string,
  groupId: string,
): RawFacebookFeedPost[] {
  const posts: RawFacebookFeedPost[] = [];
  const seen = new Set<string>();

  const articleRegex =
    /<div[^>]*role="article"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*role="article"|$)/gi;
  const chunks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = articleRegex.exec(html)) !== null) {
    chunks.push(m[1]);
  }

  const sources = chunks.length > 0 ? chunks : [html];

  for (const chunk of sources) {
    const post = parsePostChunk(chunk, groupId);
    if (post && !seen.has(post.postId)) {
      seen.add(post.postId);
      posts.push(post);
    }
  }

  if (posts.length === 0) {
    const linkRegex = new RegExp(
      `href="([^"]*?/groups/${groupId}/posts/(\\d+)[^"]*)"`,
      'gi',
    );
    while ((m = linkRegex.exec(html)) !== null) {
      const postId = m[2];
      if (seen.has(postId)) continue;
      seen.add(postId);
      const href = decodeHtmlEntities(m[1]);
      posts.push({
        postId,
        permalink: normalizePermalink(href, groupId, postId),
        message: '',
      });
    }
  }

  return posts;
}

function parsePostChunk(
  chunk: string,
  groupId: string,
): RawFacebookFeedPost | null {
  const linkMatch = chunk.match(
    new RegExp(`/groups/${groupId}/posts/(\\d+)`, 'i'),
  );
  if (!linkMatch) return null;

  const postId = linkMatch[1];
  const hrefMatch = chunk.match(
    new RegExp(`href="([^"]*?/groups/${groupId}/posts/${postId}[^"]*)"`, 'i'),
  );
  const message = stripHtml(chunk).replace(/\s+/g, ' ').trim().slice(0, 4000);

  return {
    postId,
    permalink: normalizePermalink(
      hrefMatch ? decodeHtmlEntities(hrefMatch[1]) : '',
      groupId,
      postId,
    ),
    message,
  };
}

function normalizePermalink(
  href: string,
  groupId: string,
  postId: string,
): string {
  if (href.startsWith('http')) {
    try {
      const u = new URL(href);
      return `https://www.facebook.com${u.pathname}`;
    } catch {
      /* fall through */
    }
  }
  if (href.startsWith('/')) {
    return `https://www.facebook.com${href.split('?')[0]}`;
  }
  return `https://www.facebook.com/groups/${groupId}/posts/${postId}/`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function decodeHtmlEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}

export function toIncomingPost(
  raw: RawFacebookFeedPost,
  groupId: string,
  postedAt: Date,
): IncomingFacebookPost {
  return {
    postId: raw.postId,
    groupId,
    permalink: raw.permalink,
    message: raw.message,
    postedAt,
  };
}
