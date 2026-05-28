import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import { LISTING_REPOSITORY } from '../../listing/domain/listing.repository.port';
import type {
  ListingForDigest,
  ListingRepositoryPort,
} from '../../listing/domain/listing.repository.port';
import { TELEGRAM_PORT } from '../domain/telegram.port';
import type { TelegramPort } from '../domain/telegram.port';
import { meetsHardCriteria } from '../../listing/domain/listing-hard-criteria';
import { computeListingFingerprint } from '../../listing/domain/listing-fingerprint';
import { CriteriaLoaderService } from '../../shared/infrastructure/criteria-loader.service';
import { formatListingCard } from './format-listing-card';
import { isMeaningfulListingTitle } from '../../email-ingestion/infrastructure/parsers/casa-alert.utils';
import { isTelegramRateLimitError } from '../infrastructure/telegram-api.utils';
import { TELEGRAM_QUEUE_PORT } from '../queue/telegram-queue.port';
import type { TelegramQueuePort } from '../queue/telegram-queue.port';
import type { TelegramSendJob } from '../queue/telegram-send-job';

@Injectable()
export class SendDigestUseCase {
  private readonly log;

  constructor(
    @Inject(LISTING_REPOSITORY)
    private readonly listings: ListingRepositoryPort,
    @Inject(TELEGRAM_PORT) private readonly telegram: TelegramPort,
    @Inject(TELEGRAM_QUEUE_PORT)
    private readonly telegramQueue: TelegramQueuePort,
    private readonly config: ConfigService,
    private readonly criteria: CriteriaLoaderService,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(SendDigestUseCase.name);
  }

