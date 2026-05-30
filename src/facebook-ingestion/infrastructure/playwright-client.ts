/** Lazy-load Playwright so Jest module specs do not pull in the browser binary. */
export async function getChromium() {
  const { chromium } = await import('playwright');
  return chromium;
}
