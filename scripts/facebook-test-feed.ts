/**
 * Dry-run Facebook parser + optional live Playwright feed fetch.
 *
 * Usage:
 *   npm run facebook:test-feed
 *   npm run facebook:test-feed -- --live
 *   npm run facebook:test-feed -- --live --group 946456072043414
 */
import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parseFacebookGroupIds } from '../src/facebook-ingestion/domain/parse-facebook-group-ids';
import { extractPostsFromFeedHtml } from '../src/facebook-ingestion/infrastructure/extract-facebook-feed';
import { FacebookRentalPostParser } from '../src/facebook-ingestion/infrastructure/facebook-rental-post.parser';
import {
  isStudentHousingPost,
  looksLikeRentalPost,
  shouldPersistFacebookListing,
} from '../src/facebook-ingestion/infrastructure/facebook-rental-post.utils';
import type { IncomingFacebookPost } from '../src/facebook-ingestion/domain/incoming-facebook-post';

function loadCriteriaRentMax(): number | null {
  const path =
    process.env.CRITERIA_PATH ?? resolve(process.cwd(), 'config/criteria.yaml');
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  const m = raw.match(/rent:\s*\n\s*-\s*(\d+)\s*\n\s*-\s*(\d+)/);
  if (!m) return null;
  return Number(m[2]);
}

function printConfig(): void {
  const enabled = process.env.FACEBOOK_INGESTION_ENABLED === 'true';
  const storage =
    process.env.FACEBOOK_STORAGE_STATE_PATH ??
    './secrets/facebook-storage.json';
  const storagePath = resolve(process.cwd(), storage);
  const storageExists = existsSync(storagePath);
  const groupIds = parseFacebookGroupIds(process.env.FACEBOOK_GROUP_IDS ?? '');
  const lookback = Number(process.env.FACEBOOK_LOOKBACK_HOURS ?? 24);

  console.log('\n=== Facebook config ===');
  console.log('FACEBOOK_INGESTION_ENABLED:', enabled);
  console.log('Session file:', storagePath, storageExists ? '✓' : '✗ MISSING');
  console.log('Lookback hours:', lookback);
  console.log('Parsed group IDs:', groupIds.length);
  for (const id of groupIds) console.log('  -', id);

  if (enabled && !storageExists) {
    console.log(
      '\n⚠️  Run once: npm run facebook:login  (then retry with --live)',
    );
  }
  if (enabled && groupIds.length === 0) {
    console.log('\n⚠️  FACEBOOK_GROUP_IDS has no valid ids/slugs');
  }
}

function runFixtureDryRun(): void {
  const parser = new FacebookRentalPostParser();
  const rentMax = loadCriteriaRentMax();
  const fixtures = [
    {
      name: 'rental+idealista',
      file: 'facebook-post-rental.txt',
    },
    {
      name: 'student-only',
      file: 'facebook-post-student.txt',
    },
  ];

  console.log('\n=== Fixture dry-run ===');
  for (const { name, file } of fixtures) {
    const message = readFileSync(
      resolve(__dirname, '../test/fixtures', file),
      'utf8',
    );
    const post: IncomingFacebookPost = {
      postId: `fixture-${name}`,
      groupId: '999',
      permalink: 'https://www.facebook.com/groups/999/posts/fixture/',
      message,
      postedAt: new Date(),
    };

    const student = isStudentHousingPost(message);
    const rental = looksLikeRentalPost(message);
    const drafts = parser.parse(post);
    const kept = drafts.filter((d) => shouldPersistFacebookListing(d, message));

    console.log(`\n--- ${name} (${file}) ---`);
    console.log('student filter:', student ? 'SKIP' : 'ok');
    console.log('looksLikeRental:', rental);
    console.log('drafts parsed:', drafts.length);
    for (const d of drafts) {
      console.log('  draft:', {
        title: d.title?.slice(0, 60),
        rentEur: d.rentEur,
        rooms: d.rooms,
        areaSqm: d.areaSqm,
        url: d.canonicalUrl,
      });
    }
    console.log('would persist:', kept.length);
    if (
      rentMax != null &&
      kept[0]?.rentEur != null &&
      kept[0].rentEur > rentMax
    ) {
      console.log(`  (rent ${kept[0].rentEur} > criteria max ${rentMax})`);
    }
  }

  const sampleHtml = `
    <div role="article">
      <a href="/groups/999/posts/555/?comment_id=1">link</a>
      <div>Affitto bilocale Cenisia Torino 750 euro https://www.idealista.it/immobile/1/</div>
    </div>`;
  const extracted = extractPostsFromFeedHtml(sampleHtml, '999');
  console.log('\n--- HTML extract sample ---');
  console.log(
    'posts:',
    extracted.length,
    extracted[0]?.postId,
    extracted[0]?.message.slice(0, 80),
  );
}

