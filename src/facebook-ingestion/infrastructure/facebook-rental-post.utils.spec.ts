import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  cleanFacebookMessage,
  isEligibleFacebookDigestListing,
  isFacebookFeedNoise,
  isStudentHousingPost,
  looksLikeRentalPost,
  shouldPersistFacebookListing,
} from './facebook-rental-post.utils';

const rental = readFileSync(
  resolve(__dirname, '../../../test/fixtures/facebook-post-rental.txt'),
  'utf8',
);
const student = readFileSync(
  resolve(__dirname, '../../../test/fixtures/facebook-post-student.txt'),
  'utf8',
);

describe('facebook-rental-post.utils', () => {
  it('detects student housing', () => {
    expect(isStudentHousingPost(student)).toBe(true);
    expect(isStudentHousingPost(rental)).toBe(false);
  });

  it('detects rental posts', () => {
    expect(looksLikeRentalPost(rental)).toBe(true);
    expect(looksLikeRentalPost('random hello')).toBe(false);
  });

  it('rejects student posts for persistence', () => {
    expect(
      shouldPersistFacebookListing(
        {
          canonicalUrl: 'https://www.facebook.com/groups/1/posts/2/',
          rentEur: 350,
        },
        student,
      ),
    ).toBe(false);
  });

  it('accepts family rental posts', () => {
    expect(
      shouldPersistFacebookListing(
        {
          canonicalUrl: 'https://www.idealista.it/immobile/1/',
          rentEur: 750,
          areaSqm: 75,
          rooms: 3,
        },
        rental,
      ),
    ).toBe(true);
  });

  it('rejects FB comment thread UI noise', () => {
    const commentThread =
      'Elle Pillosu Ciao Leonardo. Mia mamma ha un bilocale nuovamente ristrutturato in piazza Adriano. Sarebbe di tuo interesse? 6d Like Reply See translation Share 1 View all 4 repli';
    expect(isFacebookFeedNoise(commentThread)).toBe(true);
    expect(
      shouldPersistFacebookListing(
        {
          canonicalUrl:
            'https://www.facebook.com/groups/946456072043414/posts/28024420223820299/',
          title: commentThread.slice(0, 120),
        },
        commentThread,
      ),
    ).toBe(false);
  });

  it('rejects short interest replies without rent', () => {
    const reply =
      'Gianella RG Buongiorno, le ho scritto in privato Sono interessata 21m Like Reply See translation Share Jessica Pretel Mi interessa 4m Like Reply';
    expect(
      shouldPersistFacebookListing(
        {
          canonicalUrl:
            'https://www.facebook.com/groups/182051112459622/posts/1884760432188673/',
          title: reply.slice(0, 120),
        },
        reply,
      ),
    ).toBe(false);
    expect(
      isEligibleFacebookDigestListing({
        title: reply.slice(0, 120),
        rentEur: null,
      }),
    ).toBe(false);
  });

  it('cleans UI tail from scraped message', () => {
    const raw =
      'Trilocale 80mq 750€ Cenisia affitto Like Reply See translation Share';
    expect(cleanFacebookMessage(raw)).toBe(
      'Trilocale 80mq 750€ Cenisia affitto',
    );
  });

  it('accepts permalink FB post with rent and facts', () => {
    const post =
      'Affitto bilocale 65mq in Cenisia, 650€/mese, 2 locali, disponibile subito';
    expect(
      shouldPersistFacebookListing(
        {
          canonicalUrl: 'https://www.facebook.com/groups/123/posts/456/',
          rentEur: 650,
          areaSqm: 65,
          rooms: 2,
          title: post,
        },
        post,
      ),
    ).toBe(true);
    expect(
      isEligibleFacebookDigestListing({
        title: post,
        rentEur: 650,
        areaSqm: 65,
        rooms: 2,
      }),
    ).toBe(true);
  });
});
