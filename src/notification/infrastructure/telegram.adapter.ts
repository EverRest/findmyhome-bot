import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import { TelegramPort } from '../domain/telegram.port';
import {
  isTelegramRateLimitError,
  sleepMs,
  telegramRetryAfterMs,
} from './telegram-api.utils';

/** Telegram Bot API via [telegraf](https://telegraf.js.org) (send-only + long polling). */
@Injectable()
export class TelegramAdapter
  implements TelegramPort, OnModuleInit, OnModuleDestroy
{
  private readonly log;
  private bot?: Telegraf;

  constructor(
    private readonly config: ConfigService,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(TelegramAdapter.name);
  }

  onModuleInit(): void {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.log.warn('telegram', 'TELEGRAM_BOT_TOKEN missing — bot off');
      return;
    }
    const chatIds = this.getChatIds();
    this.bot = new Telegraf(token);
    void this.bot.launch().then(() => {
      this.log.step('telegram', 'Bot started (long polling)', {
        chatIds,
      });
    });
  }

  onModuleDestroy(): void {
    if (this.bot) {
      this.log.info('telegram', 'Stopping bot');
      this.bot.stop();
    }
  }

  isConfigured(): boolean {
    return Boolean(this.bot) && this.getChatIds().length > 0;
  }

  async sendText(text: string): Promise<string | undefined> {
    if (!this.bot) return undefined;
    const chatIds = this.getChatIds();
    const maxRetries = Number(this.config.get('TELEGRAM_MAX_RETRIES') ?? 5);
    let lastId: string | undefined;

    for (const chatId of chatIds) {
      this.log.debug('telegram', 'sendMessage', {
        chatId,
        length: text.length,
      });
      lastId = await this.sendMessageWithRetry(chatId, text, maxRetries);
    }
    return lastId;
  }

  private async sendMessageWithRetry(
    chatId: string,
    text: string,
    maxRetries: number,
  ): Promise<string> {
    let attempt = 0;
    for (;;) {
      try {
        const msg = await this.bot!.telegram.sendMessage(chatId, text, {
          link_preview_options: { is_disabled: false },
        });
        return String(msg.message_id);
      } catch (err) {
        const waitMs = telegramRetryAfterMs(err);
        if (waitMs != null && attempt < maxRetries) {
          attempt++;
          this.log.warn('telegram', 'Rate limited — waiting to retry', {
            chatId,
            attempt,
            waitMs,
          });
          await sleepMs(waitMs + 500);
          continue;
        }
        if (isTelegramRateLimitError(err)) {
          this.log.warn('telegram', 'Rate limit — giving up after retries', {
            chatId,
            attempt,
          });
        }
        throw err;
      }
    }
  }

  private getChatIds(): string[] {
    const raw = this.config.get<string>('TELEGRAM_CHAT_IDS') ?? '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}
