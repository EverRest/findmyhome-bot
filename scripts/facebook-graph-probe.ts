/**
 * Quick check whether Meta Graph API returns group feed (usually fails for member-only).
 * Usage: FACEBOOK_ACCESS_TOKEN=... FACEBOOK_GROUP_IDS=123 npm run facebook:probe
 */
import 'dotenv/config';

async function main(): Promise<void> {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  const ids = (process.env.FACEBOOK_GROUP_IDS ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!token) {
    console.log('Set FACEBOOK_ACCESS_TOKEN to probe Graph API.');
    console.log(
      'For member-only groups, use Playwright: npm run facebook:login',
    );
    process.exit(0);
  }

  for (const id of ids) {
    const url = `https://graph.facebook.com/v21.0/${id}/feed?limit=3&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const body = await res.text();
    console.log(`\nGroup ${id}: HTTP ${res.status}`);
    console.log(body.slice(0, 500));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
