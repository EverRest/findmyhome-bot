import { ContextStepLogger, StepLoggerService } from './step-logger.service';
import { mockConfig } from '../../../test/helpers/test-utils';

describe('StepLoggerService', () => {
  const service = new StepLoggerService(mockConfig({ LOG_LEVEL: 'debug' }));

  it('creates context logger', () => {
    const ctx = service.create('TestCtx');
    expect(ctx).toBeInstanceOf(ContextStepLogger);
    expect(service.isDebug()).toBe(true);
  });

  it('logs at all levels when debug', () => {
    const ctx = service.create('TestCtx');
    ctx.step('pipeline', 'step');
    ctx.info('gmail', 'info');
    ctx.debug('parse', 'debug');
    ctx.warn('listing', 'warn');
    ctx.error('score', 'error', new Error('x'));
  });

  it('skips debug when log level is log', () => {
    const quiet = new StepLoggerService(mockConfig({ LOG_LEVEL: 'log' }));
    const ctx = quiet.create('Quiet');
    ctx.debug('parse', 'hidden');
    expect(quiet.isDebug()).toBe(false);
  });

  it('timed runs fn and logs', async () => {
    const ctx = service.create('TestCtx');
    const v = await ctx.timed('pipeline', 'job', async () => 42);
    expect(v).toBe(42);
  });

  it('error logs non-Error values', () => {
    const ctx = service.create('TestCtx');
    ctx.error('pipeline', 'fail', 'string-error');
    ctx.step('pipeline', 'no-data');
    ctx.info('pipeline', 'no-data');
  });

  it('timed rethrows on failure', async () => {
    const ctx = service.create('TestCtx');
    await expect(
      ctx.timed('pipeline', 'fail', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
