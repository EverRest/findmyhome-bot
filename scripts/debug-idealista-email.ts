/**
 * Debug Idealista alert email parsing.
 * npm run debug:idealista
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { google } from 'googleapis';
import * as cheerio from 'cheerio';
import { GenericLinkParser } from '../src/email-ingestion/infrastructure/parsers/generic-link.parser';
import { IdealistaAlertParser } from '../src/email-ingestion/infrastructure/parsers/idealista-alert.parser';
import { isListingPageUrl } from '../src/email-ingestion/infrastructure/parsers/listing-url.utils';
import {
  isSaleAlertEmail,
  shouldPersistListingDraft,
} from '../src/email-ingestion/infrastructure/parsers/rental-listing.utils';

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

async function fetchIdealistaEmail() {
  const tokens = JSON.parse(
    readFileSync(resolve('secrets/gmail-token.json'), 'utf8'),
  ) as { refresh_token: string };
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({ refresh_token: tokens.refresh_token });
  const gmail = google.gmail({ version: 'v1', auth });

  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:idealista.it newer_than:7d',
    maxResults: 3,
  });

  const idealistaParser = new IdealistaAlertParser();
  const genericParser = new GenericLinkParser();

  for (const m of list.data.messages ?? []) {
    if (!m.id) continue;
    const full = await gmail.users.messages.get({
      userId: 'me',
      id: m.id,
      format: 'full',
    });
    const headers = full.data.payload?.headers ?? [];
    const subject =
      headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? '';
    const from =
      headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? '';

    let html = '';
    const walk = (p: typeof full.data.payload): void => {
      if (!p) return;
      if (p.mimeType === 'text/html' && p.body?.data) {
        html += Buffer.from(p.body.data, 'base64url').toString('utf8');
      }
      if (p.parts) for (const c of p.parts) walk(c);
    };
    walk(full.data.payload);

    console.log('\n==========');
    console.log('Subject:', subject);
    console.log('From:', from);
    console.log('Message ID:', m.id);

    const $ = cheerio.load(html);
    const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(
      (x) => x[1],
    );
    const idealistaHrefs = hrefs.filter((h) => /idealista/i.test(h));
    console.log('\nIdealista hrefs:', idealistaHrefs.length);
    const hosts = new Map<string, number>();
    for (const h of idealistaHrefs) {
      try {
        const host = new URL(h).hostname;
        hosts.set(host, (hosts.get(host) ?? 0) + 1);
      } catch {
        /* */
      }
    }
    console.log('Hosts:', Object.fromEntries(hosts));

    const listingLike = idealistaHrefs.filter((h) => isListingPageUrl(h));
    console.log('Pass isListingPageUrl:', listingLike.length);
    listingLike.slice(0, 5).forEach((u) => console.log('  ', u.slice(0, 100)));

    const email = {
      gmailMessageId: m.id,
      subject,
      fromAddress: from,
      receivedAt: new Date(),
      htmlBody: html,
      textBody: '',
    };
    console.log('\nSale alert (skip DB):', isSaleAlertEmail(email));
    const drafts = idealistaParser.parse(email);
    console.log('\nIdealistaAlertParser drafts:', drafts.length);
    for (const d of drafts.slice(0, 5)) {
      console.log('---');
      console.log('title:', d.title?.slice(0, 80));
      console.log('rent:', d.rentEur, 'sqm:', d.areaSqm, 'rooms:', d.rooms);
      console.log('url:', d.canonicalUrl);
      console.log('listingUrl:', d.listingUrl);
      console.log('snippet:', d.rawSnippet?.slice(0, 120));
      console.log('→ persist to DB:', shouldPersistListingDraft(d, email));
    }

    const genericDrafts = genericParser.parse(email);
    console.log('\nGenericLinkParser drafts:', genericDrafts.length);

    // Sample anchor texts with idealista in href
    console.log('\nSample anchors (idealista href):');
    let n = 0;
    $('a[href*="idealista"]').each((_, el) => {
      if (n >= 8) return;
      const t = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 80);
      const h = $(el).attr('href')?.slice(0, 70);
      if (!t && !h?.includes('inmueble') && !h?.includes('affitto')) return;
      console.log(`  [${n++}]`, t || '(empty)', '|', h);
    });
  }
}

fetchIdealistaEmail().catch(console.error);
