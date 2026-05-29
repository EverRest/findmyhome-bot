import { assignPossibleDuplicateLinks } from './reconcile-possible-duplicates';

describe('assignPossibleDuplicateLinks', () => {
  const t = (id: string, firstSeenAt: string) => ({
    id,
    firstSeenAt: new Date(firstSeenAt),
    possibleDuplicateOfId: null,
  });

  it('marks newer listings as possible duplicates of oldest', () => {
    const map = assignPossibleDuplicateLinks([
      t('b', '2026-05-02'),
      t('a', '2026-05-01'),
      t('c', '2026-05-03'),
    ]);
    expect(map.get('a')).toBeNull();
    expect(map.get('b')).toBe('a');
    expect(map.get('c')).toBe('a');
  });

  it('clears mark for single listing', () => {
    const map = assignPossibleDuplicateLinks([t('only', '2026-05-01')]);
    expect(map.get('only')).toBeNull();
  });
});
