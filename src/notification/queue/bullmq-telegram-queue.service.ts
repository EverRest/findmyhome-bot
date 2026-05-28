import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import { LISTING_REPOSITORY } from '../../listing/domain/listing.repository.port';
import type { ListingRepositoryPort } from '../../listing/domain/listing.repository.port';
import { TELEGRAM_PORT } from '../domain/telegram.port';
import type { TelegramPort } from '../domain/telegram.port';
import {
  TELEGRAM_SEND_QUEUE_NAME,
  type TelegramSendJob,
} from './telegram-send-job';
import type { TelegramQueuePort } from './telegram-queue.port';
import { processTelegramSendJob } from './process-telegram-send-job';
import { CriteriaLoaderService } from '../../shared/infrastructure/criteria-loader.service';
import { isBullmqEnabled } from './bullmq.config';
import { staggerDelaysForJobs } from './telegram-queue-schedule.utils';

@Injectable()
export class BullmqTelegramQueueService
  implements TelegramQueuePort, OnModuleInit, OnModuleDestroy
{
  private readonly log;
  private queue: Queue<TelegramSendJob, void, string> | null = null;
  private worker: Worker<TelegramSendJob, void, string> | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
    @Inject(LISTING_REPOSITORY)
    private readonly listings: ListingRepositoryPort,
    private readonly criteria: CriteriaLoaderService,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(BullmqTelegramQueueService.name);
  }

  isEnabled(): boolean {
    return isBullmqEnabled(this.config);
  }

  onModuleInit(): void {
    if (!isBullmqEnabled(this.config)) {
      return;
    }

    const url =
      this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
    const delayMs = Number(this.config.get('TELEGRAM_SEND_DELAY_MS') ?? 2500);
    const connection = { url, maxRetriesPerRequest: null };

    this.queue = new Queue<TelegramSendJob, void, string>(
      TELEGRAM_SEND_QUEUE_NAME,
      { connection },
    );

    this.worker = new Worker<TelegramSendJob, void, string>(
      TELEGRAM_SEND_QUEUE_NAME,
      async (job) => this.handleJob(job),
      {
        connection,
        concurrency: 1,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.log.error('telegram', 'Queue job failed', err, {
        jobId: job?.id,
        kind: job?.data.kind,
      });
    });

    this.worker.on('completed', (job) => {
      this.log.debug('telegram', 'Queue job completed', {
        jobId: job.id,
        kind: job.data.kind,
      });
    });

    this.log.step('telegram', 'BullMQ worker started', {
      queue: TELEGRAM_SEND_QUEUE_NAME,
      delayMs,
      stagger: 'scheduled-delay-per-job',
      redisUrl: url.replace(/:[^:@]+@/, ':***@'),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.worker = null;
    this.queue = null;
  }

  async enqueueJobs(jobs: TelegramSendJob[]): Promise<number> {
    if (!this.queue) {
      throw new Error('Telegram queue not initialized');
    }

    const delayMs = Number(this.config.get('TELEGRAM_SEND_DELAY_MS') ?? 2500);
    const staggerMs = staggerDelaysForJobs(jobs.length, delayMs);

    let listingCount = 0;
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const opts = {
        delay: staggerMs[i],
        attempts: Number(this.config.get('TELEGRAM_MAX_RETRIES') ?? 5),
        backoff: { type: 'exponential' as const, delay: 5000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      };
      if (job.kind === 'listing-card') {
        await this.queue.add('send', job, {
          ...opts,
          jobId: `listing-${job.listingId}`,
        });
        listingCount++;
      } else {
        await this.queue.add('send', job, opts);
      }
    }

    const spanMin = Math.round(((jobs.length - 1) * delayMs) / 60_000);

    this.log.info('telegram', 'Jobs enqueued (staggered)', {
      total: jobs.length,
      listingCards: listingCount,
      delayMs,
      spanMinutes: spanMin,
    });
    return listingCount;
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    delayed: number;
  } | null> {
    if (!this.queue) return null;
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
    );
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
    };
  }

  private async handleJob(job: Job<TelegramSendJob>): Promise<void> {
    const referencePointName =
      this.criteria.get().scoring.referencePoint?.name ?? null;
    await processTelegramSendJob(job.data, this.telegram, this.listings, {
      referencePointName,
    });
  }
}
