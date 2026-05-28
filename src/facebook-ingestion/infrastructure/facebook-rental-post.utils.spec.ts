import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
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
});
