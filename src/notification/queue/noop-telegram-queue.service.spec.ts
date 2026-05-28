import { NoopTelegramQueueService } from './noop-telegram-queue.service';

describe('NoopTelegramQueueService', () => {
  const svc = new NoopTelegramQueueService();

  it('is disabled', () => {
    expect(svc.isEnabled()).toBe(false);
  });

  it('enqueueJobs returns 0', async () => {
    await expect(svc.enqueueJobs([{ kind: 'text', text: 'x' }])).resolves.toBe(
      0,
    );
  });

  it('getQueueStats returns null', async () => {
    await expect(svc.getQueueStats()).resolves.toBeNull();
  });
});
