import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TELEGRAM_QUEUE_PORT } from './telegram-queue.port';
import { NoopTelegramQueueService } from './noop-telegram-queue.service';
import { BullmqTelegramQueueService } from './bullmq-telegram-queue.service';
import { isBullmqEnabled } from './bullmq.config';

export { isBullmqEnabled } from './bullmq.config';

export const telegramQueueProvider: Provider = {
  provide: TELEGRAM_QUEUE_PORT,
  useFactory: (config: ConfigService, bullmq: BullmqTelegramQueueService) => {
    if (isBullmqEnabled(config)) {
      return bullmq;
    }
    return new NoopTelegramQueueService();
  },
  inject: [ConfigService, BullmqTelegramQueueService],
};
