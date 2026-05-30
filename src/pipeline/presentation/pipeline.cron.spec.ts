import { CronJob } from 'cron';
import { PipelineCron } from './pipeline.cron';
import { mockConfig, mockStepLogger } from '../../../test/helpers/test-utils';

jest.mock('cron', () => ({
  CronJob: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    running: true,
  })),
}));

const CronJobMock = CronJob as unknown as jest.Mock;

describe('PipelineCron', () => {
  const runPipeline = { execute: jest.fn().mockResolvedValue({}) };
  const log = mockStepLogger();
  const schedulerRegistry = {
    addCronJob: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('skips when cron disabled', async () => {
    const cron = new PipelineCron(
      runPipeline as never,
      mockConfig({ PIPELINE_CRON_ENABLED: 'false' }),
      schedulerRegistry,
      log as never,
    );
    await cron.handleCron();
    expect(runPipeline.execute).not.toHaveBeenCalled();
  });

  it('does not register job when cron disabled on init', () => {
    const cron = new PipelineCron(
      runPipeline as never,
      mockConfig({ PIPELINE_CRON_ENABLED: 'false' }),
      schedulerRegistry,
      log as never,
    );
    cron.onModuleInit();
    expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
  });

  it('registers cron job from CRON_EXPRESSION when enabled', () => {
    const cron = new PipelineCron(
      runPipeline as never,
      mockConfig({
        PIPELINE_CRON_ENABLED: 'true',
        CRON_EXPRESSION: '0 */3 * * *',
      }),
      schedulerRegistry as never,
      log as never,
    );
    cron.onModuleInit();
    expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
      'pipeline-run',
      expect.objectContaining({ running: true }),
    );
    expect(log._ctx.step).toHaveBeenCalledWith('pipeline', 'Cron scheduled', {
      expression: '0 */3 * * *',
    });
  });

  it('runs pipeline when cron job callback fires', async () => {
    const cron = new PipelineCron(
      runPipeline as never,
      mockConfig({ PIPELINE_CRON_ENABLED: 'true' }),
      schedulerRegistry as never,
      log as never,
    );
    cron.onModuleInit();
    const onTick = CronJobMock.mock.calls[0][1] as () => Promise<void>;
    await onTick();
    expect(runPipeline.execute).toHaveBeenCalled();
  });

  it('uses default cron expression when CRON_EXPRESSION is blank', () => {
    const cron = new PipelineCron(
      runPipeline as never,
      mockConfig({ PIPELINE_CRON_ENABLED: 'true', CRON_EXPRESSION: '   ' }),
      schedulerRegistry as never,
      log as never,
    );
    cron.onModuleInit();
    expect(log._ctx.step).toHaveBeenCalledWith('pipeline', 'Cron scheduled', {
      expression: '0 */3 * * *',
    });
  });

  it('runs pipeline when enabled', async () => {
    const cron = new PipelineCron(
      runPipeline as never,
      mockConfig({ PIPELINE_CRON_ENABLED: 'true' }),
      schedulerRegistry as never,
      log as never,
    );
    await cron.handleCron();
    expect(runPipeline.execute).toHaveBeenCalled();
  });

  it('logs error on failure', async () => {
    runPipeline.execute.mockRejectedValueOnce(new Error('cron fail'));
    const cron = new PipelineCron(
      runPipeline as never,
      mockConfig({ PIPELINE_CRON_ENABLED: 'true' }),
      schedulerRegistry,
      log as never,
    );
    await cron.handleCron();
    expect(log._ctx.error).toHaveBeenCalled();
  });
});
