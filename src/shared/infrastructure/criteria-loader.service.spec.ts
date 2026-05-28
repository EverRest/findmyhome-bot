import { CriteriaLoaderService } from './criteria-loader.service';
import {
  CRITERIA_TEST_PATH,
  mockConfig,
  mockStepLogger,
} from '../../../test/helpers/test-utils';

describe('CriteriaLoaderService', () => {
  it('loads default criteria path when unset', () => {
    const service = new CriteriaLoaderService(
      mockConfig({ CRITERIA_PATH: undefined }),
      mockStepLogger() as never,
    );
    service.onModuleInit();
    expect(service.get().hard.rentMaxEur).toBeGreaterThan(0);
  });

  it('loads criteria on init', () => {
    const service = new CriteriaLoaderService(
      mockConfig({ CRITERIA_PATH: CRITERIA_TEST_PATH }),
      mockStepLogger() as never,
    );
    service.onModuleInit();
    const c = service.get();
    expect(c.hard.rentMinEur).toBe(500);
    expect(c.hard.zones?.[0].name).toBe('Cenisia');
    expect(c.telegram?.aiSuggestion?.prompt).toContain('one short English');
  });

  it('logs rent and area bounds on init', () => {
    const log = mockStepLogger();
    const service = new CriteriaLoaderService(
      mockConfig({ CRITERIA_PATH: CRITERIA_TEST_PATH }),
      log as never,
    );
    service.onModuleInit();
    expect(log._ctx.step).toHaveBeenCalledWith(
      'config',
      'Criteria loaded',
      expect.objectContaining({
        rent: [500, 1000],
        area: [60, 80],
        zones: ['Cenisia'],
      }),
    );
  });
});
