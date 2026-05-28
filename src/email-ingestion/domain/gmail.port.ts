import { IncomingEmail } from './incoming-email';

export const GMAIL_PORT = Symbol('GMAIL_PORT');

export interface GmailDiagnostics {
  hasClientId: boolean;
  hasClientSecret: boolean;
  tokenFile: string;
  tokenFileExists: boolean;
  hasRefreshToken: boolean;
  cwd: string;
}

export interface GmailPort {
  fetchSince(since: Date, query: string): Promise<IncomingEmail[]>;
  isConfigured(): boolean;
  getGmailDiagnostics?(): GmailDiagnostics;
}
