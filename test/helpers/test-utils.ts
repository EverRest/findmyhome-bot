import { resolve } from 'path';
import type { ConfigService } from '@nestjs/config';
import type { SearchCriteria } from '../../src/shared/infrastructure/criteria.types';
import { readFileSync } from 'fs';
import yaml from 'js-yaml';

export const CRITERIA_TEST_PATH = resolve(
  __dirname,
  '../fixtures/criteria-test.yaml',
);

export function loadTestCriteria(): SearchCriteria {
  return yaml.load(readFileSync(CRITERIA_TEST_PATH, 'utf8')) as SearchCriteria;
}

export function mockConfig(
  values: Record<string, string | number | boolean | undefined> = {},
): ConfigService {
  const defaults: Record<string, string> = {
    LOG_LEVEL: 'debug',
    CRITERIA_PATH: CRITERIA_TEST_PATH,
    GMAIL_QUERY: 'newer_than:1d',
    PIPELINE_DRY_RUN: 'true',
    PIPELINE_API_KEY: 'test-key',
    TOP_N: '10',
    MIN_DIGEST_SCORE: '25',
    MIN_DIGEST_RENT_EUR: '200',
    OLLAMA_SCORING_ENABLED: 'false',
    OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
    OLLAMA_MODEL: 'test-model',
    TELEGRAM_CHAT_IDS: '-100123',
    TELEGRAM_BOT_TOKEN: 'token',
    GMAIL_CLIENT_ID: 'cid',
    GMAIL_CLIENT_SECRET: 'secret',
    GMAIL_REFRESH_TOKEN: 'refresh',
    PIPELINE_CRON_ENABLED: 'false',
    SCORE_CACHE_DAYS: '7',
    BULLMQ_ENABLED: 'false',
    REDIS_URL: 'redis://127.0.0.1:6379',
  };
  const merged = { ...defaults, ...values };
  return {
    get: jest.fn((key: string) => merged[key]),
  } as unknown as ConfigService;
}

export function mockStepLogger() {
  const ctx = {
    step: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    timed: jest.fn((_s, _l, fn: () => Promise<unknown>) => fn()),
  };
  return {
    create: jest.fn(() => ctx),
    isDebug: jest.fn(() => true),
    _ctx: ctx,
  };
}

export function mockCriteriaLoader(criteria?: SearchCriteria) {
  const c = criteria ?? loadTestCriteria();
  return {
    get: jest.fn(() => c),
    onModuleInit: jest.fn(),
  };
}
