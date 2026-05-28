/**
 * One-off: dump URLs from last Immobiliare alert email (for parser debugging).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { google } from 'googleapis';

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const tokenPath = resolve('secrets/gmail-token.json');

async function main() {
  const tokens = JSON.parse(readFileSync(tokenPath, 'utf8')) as {
    refresh_token: string;
  };
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({ refresh_token: tokens.refresh_token });
  const gmail = google.gmail({ version: 'v1', auth });

  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:notifiche.immobiliare.it newer_than:7d',
    maxResults: 1,
  });
  const id = list.data.messages?.[0]?.id;
  if (!id) {
    console.log('No Immobiliare email found');
    return;
  }

  const full = await gmail.users.messages.get({
    userId: 'me',
    id,
    format: 'full',
  });

  const headers = full.data.payload?.headers ?? [];
  const subject = headers.find(
    (h) => h.name?.toLowerCase() === 'subject',
  )?.value;
  console.log('Subject:', subject);

  const parts: { mimeType?: string | null; body?: { data?: string | null } }[] =
    [];
  const walk = (p: typeof full.data.payload): void => {
    if (!p) return;
    parts.push(p);
    if (p.parts) for (const c of p.parts) walk(c);
  };
  walk(full.data.payload);

  let html = '';
  for (const p of parts) {
    if (p.mimeType === 'text/html' && p.body?.data) {
      html += Buffer.from(p.body.data, 'base64url').toString('utf8');
    }
  }

  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const hosts = new Map<string, number>();
  for (const h of hrefs) {
    try {
      const host = new URL(h).hostname;
      hosts.set(host, (hosts.get(host) ?? 0) + 1);
    } catch {
      /* skip */
    }
  }
  console.log('\nHref hosts:', Object.fromEntries(hosts));

  const annunci = [
    ...html.matchAll(
      /https?:\/\/(?:www\.)?immobiliare\.it\/annunci\/\d+[^"'<\s]*/gi,
    ),
  ].map((m) => m[0]);
  console.log('\nannunci URLs in HTML (regex):', annunci.length);
  console.log(annunci.slice(0, 5));

  const clicks = hrefs.filter((h) => h.includes('clicks.immobiliare'));
  console.log('\nclicks.immobiliare hrefs:', clicks.length);

  // sample anchor texts for clicks links
  const $ = await import('cheerio').then((m) => m.load(html));
  const samples: string[] = [];
  $('a[href*="clicks.immobiliare"]').each((i, el) => {
    if (i >= 8) return;
    const t = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 80);
    samples.push(t || '(empty)');
  });
  console.log('\nSample click-link anchor texts:', samples);

  // listing-like blocks: links with € in parent
  let withPrice = 0;
  $('a[href]').each((_, el) => {
    const block = $(el).parent().text();
    if (/€/.test(block) && /locali|m²|mq/i.test(block)) withPrice++;
  });
  console.log('\nAnchors with € + locali/m² in parent:', withPrice);

  let n = 0;
  $('a[href*="clicks.immobiliare"]').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (
      !/room|locali|flat|appartamento|villetta|trilocale|bilocale/i.test(text)
    )
      return;
    if (text.length < 15) return;
    const row = $(el).closest('table').first();
    const block = row.text().replace(/\s+/g, ' ').trim().slice(0, 400);
    console.log('\n---', ++n);
    console.log('title:', text.slice(0, 100));
    console.log('block:', block.slice(0, 350));
    console.log('href:', $(el).attr('href')?.slice(0, 80));
  });
  console.log('\ntotal listing-like anchors:', n);
}

main().catch(console.error);
