/**
 * One-time Gmail OAuth on host (not in Docker).
 * Saves refresh_token to ./secrets/gmail-token.json
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { google } from 'googleapis';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3333/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const url = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
});

console.log('Open in browser:\n', url);

const server = createServer((req, res) => {
  void handleOAuthCallback(req, res);
});

async function handleOAuthCallback(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!req.url?.startsWith('/oauth2callback')) {
    res.writeHead(404);
    res.end();
    return;
  }
  const code = new URL(req.url, REDIRECT_URI).searchParams.get('code');
  if (!code) {
    res.end('Missing code');
    return;
  }
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      'ERROR: Google did not return refresh_token. Revoke app access at https://myaccount.google.com/permissions and run again with prompt=consent.',
    );
    res.end('Missing refresh_token — see terminal');
    return;
  }
  mkdirSync(resolve('secrets'), { recursive: true });
  const out = resolve('secrets/gmail-token.json');
  writeFileSync(out, JSON.stringify(tokens, null, 2));
  res.end(
    'OK — token saved to secrets/gmail-token.json. You can close this tab.',
  );
  console.log('Saved', out, '(refresh_token present)');
  server.close();
  process.exit(0);
}

server.listen(3333, () => console.log('Listening on http://localhost:3333'));
