import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LogStep =
  | 'pipeline'
  | 'gmail'
  | 'facebook'
  | 'parse'
  | 'listing'
  | 'score'
  | 'ollama'
  | 'telegram'
  | 'config';

@Injectable()
export class StepLoggerService {
  constructor(private readonly config: ConfigService) {}

  create(context: string): ContextStepLogger {
    return new ContextStepLogger(context, this.isDebug());
  }

  isDebug(): boolean {
    const level = (this.config.get<string>('LOG_LEVEL') ?? 'log').toLowerCase();
    return level === 'debug' || level === 'verbose';
  }
}

export class ContextStepLogger {
  private readonly nest: Logger;

  constructor(
    private readonly context: string,
    private readonly debugEnabled: boolean,
  ) {
    this.nest = new Logger(context);
  }

  /** Major pipeline phase start/end */
  step(step: LogStep, message: string, data?: Record<string, unknown>): void {
    this.nest.log(this.format(step, message, data));
  }

  /** Informational detail (always shown) */
  info(step: LogStep, message: string, data?: Record<string, unknown>): void {
    this.nest.log(this.format(step, message, data));
  }

  /** Verbose debugging */
  debug(step: LogStep, message: string, data?: Record<string, unknown>): void {
    if (!this.debugEnabled) return;
    this.nest.debug(this.format(step, message, data));
  }

  warn(step: LogStep, message: string, data?: Record<string, unknown>): void {
    this.nest.warn(this.format(step, message, data));
  }

  error(
    step: LogStep,
    message: string,
    err?: unknown,
    data?: Record<string, unknown>,
  ): void {
    const extra = {
      ...data,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    };
    this.nest.error(this.format(step, message, extra));
  }

  /** Duration helper */
  async timed<T>(
    step: LogStep,
    label: string,
    fn: () => Promise<T>,
    data?: Record<string, unknown>,
  ): Promise<T> {
    const start = Date.now();
    this.step(step, `${label} — start`, data);
    try {
      const result = await fn();
      this.step(step, `${label} — done`, {
        ...data,
        ms: Date.now() - start,
      });
      return result;
    } catch (err) {
      this.error(step, `${label} — failed`, err, {
        ...data,
        ms: Date.now() - start,
      });
      throw err;
    }
  }

  private format(
    step: LogStep,
    message: string,
    data?: Record<string, unknown>,
  ): string {
    const payload =
      data && Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
    return `[${step}] ${message}${payload}`;
  }
}
