import { isBullmqEnabled } from './bullmq.config';
import { mockConfig } from '../../../test/helpers/test-utils';

describe('isBullmqEnabled', () => {
  it('is false by default', () => {
    expect(isBullmqEnabled(mockConfig())).toBe(false);
  });

  it('is true when BULLMQ_ENABLED=true', () => {
    expect(isBullmqEnabled(mockConfig({ BULLMQ_ENABLED: 'true' }))).toBe(true);
  });
});
