import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import { RunDailyPipelineUseCase } from '../application/run-daily-pipeline.use-case';

export const PIPELINE_CRON_JOB_NAME = 'pipeline-run';

/** Default: every 3 hours at minute 0 (00:00, 03:00, 06:00, …). */
export const DEFAULT_CRON_EXPRESSION = '0 */3 * * *';

@Injectable()
export class PipelineCron implements OnModuleInit {
  private readonly log;

  constructor(
    private readonly runPipeline: RunDailyPipelineUseCase,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(PipelineCron.name);
  }

  onModuleInit(): void {
    if (this.config.get<string>('PIPELINE_CRON_ENABLED') === 'false') {
      this.log.info(
        'pipeline',
        'Cron not scheduled — PIPELINE_CRON_ENABLED=false',
      );
      return;
    }

    const expression =
      this.config.get<string>('CRON_EXPRESSION')?.trim() ||
      DEFAULT_CRON_EXPRESSION;

    const job = new CronJob(expression, () => {
      void this.handleCron(expression);
    });
    this.schedulerRegistry.addCronJob(PIPELINE_CRON_JOB_NAME, job);
    job.start();
    this.log.step('pipeline', 'Cron scheduled', { expression });
  }

  async handleCron(expression?: string): Promise<void> {
    if (this.config.get<string>('PIPELINE_CRON_ENABLED') === 'false') {
      this.log.debug('pipeline', 'Cron skipped — PIPELINE_CRON_ENABLED=false');
      return;
    }
    const cronExpr =
      expression ??
      this.config.get<string>('CRON_EXPRESSION')?.trim() ??
      DEFAULT_CRON_EXPRESSION;
    this.log.step('pipeline', 'Cron triggered', { expression: cronExpr });
    try {
      await this.runPipeline.execute();
    } catch (err) {
      this.log.error('pipeline', 'Cron run failed', err);
    }
  }
}
