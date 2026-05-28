import type { ConfigService } from '@nestjs/config';

export function isBullmqEnabled(config: ConfigService): boolean {
  return config.get<string>('BULLMQ_ENABLED') === 'true';
}
