import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { google } from 'googleapis';
import { StepLoggerService } from '../../shared/infrastructure/step-logger.service';
import { IncomingEmail } from '../domain/incoming-email';
import { GmailPort } from '../domain/gmail.port';

@Injectable()
export class GmailApiAdapter implements GmailPort {
  private readonly log;

  constructor(
    private readonly config: ConfigService,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(GmailApiAdapter.name);
  }

  isConfigured(): boolean {
    const ok = Boolean(
      this.getRefreshToken() && this.config.get('GMAIL_CLIENT_ID'),
    );
    this.log.debug('gmail', 'isConfigured check', { ok });
    return ok;
  }

  async fetchSince(since: Date, query: string): Promise<IncomingEmail[]> {
    if (!this.isConfigured()) {
      this.log.warn('gmail', 'Not configured — empty result');
      return [];
    }

    const auth = new google.auth.OAuth2(
      this.config.get<string>('GMAIL_CLIENT_ID'),
      this.config.get<string>('GMAIL_CLIENT_SECRET'),
    );
    auth.setCredentials({ refresh_token: this.getRefreshToken() });

    const gmail = google.gmail({ version: 'v1', auth });
    const afterSec = Math.floor(since.getTime() / 1000);
    const fullQuery = `${query} after:${afterSec}`;

    this.log.debug('gmail', 'API list request', { fullQuery });

    const list = await gmail.users.messages.list({
      userId: 'me',
      q: fullQuery,
      maxResults: 50,
    });

    const messages = list.data.messages ?? [];
    this.log.info('gmail', 'API list response', {
      resultSizeEstimate: list.data.resultSizeEstimate,
      ids: messages.length,
    });

    const results: IncomingEmail[] = [];

    for (const m of messages) {
      if (!m.id) continue;
      this.log.debug('gmail', 'Fetching full message', { messageId: m.id });
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'full',
      });
      const payload = full.data.payload;
      if (!payload) {
        this.log.warn('gmail', 'Empty payload', { messageId: m.id });
        continue;
      }

      const { html, text } = this.extractBodies(payload);
      const headers = payload.headers ?? [];
      const subject =
        headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? '';
      const from =
        headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? '';
      const dateHeader = headers.find(
        (h) => h.name?.toLowerCase() === 'date',
      )?.value;

      this.log.debug('gmail', 'Message decoded', {
        messageId: m.id,
        subject: subject.slice(0, 60),
        htmlLen: html.length,
        textLen: text.length,
      });

      results.push({
        gmailMessageId: m.id,
        subject,
        fromAddress: from,
        receivedAt: dateHeader ? new Date(dateHeader) : new Date(),
        htmlBody: html,
        textBody: text,
      });
    }

    return results;
  }

  private getRefreshToken(): string | undefined {
    const configuredPath =
      this.config.get<string>('GMAIL_TOKEN_PATH') ??
      './secrets/gmail-token.json';
    const file = resolve(process.cwd(), configuredPath);
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf8')) as {
        refresh_token?: string;
      };
      if (data.refresh_token) return data.refresh_token;
    }
    const envToken = this.config.get<string>('GMAIL_REFRESH_TOKEN');
    return envToken?.trim() || undefined;
  }

  /** Diagnostics for /pipeline/status (no secrets). */
  getGmailDiagnostics(): {
    hasClientId: boolean;
    hasClientSecret: boolean;
    tokenFile: string;
    tokenFileExists: boolean;
    hasRefreshToken: boolean;
    cwd: string;
  } {
    const configuredPath =
      this.config.get<string>('GMAIL_TOKEN_PATH') ??
      './secrets/gmail-token.json';
    const file = resolve(process.cwd(), configuredPath);
    const fileExists = existsSync(file);
    let hasRefresh = false;
    if (fileExists) {
      const data = JSON.parse(readFileSync(file, 'utf8')) as {
        refresh_token?: string;
      };
      hasRefresh = Boolean(data.refresh_token);
    }
    if (!hasRefresh) {
      hasRefresh = Boolean(
        this.config.get<string>('GMAIL_REFRESH_TOKEN')?.trim(),
      );
    }
    return {
      hasClientId: Boolean(this.config.get('GMAIL_CLIENT_ID')),
      hasClientSecret: Boolean(this.config.get('GMAIL_CLIENT_SECRET')),
      tokenFile: file,
      tokenFileExists: fileExists,
      hasRefreshToken: hasRefresh,
      cwd: process.cwd(),
    };
  }

  private extractBodies(payload: {
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
        for (const p of part.parts) {
          walk(p as typeof payload);
        }
      }
    };

    walk(payload);
    return { html, text };
  }
}
