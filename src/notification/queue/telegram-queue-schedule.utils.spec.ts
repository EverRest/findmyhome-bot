import { staggerDelaysForJobs } from './telegram-queue-schedule.utils';

describe('staggerDelaysForJobs', () => {
  it('returns empty for zero jobs', () => {
    expect(staggerDelaysForJobs(0, 2500)).toEqual([]);
  });

  it('staggers by delayMs steps', () => {
    expect(staggerDelaysForJobs(4, 2500)).toEqual([0, 2500, 5000, 7500]);
  });
});
