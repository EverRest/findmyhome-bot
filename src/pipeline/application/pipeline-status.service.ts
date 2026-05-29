import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { GMAIL_PORT } from '../../email-ingestion/domain/gmail.port';
import type { GmailPort } from '../../email-ingestion/domain/gmail.port';
import { TELEGRAM_PORT } from '../../notification/domain/telegram.port';
import type { TelegramPort } from '../../notification/domain/telegram.port';
import { TELEGRAM_QUEUE_PORT } from '../../notification/queue/telegram-queue.port';
import type { TelegramQueuePort } from '../../notification/queue/telegram-queue.port';
import { isBullmqEnabled } from '../../notification/queue/bullmq.config';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { parseFacebookGroupIds } from '../../facebook-ingestion/domain/parse-facebook-group-ids';

@Injectable()
export class PipelineStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(GMAIL_PORT) private readonly gmail: GmailPort,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
    @Inject(TELEGRAM_QUEUE_PORT)
    private readonly telegramQueue: TelegramQueuePort,
  ) {}

  async getStatus(): Promise<{
    integrations: {
      gmail: boolean;
      telegram: boolean;
      ollama: boolean;
      redis: boolean;
      facebook: {
        enabled: boolean;
        configured: boolean;
        storageExists: boolean;
        groupCount: number;
      };
    };
    gmailDiagnostics?: {
      hasClientId: boolean;
      hasClientSecret: boolean;
      tokenFile: string;
      tokenFileExists: boolean;
      hasRefreshToken: boolean;
      cwd: string;
    };
    lastRun: {
      id: string;
      status: string;
      startedAt: Date;
      finishedAt: Date | null;
    } | null;
    counts: { listings: number; scores: number };
    config: {
      dryRun: boolean;
      cronEnabled: boolean;
      cronExpression: string;
      topN: number;
      ollamaUrl: string;
      bullmqEnabled: boolean;
    };
    telegramQueue: { waiting: number; active: number } | null;
  }> {
    const lastRun = await this.prisma.pipelineRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });
    const [listings, scores] = await Promise.all([
      this.prisma.listing.count(),
      this.prisma.listingScore.count(),
    ]);

    let ollama = false;
    const ollamaUrl =
      this.config.get<string>('OLLAMA_BASE_URL') ?? 'http://127.0.0.1:11434';
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      ollama = res.ok;
    } catch {
      ollama = false;
    }

    const gmailDiagnostics =
      typeof this.gmail.getGmailDiagnostics === 'function'
        ? this.gmail.getGmailDiagnostics()
        : undefined;

    const bullmqEnabled = isBullmqEnabled(this.config);
    let redis = false;
    if (bullmqEnabled) {
      const redisUrl =
        this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
      try {
        const client = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          lazyConnect: true,
        });
        await client.connect();
        redis = (await client.ping()) === 'PONG';
        await client.quit();
      } catch {
        redis = false;
      }
    }

    const telegramQueue = bullmqEnabled
      ? await this.telegramQueue.getQueueStats()
      : null;

    const fbEnabled =
      this.config.get<string>('FACEBOOK_INGESTION_ENABLED') === 'true';
    const fbStorage =
      this.config.get<string>('FACEBOOK_STORAGE_STATE_PATH') ??
      './secrets/facebook-storage.json';
    const fbStorageExists = existsSync(resolve(process.cwd(), fbStorage));
    const fbGroupIds = parseFacebookGroupIds(
      this.config.get<string>('FACEBOOK_GROUP_IDS') ?? '',
    );

    return {
      integrations: {
        gmail: this.gmail.isConfigured(),
        telegram: this.telegram.isConfigured(),
        ollama,
        redis,
        facebook: {
          enabled: fbEnabled,
          configured: fbEnabled && fbGroupIds.length > 0 && fbStorageExists,
          storageExists: fbStorageExists,
          groupCount: fbGroupIds.length,
        },
      },
      gmailDiagnostics,
      lastRun: lastRun
        ? {
            id: lastRun.id,
            status: lastRun.status,
            startedAt: lastRun.startedAt,
            finishedAt: lastRun.finishedAt,
          }
        : null,
      counts: { listings, scores },
      config: {
        dryRun: this.config.get('PIPELINE_DRY_RUN') === 'true',
        cronEnabled: this.config.get('PIPELINE_CRON_ENABLED') !== 'false',
        cronExpression:
          this.config.get<string>('CRON_EXPRESSION')?.trim() || '0 */3 * * *',
        topN: Number(this.config.get('TOP_N') ?? 10),
        ollamaUrl,
        bullmqEnabled,
      },
      telegramQueue,
    };
  }
}
