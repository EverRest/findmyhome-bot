/** Telegram Bot API 429 / grammY-style errors. */
export function isTelegramRateLimitError(err: unknown): boolean {
  const e = err as { response?: { error_code?: number } };
  if (e.response?.error_code === 429) {
    return true;
  }
  return telegramRetryAfterMs(err) != null;
}

/** Milliseconds to wait before retry; undefined if not a rate-limit error. */
export function telegramRetryAfterMs(err: unknown): number | undefined {
  const e = err as {
    response?: { error_code?: number; parameters?: { retry_after?: number } };
    message?: string;
  };
  if (e.response?.error_code === 429) {
    const sec = e.response.parameters?.retry_after;
    if (typeof sec === 'number' && sec > 0) {
      return sec * 1000;
    }
  }
  const msg = String(e.message ?? err);
  const m = msg.match(/retry after (\d+)/i);
  if (m) {
    return parseInt(m[1], 10) * 1000;
  }
  return undefined;
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
