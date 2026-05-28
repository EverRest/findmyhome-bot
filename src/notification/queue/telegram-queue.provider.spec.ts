import type { ConfigService } from '@nestjs/config';
import { telegramQueueProvider } from './telegram-queue.provider';
import { TELEGRAM_QUEUE_PORT } from './telegram-queue.port';
import type { TelegramQueuePort } from './telegram-queue.port';
import { NoopTelegramQueueService } from './noop-telegram-queue.service';
import { BullmqTelegramQueueService } from './bullmq-telegram-queue.service';
import { mockConfig } from '../../../test/helpers/test-utils';

function createQueuePort(
  config: ConfigService,
  bullmq: BullmqTelegramQueueService,
): TelegramQueuePort {
  const factory = telegramQueueProvider as {
    useFactory: (
      c: ConfigService,
      b: BullmqTelegramQueueService,
    ) => TelegramQueuePort;
  };
  return factory.useFactory(config, bullmq);
}

describe('telegramQueueProvider', () => {
  const bullmq = {} as BullmqTelegramQueueService;

  it('returns noop when disabled', () => {
    const port = createQueuePort(
      mockConfig({ BULLMQ_ENABLED: 'false' }),
      bullmq,
    );
    expect(port).toBeInstanceOf(NoopTelegramQueueService);
  });

  it('returns bullmq service when enabled', () => {
    const port = createQueuePort(
      mockConfig({ BULLMQ_ENABLED: 'true' }),
      bullmq,
    );
    expect(port).toBe(bullmq);
  });

  it('registers TELEGRAM_QUEUE_PORT token', () => {
    expect(telegramQueueProvider.provide).toBe(TELEGRAM_QUEUE_PORT);
  });
});
