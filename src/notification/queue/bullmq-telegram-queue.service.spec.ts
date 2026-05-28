import { BullmqTelegramQueueService } from './bullmq-telegram-queue.service';
import { TELEGRAM_SEND_QUEUE_NAME } from './telegram-send-job';
import { mockConfig, mockStepLogger } from '../../../test/helpers/test-utils';
import { processTelegramSendJob } from './process-telegram-send-job';

const queueAdd = jest.fn().mockResolvedValue(undefined);
const queueClose = jest.fn().mockResolvedValue(undefined);
const queueGetJobCounts = jest
  .fn()
  .mockResolvedValue({ waiting: 2, active: 1 });

const workerOn = jest.fn();
const workerClose = jest.fn().mockResolvedValue(undefined);
let workerProcessor: ((job: { data: unknown }) => Promise<void>) | null = null;

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: queueAdd,
    close: queueClose,
    getJobCounts: queueGetJobCounts,
  })),
  Worker: jest.fn().mockImplementation((_name, processor) => {
    workerProcessor = processor as (job: { data: unknown }) => Promise<void>;
    return { on: workerOn, close: workerClose };
  }),
}));

jest.mock('./process-telegram-send-job', () => ({
  processTelegramSendJob: jest.fn().mockResolvedValue(undefined),
}));

const { Queue, Worker } = jest.requireMock<{
  Queue: jest.Mock;
  Worker: jest.Mock;
}>('bullmq');

describe('BullmqTelegramQueueService', () => {
  const telegram = { sendText: jest.fn() };
  const listings = {
    shouldSendToTelegram: jest.fn(),
    findByIdForDigest: jest.fn(),
    markTelegramSent: jest.fn(),
  };
  const log = mockStepLogger();

  const create = (env: Record<string, string | undefined> = {}) =>
    new BullmqTelegramQueueService(
      mockConfig({ BULLMQ_ENABLED: 'false', ...env }),
      telegram as never,
      listings as never,
      log as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    workerProcessor = null;
    Queue.mockClear();
    Worker.mockClear();
  });

  it('isEnabled follows BULLMQ_ENABLED', () => {
    expect(create().isEnabled()).toBe(false);
    expect(create({ BULLMQ_ENABLED: 'true' }).isEnabled()).toBe(true);
  });

  it('skips BullMQ init when disabled', () => {
    create().onModuleInit();
    expect(Queue).not.toHaveBeenCalled();
  });

  it('starts queue and worker when enabled', () => {
    create({
      BULLMQ_ENABLED: 'true',
      REDIS_URL: 'redis://localhost:6379',
    }).onModuleInit();
    expect(Queue).toHaveBeenCalledWith(TELEGRAM_SEND_QUEUE_NAME, {
      connection: { url: 'redis://localhost:6379', maxRetriesPerRequest: null },
    });
    expect(Worker).toHaveBeenCalled();
    expect(workerOn).toHaveBeenCalledWith('failed', expect.any(Function));
    expect(workerOn).toHaveBeenCalledWith('completed', expect.any(Function));
  });

  it('masks password in redis log url', () => {
    create({
      BULLMQ_ENABLED: 'true',
      REDIS_URL: 'redis://:secret@redis:6379',
    }).onModuleInit();
    expect(log._ctx.step).toHaveBeenCalledWith(
      'telegram',
      'BullMQ worker started',
      expect.objectContaining({
        redisUrl: 'redis://:***@redis:6379',
      }),
    );
  });

  it('throws when enqueue before init', async () => {
    await expect(create().enqueueJobs([])).rejects.toThrow(
      'Telegram queue not initialized',
    );
  });

  it('enqueues text and listing jobs', async () => {
    const svc = create({ BULLMQ_ENABLED: 'true' });
    svc.onModuleInit();
    const n = await svc.enqueueJobs([
      { kind: 'text', text: 'header' },
      { kind: 'listing-card', listingId: 'l1' },
      { kind: 'listing-card', listingId: 'l2' },
    ]);
    expect(n).toBe(2);
    expect(queueAdd).toHaveBeenCalledTimes(3);
    expect(queueAdd).toHaveBeenCalledWith(
      'send',
      { kind: 'text', text: 'header' },
      expect.objectContaining({ delay: 0 }),
    );
    expect(queueAdd).toHaveBeenCalledWith(
      'send',
      { kind: 'listing-card', listingId: 'l1' },
      expect.objectContaining({ jobId: 'listing-l1', delay: 2500 }),
    );
    expect(queueAdd).toHaveBeenCalledWith(
      'send',
      { kind: 'listing-card', listingId: 'l2' },
      expect.objectContaining({ jobId: 'listing-l2', delay: 5000 }),
    );
    const headerCall = queueAdd.mock.calls[0] as
      | [string, unknown, Record<string, unknown>]
      | undefined;
    expect(headerCall?.[2]).not.toHaveProperty('jobId');
  });

  it('returns queue stats when initialized', async () => {
    const svc = create({ BULLMQ_ENABLED: 'true' });
    svc.onModuleInit();
    queueGetJobCounts.mockResolvedValueOnce({
      waiting: 2,
      active: 1,
      delayed: 5,
    });
    await expect(svc.getQueueStats()).resolves.toEqual({
      waiting: 2,
      active: 1,
      delayed: 5,
    });
  });

  it('defaults missing job counts to zero', async () => {
    queueGetJobCounts.mockResolvedValueOnce({});
    const svc = create({ BULLMQ_ENABLED: 'true' });
    svc.onModuleInit();
    await expect(svc.getQueueStats()).resolves.toEqual({
      waiting: 0,
      active: 0,
      delayed: 0,
    });
  });

  it('returns null stats when queue not started', async () => {
    await expect(create().getQueueStats()).resolves.toBeNull();
  });

  it('closes worker and queue on destroy', async () => {
    const svc = create({ BULLMQ_ENABLED: 'true' });
    svc.onModuleInit();
    await svc.onModuleDestroy();
    expect(workerClose).toHaveBeenCalled();
    expect(queueClose).toHaveBeenCalled();
  });

  it('worker processor delegates to processTelegramSendJob', async () => {
    const svc = create({ BULLMQ_ENABLED: 'true' });
    svc.onModuleInit();
    expect(workerProcessor).not.toBeNull();
    await workerProcessor!({
      data: { kind: 'text', text: 'hi' },
    });
    expect(processTelegramSendJob).toHaveBeenCalledWith(
      { kind: 'text', text: 'hi' },
      telegram,
      listings,
    );
  });

  it('logs failed and completed worker events', () => {
    const svc = create({ BULLMQ_ENABLED: 'true' });
    svc.onModuleInit();
    const workerCalls = workerOn.mock.calls as [
      string,
      (job: { id: string; data: { kind: string } }, err?: Error) => void,
    ][];
    const failedCb = workerCalls.find((c) => c[0] === 'failed')?.[1];
    const completedCb = workerCalls.find((c) => c[0] === 'completed')?.[1];
    if (!failedCb || !completedCb) {
      throw new Error('worker handlers not registered');
    }

    failedCb({ id: 'j1', data: { kind: 'text' } }, new Error('boom'));
    completedCb({ id: 'j2', data: { kind: 'listing-card' } });

    expect(log._ctx.error).toHaveBeenCalled();
    expect(log._ctx.debug).toHaveBeenCalled();
  });
});
