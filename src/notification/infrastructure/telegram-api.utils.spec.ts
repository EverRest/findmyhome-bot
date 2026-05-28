import {
  isTelegramRateLimitError,
  telegramRetryAfterMs,
} from './telegram-api.utils';

describe('telegram-api.utils', () => {
  it('detects retry_after from Telegram API shape', () => {
    const err = {
      response: { error_code: 429, parameters: { retry_after: 23 } },
    };
    expect(isTelegramRateLimitError(err)).toBe(true);
    expect(telegramRetryAfterMs(err)).toBe(23_000);
  });

  it('detects retry_after from error message', () => {
    const err = new Error('429: Too Many Requests: retry after 5');
    expect(telegramRetryAfterMs(err)).toBe(5000);
  });

  it('detects 429 without retry_after parameter', () => {
    const err = { response: { error_code: 429, parameters: {} } };
    expect(isTelegramRateLimitError(err)).toBe(true);
    expect(telegramRetryAfterMs(err)).toBeUndefined();
  });
});
