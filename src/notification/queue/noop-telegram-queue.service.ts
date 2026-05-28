import { Injectable } from '@nestjs/common';
import type { TelegramQueuePort } from './telegram-queue.port';
import type { TelegramSendJob } from './telegram-send-job';

@Injectable()
export class NoopTelegramQueueService implements TelegramQueuePort {
  isEnabled(): boolean {
    return false;
  }

  enqueueJobs(_jobs: TelegramSendJob[]): Promise<number> {
    void _jobs;
    return Promise.resolve(0);
  }

  getQueueStats(): Promise<null> {
    return Promise.resolve(null);
  }
}
