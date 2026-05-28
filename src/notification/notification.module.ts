import { Module } from '@nestjs/common';
import { ListingModule } from '../listing/listing.module';
import { SendDigestUseCase } from './application/send-digest.use-case';
import { TELEGRAM_PORT } from './domain/telegram.port';
import { TelegramAdapter } from './infrastructure/telegram.adapter';
import { BullmqTelegramQueueService } from './queue/bullmq-telegram-queue.service';
import { telegramQueueProvider } from './queue/telegram-queue.provider';
import { TELEGRAM_QUEUE_PORT } from './queue/telegram-queue.port';

@Module({
  imports: [ListingModule],
  providers: [
    TelegramAdapter,
    BullmqTelegramQueueService,
    telegramQueueProvider,
    SendDigestUseCase,
    { provide: TELEGRAM_PORT, useExisting: TelegramAdapter },
  ],
  exports: [SendDigestUseCase, TELEGRAM_PORT, TELEGRAM_QUEUE_PORT],
})
export class NotificationModule {}