  async execute(stats: {
    listingsNew: number;
    duplicatesSkipped: number;
  }): Promise<number> {
    if (!this.telegram.isConfigured()) {
      this.log.warn('telegram', 'Not configured — skip digest');
      return 0;
    }

    const dryRun = this.config.get<string>('PIPELINE_DRY_RUN') === 'true';
    const topN = Number(this.config.get('TOP_N') ?? 10);

    this.log.step('telegram', 'Digest start', { dryRun, topN, ...stats });

    const candidates = await this.listings.findTopForDigest(topN * 2);
    this.log.info('telegram', 'Candidates from DB', {
      count: candidates.length,
    });

    const toSend = [];
    const seenFingerprints = new Set<string>();
    let skippedAlreadySent = 0;

    const minScore = Number(this.config.get('MIN_DIGEST_SCORE') ?? 25);
    const minRent = Number(this.config.get('MIN_DIGEST_RENT_EUR') ?? 200);
    const searchCriteria = this.criteria.get();

    for (const item of candidates) {
      if (
        item.source === 'casa.it' &&
        (item.rentEur == null ||
          !isMeaningfulListingTitle(item.title) ||
          (item.areaSqm == null && !item.locationHint?.trim()))
      ) {
        skippedAlreadySent++;
        this.log.debug('telegram', 'Skip — incomplete Casa listing', {
          id: item.id,
          title: item.title,
          rentEur: item.rentEur,
          areaSqm: item.areaSqm,
        });
        continue;
      }
      if (!meetsHardCriteria(item, searchCriteria)) {
        skippedAlreadySent++;
        this.log.debug('telegram', 'Skip — hard criteria', {
          id: item.id,
          rooms: item.rooms,
          areaSqm: item.areaSqm,
          rentEur: item.rentEur,
        });
        continue;
      }
      if (item.score < minScore) {
        skippedAlreadySent++;
        continue;
      }
      if (item.rentEur != null && item.rentEur < minRent) {
        skippedAlreadySent++;
        continue;
      }
      const fingerprint =
        item.listingFingerprint ??
        computeListingFingerprint({
          title: item.title ?? undefined,
          locationHint: item.locationHint ?? undefined,
          rentEur: item.rentEur ?? undefined,
          rooms: item.rooms ?? undefined,
          areaSqm: item.areaSqm ?? undefined,
        });
      if (fingerprint && seenFingerprints.has(fingerprint)) {
        skippedAlreadySent++;
        this.log.debug('telegram', 'Skip — duplicate property (fingerprint)', {
          id: item.id,
          fingerprint,
        });
        continue;
      }

      if (await this.listings.shouldSendToTelegram(item.id)) {
        if (fingerprint) seenFingerprints.add(fingerprint);
        toSend.push(item);
        this.log.debug('telegram', 'Queued for send', {
          id: item.id,
          score: item.score,
          riskLevel: item.riskLevel,
          url: item.canonicalUrl,
        });
      } else {
        skippedAlreadySent++;
        this.log.debug('telegram', 'Skip — already sent / no changes', {
          id: item.id,
          url: item.canonicalUrl,
        });
      }
      if (toSend.length >= topN) break;
    }

    const suspicious = toSend.filter((i) => i.riskLevel === 'high');
    const normal = toSend.filter((i) => i.riskLevel !== 'high');
    const maxPerRun = Number(
      this.config.get('TELEGRAM_MAX_SEND_PER_RUN') ?? 10,
    );
    const delayMs = Number(this.config.get('TELEGRAM_SEND_DELAY_MS') ?? 2500);
    const normalBatch = normal.slice(0, maxPerRun);
    const suspiciousBudget = Math.max(0, maxPerRun - normalBatch.length);
    const suspiciousBatch = suspicious.slice(0, suspiciousBudget);
    const useQueue = this.telegramQueue.isEnabled();
    const deferred = useQueue
      ? 0
      : normal.length -
        normalBatch.length +
        (suspicious.length - suspiciousBatch.length);
    const sendNormal = useQueue ? normal : normalBatch;
    const sendSuspicious = useQueue ? suspicious : suspiciousBatch;

    this.log.info('telegram', 'Send queue built', {
      normal: normal.length,
      suspicious: suspicious.length,
      skippedAlreadySent,
      batchNormal: sendNormal.length,
      batchSuspicious: sendSuspicious.length,
      deferred,
      maxPerRun,
      delayMs,
      useQueue,
    });

    const queueNote = useQueue
      ? `\n📬 ${sendNormal.length + sendSuspicious.length} cards queued in BullMQ (staggered ${delayMs} ms)`
      : deferred > 0
        ? `\n⏳ ${deferred} more in queue — next pipeline run`
        : '';
    const header = `📅 ${new Date().toLocaleDateString('en-GB')}\nNew: ${stats.listingsNew} · email duplicates skipped: ${stats.duplicatesSkipped}\nTop ${sendNormal.length}${sendSuspicious.length ? ` + ${sendSuspicious.length} suspicious` : ''}${queueNote}`;

    if (dryRun) {
      this.log.step('telegram', '[DRY RUN] Would send header', {
        text: header.slice(0, 120),
      });
      for (const item of [...normal, ...suspicious]) {
        this.log.info('telegram', '[DRY RUN] Card', {
          score: item.score,
          preview: formatListingCard(item, this.cardFormatOptions()).slice(
            0,
            200,
          ),
        });
      }
      return toSend.length;
    }

    if (useQueue) {
      const jobs = this.buildSendJobs(header, sendNormal, sendSuspicious);
      const enqueued = await this.telegramQueue.enqueueJobs(jobs);
      const queueDepth = await this.telegramQueue.getQueueStats();
      this.log.step('telegram', 'Digest enqueued (BullMQ)', {
        enqueued,
        jobs: jobs.length,
        queue: queueDepth,
      });
      return enqueued;
    }

    let sent = 0;
    try {
      await this.telegram.sendText(header);
      this.log.info('telegram', 'Header sent');
    } catch (err) {
      if (isTelegramRateLimitError(err)) {
        this.log.warn(
          'telegram',
          'Header blocked by rate limit — deferring batch',
        );
        return 0;
      }
      throw err;
    }

    for (const item of normalBatch) {
      const ok = await this.sendOneCard(item, delayMs);
      if (!ok) break;
      sent++;
    }

    if (sent < maxPerRun && suspiciousBatch.length) {
      try {
        await this.telegram.sendText('🚨 Suspicious (review):');
        await this.sleep(delayMs);
      } catch (err) {
        if (isTelegramRateLimitError(err)) {
          this.log.warn('telegram', 'Stopped suspicious batch — rate limit');
          this.log.step('telegram', 'Digest finished (partial)', {
            sent,
            deferred,
          });
          return sent;
        }
        throw err;
      }
      for (const item of suspiciousBatch) {
        if (sent >= maxPerRun) break;
        const ok = await this.sendOneCard(item, delayMs);
        if (!ok) break;
        sent++;
      }
    }

    this.log.step('telegram', 'Digest finished', { sent, deferred });
    return sent;
  }

  private async sendOneCard(
    item: ListingForDigest,
    delayMs: number,
  ): Promise<boolean> {
    try {
      const text = formatListingCard(item, this.cardFormatOptions());
      const msgId = await this.telegram.sendText(text);
      await this.listings.markTelegramSent(item.id, msgId);
      this.log.info('telegram', 'Card sent', {
        listingId: item.id,
        messageId: msgId,
        score: item.score,
      });
      await this.sleep(delayMs);
      return true;
    } catch (err) {
      if (isTelegramRateLimitError(err)) {
        this.log.warn('telegram', 'Rate limit — stopping this batch', {
          listingId: item.id,
        });
        return false;
      }
      throw err;
    }
  }

  private buildSendJobs(
    header: string,
    normal: ListingForDigest[],
    suspicious: ListingForDigest[],
  ): TelegramSendJob[] {
    const jobs: TelegramSendJob[] = [{ kind: 'text', text: header }];
    for (const item of normal) {
      jobs.push({ kind: 'listing-card', listingId: item.id });
    }
    if (suspicious.length) {
      jobs.push({ kind: 'text', text: '🚨 Suspicious (review):' });
      for (const item of suspicious) {
        jobs.push({ kind: 'listing-card', listingId: item.id });
      }
    }
    return jobs;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private cardFormatOptions() {
    const name = this.criteria.get().scoring.referencePoint?.name;
    return name ? { referencePointName: name } : undefined;
  }
}
