/**
 * One-time Facebook login — saves cookies for Playwright ingestion.
 * Usage: npm run facebook:login
 */
import 'dotenv/config';
import { resolve } from 'path';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

async function main(): Promise<void> {
  const out =
    process.env.FACEBOOK_STORAGE_STATE_PATH ??
    './secrets/facebook-storage.json';
  const outPath = resolve(process.cwd(), out);
  mkdirSync(dirname(outPath), { recursive: true });

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ locale: 'it-IT' });
  const page = await context.newPage();

  console.log(
    'Log in to Facebook in the browser window, then press Enter here…',
  );
  await page.goto('https://www.facebook.com/');
  await new Promise<void>((resolveWait) => {
    process.stdin.once('data', () => resolveWait());
  });

  await context.storageState({ path: outPath });
  console.log(`Saved session to ${outPath}`);
  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
