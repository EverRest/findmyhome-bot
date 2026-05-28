import { FacebookRentalPostParser } from './facebook-rental-post.parser';
import type { IncomingFacebookPost } from '../domain/incoming-facebook-post';

function mkPost(overrides: Partial<IncomingFacebookPost> = {}): IncomingFacebookPost {
  return {
    postId: 'p-1',
    groupId: 'g-1',
    permalink: 'https://facebook.com/groups/g-1/posts/p-1',
    message: '',
    postedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('FacebookRentalPostParser', () => {
  it('returns empty when both message and permalink are missing', () => {
    const parser = new FacebookRentalPostParser();
    const drafts = parser.parse(mkPost({ message: '   ', permalink: '' }));
    expect(drafts).toEqual([]);
  });

  it('keeps only portal/listing urls and deduplicates canonical urls', () => {
    const parser = new FacebookRentalPostParser();
    const post = mkPost({
      message: [
        'Affitto bilocale in Torino, zona Cit Turin.',
        'https://www.idealista.it/immobile/123/?utm_source=fb',
        'https://www.idealista.it/immobile/123/?utm_campaign=dup',
        'https://example.com/not-a-listing',
      ].join(' '),
    });

    const drafts = parser.parse(post);

    expect(drafts).toHaveLength(1);
    expect(drafts[0].canonicalUrl).toBe('https://www.idealista.it/immobile/123/');
    expect(drafts[0].listingUrl).toBe(
      'https://www.idealista.it/immobile/123/?utm_source=fb',
    );
    expect(drafts[0].source).toBe('facebook.group');
    expect(drafts[0].externalId).toBe(post.postId);
    expect(drafts[0].locationHint).toMatch(/Torino|Cit Turin/i);
  });

  it('falls back to permalink draft when text is long enough and no valid url exists', () => {
    const parser = new FacebookRentalPostParser();
    const post = mkPost({
      message:
        'Affitto trilocale vicino a Torino Porta Susa, no intermediari, contattare in privato.',
    });

    const drafts = parser.parse(post);

    expect(drafts).toHaveLength(1);
    expect(drafts[0].canonicalUrl).toBe(post.permalink);
    expect(drafts[0].listingUrl).toBe(post.permalink);
    expect(drafts[0].title).toMatch(/Affitto trilocale/i);
  });

  it('does not create fallback draft for short text without valid urls', () => {
    const parser = new FacebookRentalPostParser();
    const drafts = parser.parse(
      mkPost({
        message: 'Bilocale Torino',
      }),
    );
    expect(drafts).toEqual([]);
  });

  it('uses permalink as listingUrl when permalink is non-http', () => {
    const parser = new FacebookRentalPostParser();
    const post = mkPost({
      permalink: '/groups/g-1/posts/p-1',
      message:
        'Appartamento ristrutturato in zona San Donato, 2 locali arredati e disponibile da subito.',
    });

    const drafts = parser.parse(post);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].listingUrl).toBe('/groups/g-1/posts/p-1');
  });
});