async function runLiveFetch(groupFilter?: string): Promise<void> {
  const storage =
    process.env.FACEBOOK_STORAGE_STATE_PATH ??
    './secrets/facebook-storage.json';
  const storagePath = resolve(process.cwd(), storage);
  if (!existsSync(storagePath)) {
    console.error('\nLive fetch aborted: session file missing.');
    process.exit(1);
  }

  let groupIds = parseFacebookGroupIds(process.env.FACEBOOK_GROUP_IDS ?? '');
  if (groupFilter) {
    groupIds = groupIds.filter((id) => id === groupFilter);
    if (groupIds.length === 0) groupIds = [groupFilter];
  }
  if (groupIds.length === 0) {
    console.error('\nNo group ids to fetch.');
    process.exit(1);
  }

  const lookbackHours = Number(process.env.FACEBOOK_LOOKBACK_HOURS ?? 24);
  const since = new Date(Date.now() - lookbackHours * 3600 * 1000);
  const maxGroups = Number(process.env.FACEBOOK_TEST_MAX_GROUPS ?? 2);
  const targets = groupIds.slice(0, maxGroups);

  const { chromium } = await import('playwright');
  const headless = process.env.FACEBOOK_HEADLESS !== 'false';
  const maxScrolls = Number(process.env.FACEBOOK_MAX_SCROLLS ?? 4);
  const parser = new FacebookRentalPostParser();

  console.log('\n=== Live feed fetch ===');
  console.log('Groups:', targets.join(', '));
  console.log('Since:', since.toISOString(), 'headless:', headless);

  const browser = await chromium.launch({ headless });
  try {
    const context = await browser.newContext({
      storageState: storagePath,
      locale: 'it-IT',
    });
    const page = await context.newPage();

    for (const groupId of targets) {
      const url = `https://www.facebook.com/groups/${groupId}`;
      console.log(`\n>>> ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(2000);
      for (let i = 0; i < maxScrolls; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(1500);
      }
      const html = await page.content();
      const raw = extractPostsFromFeedHtml(html, groupId);
      console.log('Extracted posts:', raw.length);

      let shown = 0;
      for (const item of raw) {
        if (shown >= 5) break;
        const post: IncomingFacebookPost = {
          postId: item.postId,
          groupId,
          permalink: item.permalink,
          message: item.message,
          postedAt: new Date(),
        };
        if (isStudentHousingPost(post.message)) {
          console.log(`  [${item.postId}] SKIP student`);
          shown++;
          continue;
        }
        const drafts = parser
          .parse(post)
          .filter((d) => shouldPersistFacebookListing(d, post.message));
        const preview = post.message.replace(/\s+/g, ' ').trim().slice(0, 120);
        console.log(
          `  [${item.postId}] drafts=${drafts.length} | ${preview || '(no text)'}`,
        );
        if (drafts[0]) {
          console.log('    →', drafts[0].rentEur, '€', drafts[0].canonicalUrl);
        }
        shown++;
      }
      await page.waitForTimeout(2000);
    }
    await context.close();
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const groupIdx = args.indexOf('--group');
  const group =
    groupIdx >= 0 && args[groupIdx + 1] ? args[groupIdx + 1] : undefined;

  printConfig();
  runFixtureDryRun();

  if (live) {
    await runLiveFetch(group);
  } else {
    console.log('\nTip: npm run facebook:test-feed -- --live --group <id>');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
