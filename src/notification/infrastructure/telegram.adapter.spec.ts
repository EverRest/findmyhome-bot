import { TelegramAdapter } from './telegram.adapter';
import { mockConfig, mockStepLogger } from '../../../test/helpers/test-utils';

const sendMessage = jest.fn().mockResolvedValue({ message_id: 99 });
const launch = jest.fn().mockResolvedValue(undefined);
const stop = jest.fn();

jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    launch,
    stop,
    telegram: { sendMessage },
  })),
}));

describe('TelegramAdapter', () => {
  const log = mockStepLogger();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not start without token', () => {
    const adapter = new TelegramAdapter(
      mockConfig({ TELEGRAM_BOT_TOKEN: undefined }),
      log as never,
    );
    adapter.onModuleInit();
    expect(adapter.isConfigured()).toBe(false);
    adapter.onModuleDestroy();
  });

  it('sendText returns undefined without bot', async () => {
    const adapter = new TelegramAdapter(
      mockConfig({ TELEGRAM_BOT_TOKEN: undefined }),
      log as never,
    );
    expect(await adapter.sendText('hi')).toBeUndefined();
  });

  it('isConfigured false without chat ids', async () => {
    const adapter = new TelegramAdapter(
      mockConfig({
        TELEGRAM_BOT_TOKEN: 'tok',
        TELEGRAM_CHAT_IDS: '',
      }),
      log as never,
    );
    adapter.onModuleInit();
    await Promise.resolve();
    expect(adapter.isConfigured()).toBe(false);
  });

  it('starts bot and sends messages', async () => {
    const adapter = new TelegramAdapter(
      mockConfig({
        TELEGRAM_BOT_TOKEN: 'tok',
        TELEGRAM_CHAT_IDS: '-100',
      }),
      log as never,
    );
    adapter.onModuleInit();
    await Promise.resolve();
    expect(adapter.isConfigured()).toBe(true);
    const mid = await adapter.sendText('hello');
    expect(mid).toBe('99');
    expect(sendMessage).toHaveBeenCalled();
    adapter.onModuleDestroy();
  });

  it('sends to multiple chat ids', async () => {
    const adapter = new TelegramAdapter(
      mockConfig({
        TELEGRAM_BOT_TOKEN: 'tok',
        TELEGRAM_CHAT_IDS: '-100,-200',
      }),
      log as never,
    );
    adapter.onModuleInit();
    await Promise.resolve();
    await adapter.sendText('multi');
    expect(sendMessage).toHaveBeenCalledTimes(2);
    adapter.onModuleDestroy();
  });

  it('retries on 429 with retry_after', async () => {
    jest.useFakeTimers();
    sendMessage
      .mockRejectedValueOnce({
        response: { error_code: 429, parameters: { retry_after: 1 } },
      })
      .mockResolvedValue({ message_id: 42 });
    const adapter = new TelegramAdapter(
      mockConfig({
        TELEGRAM_BOT_TOKEN: 'tok',
        TELEGRAM_CHAT_IDS: '-100',
        TELEGRAM_MAX_RETRIES: '2',
      }),
      log as never,
    );
    adapter.onModuleInit();
    await Promise.resolve();
    const p = adapter.sendText('retry-me');
    await jest.advanceTimersByTimeAsync(2000);
    expect(await p).toBe('42');
    expect(sendMessage).toHaveBeenCalledTimes(2);
    adapter.onModuleDestroy();
    jest.useRealTimers();
  });

  it('gives up after max retries on persistent 429', async () => {
    sendMessage.mockRejectedValue(
      new Error('429: Too Many Requests: retry after 1'),
    );
    const adapter = new TelegramAdapter(
      mockConfig({
        TELEGRAM_BOT_TOKEN: 'tok',
        TELEGRAM_CHAT_IDS: '-100',
        TELEGRAM_MAX_RETRIES: '0',
      }),
      log as never,
    );
    adapter.onModuleInit();
    await Promise.resolve();
    await expect(adapter.sendText('fail')).rejects.toThrow(/429/);
    expect(log._ctx.warn).toHaveBeenCalledWith(
      'telegram',
      'Rate limit — giving up after retries',
      expect.any(Object),
    );
    adapter.onModuleDestroy();
  });
});
