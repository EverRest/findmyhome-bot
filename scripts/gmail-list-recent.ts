/**
 * List recent Gmail alerts (casa / idealista / immobiliare).
 * npm run gmail:list
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { google } from 'googleapis';

const tokens = JSON.parse(
  readFileSync(resolve('secrets/gmail-token.json'), 'utf8'),
) as { refresh_token: string };

const auth = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
);
auth.setCredentials({ refresh_token: tokens.refresh_token });
const gmail = google.gmail({ version: 'v1', auth });

async function listMessages(query: string): Promise<void> {
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 15,
  });
  console.log(`\n=== ${query} (${list.data.messages?.length ?? 0}) ===`);
  for (const m of list.data.messages ?? []) {
    if (!m.id) continue;
    const full = await gmail.users.messages.get({
      userId: 'me',
      id: m.id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    });
    const headers = full.data.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
        ?.value ?? '';
    console.log(
      `${get('Date').slice(0, 22)} | ${get('From').slice(0, 42)} | ${get('Subject').slice(0, 52)}`,
    );
  }
}

async function main(): Promise<void> {
  await listMessages('from:casa.it newer_than:14d');
  await listMessages('from:idealista.it newer_than:3d');
  await listMessages('from:immobiliare.it newer_than:3d');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
