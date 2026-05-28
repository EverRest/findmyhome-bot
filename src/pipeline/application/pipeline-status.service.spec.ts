import { PipelineStatusService } from './pipeline-status.service';
import { createPrismaMock } from '../../../test/helpers/prisma-mock';
import { mockConfig } from '../../../test/helpers/test-utils';

const redisConnect = jest.fn();
const redisPing = jest.fn();
const redisQuit = jest.fn();

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    connect: redisConnect,
    ping: redisPing,
    quit: redisQuit,
  })),
}));

describe('PipelineStatusService', () => {
  const prisma = createPrismaMock();
  const gmail = {
    isConfigured: jest.fn().mockReturnValue(true),
    getGmailDiagnostics: jest.fn().mockReturnValue({ hasClientId: true }),
  };
  const telegram = { isConfigured: jest.fn().mockReturnValue(true) };
  const telegramQueue = {
    getQueueStats: jest.fn().mockResolvedValue(null),
  };

  const service = new PipelineStatusService(
    prisma,
    mockConfig(),
    gmail,
    telegram,
    telegramQueue,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    redisConnect.mockResolvedValue(undefined);
    redisPing.mockResolvedValue('PONG');
    redisQuit.mockResolvedValue(undefined);
  });

  it('returns status with integrations', async () => {
    prisma.pipelineRun.findFirst.mockResolvedValue({
      id: 'r1',
      status: 'completed',
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    prisma.listing.count.mockResolvedValue(5);
    prisma.listingScore.count.mockResolvedValue(5);
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);

    const s = await service.getStatus();
    expect(s.integrations.gmail).toBe(true);
    expect(s.integrations.telegram).toBe(true);
    expect(s.integrations.ollama).toBe(true);
    expect(s.integrations.redis).toBe(false);
    expect(s.integrations.facebook.enabled).toBe(false);
    expect(s.config.bullmqEnabled).toBe(false);
    expect(s.counts.listings).toBe(5);
  });

  it('omits gmail diagnostics when not available', async () => {
    const noDiag = {
      isConfigured: jest.fn().mockReturnValue(false),
    };
    const svc = new PipelineStatusService(
      prisma,
      mockConfig({
        PIPELINE_DRY_RUN: 'true',
        PIPELINE_CRON_ENABLED: 'false',
        TOP_N: '5',
      }),
      noDiag,
      telegram,
      telegramQueue,
    );
    prisma.pipelineRun.findFirst.mockResolvedValue(null);
    prisma.listing.count.mockResolvedValue(0);
    prisma.listingScore.count.mockResolvedValue(0);
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    const s = await svc.getStatus();
    expect(s.gmailDiagnostics).toBeUndefined();
    expect(s.config.dryRun).toBe(true);
    expect(s.config.cronEnabled).toBe(false);
  });

  it('handles ollama down', async () => {
    prisma.pipelineRun.findFirst.mockResolvedValue(null);
    prisma.listing.count.mockResolvedValue(0);
    prisma.listingScore.count.mockResolvedValue(0);
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('down'));

    const s = await service.getStatus();
    expect(s.integrations.ollama).toBe(false);
    expect(s.lastRun).toBeNull();
  });

  it('reports redis and queue when BullMQ enabled', async () => {
    const queue = {
      getQueueStats: jest.fn().mockResolvedValue({ waiting: 4, active: 0 }),
    };
    const svc = new PipelineStatusService(
      prisma,
      mockConfig({
        BULLMQ_ENABLED: 'true',
        REDIS_URL: 'redis://127.0.0.1:6379',
      }),
      gmail,
      telegram,
      queue,
    );
    prisma.pipelineRun.findFirst.mockResolvedValue(null);
    prisma.listing.count.mockResolvedValue(0);
    prisma.listingScore.count.mockResolvedValue(0);
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);

    const s = await svc.getStatus();
    expect(s.config.bullmqEnabled).toBe(true);
    expect(s.integrations.redis).toBe(true);
    expect(s.telegramQueue).toEqual({ waiting: 4, active: 0 });
    expect(redisConnect).toHaveBeenCalled();
    expect(redisQuit).toHaveBeenCalled();
  });

  it('redis false when BullMQ enabled but connection fails', async () => {
    redisConnect.mockRejectedValueOnce(new Error('down'));
    const svc = new PipelineStatusService(
      prisma,
      mockConfig({ BULLMQ_ENABLED: 'true' }),
      gmail,
      telegram,
      telegramQueue,
    );
    prisma.pipelineRun.findFirst.mockResolvedValue(null);
    prisma.listing.count.mockResolvedValue(0);
    prisma.listingScore.count.mockResolvedValue(0);
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);

    const s = await svc.getStatus();
    expect(s.integrations.redis).toBe(false);
    expect(s.telegramQueue).toBeNull();
  });
});
