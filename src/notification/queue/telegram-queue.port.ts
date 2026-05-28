import type { TelegramSendJob } from './telegram-send-job';

export const TELEGRAM_QUEUE_PORT = Symbol('TELEGRAM_QUEUE_PORT');

export interface TelegramQueuePort {
  isEnabled(): boolean;
  enqueueJobs(jobs: TelegramSendJob[]): Promise<number>;
  getQueueStats(): Promise<{
    waiting: number;
    active: number;
    delayed: number;
  } | null>;
}
