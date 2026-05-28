import {
  getHardCriteriaFailures,
  meetsHardCriteria,
} from './listing-hard-criteria';
import { loadTestCriteria } from '../../../test/helpers/test-utils';

describe('meetsHardCriteria', () => {
  const criteria = loadTestCriteria();

  it('rejects monolocale: 1 room, 27 m²', () => {
    const failures = getHardCriteriaFailures(
      {
        title: 'Monolocale Crocetta Torino',
        locationHint: 'Crocetta, Torino',
        rooms: 1,
        areaSqm: 27,
        rentEur: 500,
        rawSnippet: 'affitto monolocale',
      },
      criteria,
    );
    expect(
      meetsHardCriteria(
        {
          title: 'Monolocale',
          rooms: 1,
          areaSqm: 27,
          rentEur: 500,
          locationHint: 'Crocetta',
        },
        criteria,
      ),
    ).toBe(false);
    expect(failures.some((f) => f.includes('rooms'))).toBe(true);
    expect(failures.some((f) => f.includes('m²'))).toBe(true);
  });

  it('rejects rent above max', () => {
    expect(
      meetsHardCriteria(
        {
          title: 'Bilocale Cenisia',
          locationHint: 'Cenisia, Torino',
          rooms: 2,
          areaSqm: 70,
          rentEur: 1100,
        },
        criteria,
      ),
    ).toBe(false);
  });

  it('accepts listing matching hard criteria', () => {
    expect(
      meetsHardCriteria(
        {
          title: 'Bilocale luminoso',
          locationHint: 'Cenisia, Torino',
          rooms: 2,
          areaSqm: 70,
          rentEur: 750,
          rawSnippet: 'affitto 750 €/mese',
        },
        criteria,
      ),
    ).toBe(true);
  });

  it('rejects soft.avoid patterns (studio)', () => {
    expect(
      meetsHardCriteria(
        {
          title: 'Studio in Cenisia',
          locationHint: 'Cenisia',
          rooms: 2,
          areaSqm: 70,
          rentEur: 600,
        },
        criteria,
      ),
    ).toBe(false);
  });

  it('accepts non-target zone when other hard criteria match', () => {
    expect(
      meetsHardCriteria(
        {
          title: 'Bilocale',
          locationHint: 'Lingotto, Torino',
          rooms: 2,
          areaSqm: 70,
          rentEur: 700,
        },
        criteria,
      ),
    ).toBe(true);
  });
});
