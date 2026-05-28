/**
 * Debug Casa.it alert parsing from latest Gmail message.
 * npx ts-node -r dotenv/config scripts/debug-casa-email.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { google } from 'googleapis';
import { GenericLinkParser } from '../src/email-ingestion/infrastructure/parsers/generic-link.parser';
import { ParserRegistry } from '../src/email-ingestion/infrastructure/parsers/parser.registry';
import { ImmobiliareAlertParser } from '../src/email-ingestion/infrastructure/parsers/immobiliare-alert.parser';
import { IdealistaAlertParser } from '../src/email-ingestion/infrastructure/parsers/idealista-alert.parser';
import {
  isSaleAlertEmail,
  shouldPersistListingDraft,
} from '../src/email-ingestion/infrastructure/parsers/rental-listing.utils';

const auth = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
);
auth.setCredentials({
  refresh_token: (
    JSON.parse(readFileSync(resolve('secrets/gmail-token.json'), 'utf8')) as {
      refresh_token: string;
    }
  ).refresh_token,
});
const gmail = google.gmail({ version: 'v1', auth });

function decodeBody(payload: {
  mimeType?: string | null;
  body?: { data?: string | null };
  parts?: Array<{
    mimeType?: string | null;
    body?: { data?: string | null };
    parts?: unknown[];
  }>;
}): { html: string; text: string } {
  let html = '';
  let text = '';
  const walk = (part: typeof payload): void => {
    if (part.mimeType === 'text/html' && part.body?.data) {
      html += Buffer.from(part.body.data, 'base64url').toString('utf8');
    }
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += Buffer.from(part.body.data, 'base64url').toString('utf8');
    }
    if (part.parts) {
      for (const p of part.parts) walk(p as typeof payload);
    }
  };
  walk(payload);
  return { html, text };
}

async function main(): Promise<void> {
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:casa.it newer_than:3d',
    maxResults: 1,
  });
  const id = list.data.messages?.[0]?.id;
  if (!id) {
    console.log('No casa.it emails found');
    return;
  }

  const full = await gmail.users.messages.get({
    userId: 'me',
    id,
    format: 'full',
  });
  const payload = full.data.payload;
  if (!payload) return;

  const headers = payload.headers ?? [];
  const subject =
    headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? '';
  const from =
    headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? '';
  const { html, text } = decodeBody(payload);

  const email = {
    gmailMessageId: id,
    subject,
    fromAddress: from,
    receivedAt: new Date(),
    htmlBody: html,
    textBody: text,
  };

  console.log('From:', from);
  console.log('Subject:', subject);
  console.log('HTML length:', html.length);
  console.log('Sale alert?', isSaleAlertEmail(email));

  const generic = new GenericLinkParser();
  const drafts = generic.parse(email);
  console.log('\nGenericLinkParser drafts:', drafts.length);
  for (const d of drafts) {
    console.log(
      ' -',
      d.canonicalUrl,
      '| rent:',
      d.rentEur,
      '|',
      d.title?.slice(0, 50),
    );
    console.log('   persist?', shouldPersistListingDraft(d, email));
  }

  const registry = new ParserRegistry(
    new ImmobiliareAlertParser(),
    new IdealistaAlertParser(),
    generic,
    {
      create: () => ({ debug: () => undefined, warn: () => undefined }),
    } as never,
  );
  const regDrafts = registry.parse(email);
  console.log('\nRegistry drafts:', regDrafts.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
