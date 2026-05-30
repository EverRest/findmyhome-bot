import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import type { FacebookGroupsPort } from '../domain/facebook-groups.port';
import type { IncomingFacebookPost } from '../domain/incoming-facebook-post';
import {
  extractPostsFromFeedHtml,
  toIncomingPost,
} from './extract-facebook-feed';
import { getChromium } from './playwright-client';

@Injectable()
export class PlaywrightFacebookGroupsAdapter implements FacebookGroupsPort {
  private readonly log;

  constructor(
    private readonly config: ConfigService,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(PlaywrightFacebookGroupsAdapter.name);
  }

  isConfigured(): boolean {
    if (this.config.get<string>('FACEBOOK_INGESTION_ENABLED') !== 'true') {
      return false;
    }
    const ids = this.parseGroupIds();
    if (ids.length === 0) return false;
    return existsSync(this.storagePath());
  }

  async fetchRecentPosts(
    groupIds: string[],
    since: Date,
  ): Promise<IncomingFacebookPost[]> {
    if (!this.isConfigured()) {
      this.log.warn('facebook', 'Not configured — skip fetch');
      return [];
    }

    const chromium = await getChromium();
    const delayMs = Number(this.config.get('FACEBOOK_GROUP_DELAY_MS') ?? 3000);
    const maxScrolls = Number(this.config.get('FACEBOOK_MAX_SCROLLS') ?? 4);
    const results: IncomingFacebookPost[] = [];
    const seenPostIds = new Set<string>();

    const browser = await chromium.launch({
      headless: this.config.get('FACEBOOK_HEADLESS') !== 'false',
    });

    try {
      const context = await browser.newContext({
        storageState: this.storagePath(),
        locale: 'it-IT',
      });
      const page = await context.newPage();

      for (const groupId of groupIds) {
        const url = `https://www.facebook.com/groups/${groupId}`;
        this.log.info('facebook', 'Loading group feed', { groupId, url });

        try {
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60_000,
          });
          await page.waitForTimeout(2000);

          for (let i = 0; i < maxScrolls; i++) {
            await page.evaluate(() => window.scrollBy(0, window.innerHeight));
            await page.waitForTimeout(1500);
          }

          const html = await page.content();
          const raw = extractPostsFromFeedHtml(html, groupId);
          const postedAt = new Date();

          for (const item of raw) {
            if (seenPostIds.has(item.postId)) continue;
            seenPostIds.add(item.postId);
            if (postedAt < since && item.message.length === 0) continue;
            results.push(toIncomingPost(item, groupId, postedAt));
          }

          this.log.info('facebook', 'Group feed parsed', {
            groupId,
            posts: raw.length,
          });
        } catch (err) {
          this.log.error('facebook', 'Group fetch failed', err, { groupId });
        }

        await page.waitForTimeout(delayMs);
      }

      await context.close();
    } finally {
      await browser.close();
    }

    return results;
  }

  private storagePath(): string {
    const p =
      this.config.get<string>('FACEBOOK_STORAGE_STATE_PATH') ??
      './secrets/facebook-storage.json';
    return resolve(process.cwd(), p);
  }

  private parseGroupIds(): string[] {
    const raw = this.config.get<string>('FACEBOOK_GROUP_IDS') ?? '';
    return raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s));
  }
}
