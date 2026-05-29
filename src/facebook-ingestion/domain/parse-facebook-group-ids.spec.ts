import { parseFacebookGroupIds } from './parse-facebook-group-ids';

describe('parseFacebookGroupIds', () => {
  it('accepts numeric and slug group ids', () => {
    const ids = parseFacebookGroupIds(
      '946456072043414, torino.affitti.case.privati, 182051112459622 affittoprivatotorino',
    );
    expect(ids).toEqual([
      '946456072043414',
      'torino.affitti.case.privati',
      '182051112459622',
      'affittoprivatotorino',
    ]);
  });

  it('deduplicates and skips invalid tokens', () => {
    expect(
      parseFacebookGroupIds('123, 123, , a, !!!, 946456072043414'),
    ).toEqual(['123', '946456072043414']);
  });
});
