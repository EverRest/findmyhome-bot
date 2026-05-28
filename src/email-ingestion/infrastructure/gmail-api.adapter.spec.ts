import { existsSync, readFileSync } from 'fs';
import { GmailApiAdapter } from './gmail-api.adapter';
import { mockConfig, mockStepLogger } from '../../../test/helpers/test-utils';

const messagesGet = jest.fn();
const messagesList = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      })),
    },
    gmail: jest.fn(() => ({
      users: {
        messages: {
          list: messagesList,
          get: messagesGet,
        },
      },
    })),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('GmailApiAdapter', () => {
  const log = mockStepLogger();

  beforeEach(() => {
    jest.clearAllMocks();
    (existsSync as jest.Mock).mockReturnValue(true);
    (readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({ refresh_token: 'rt' }),
    );
  });

  it('isConfigured when token present', () => {
    const adapter = new GmailApiAdapter(
      mockConfig({
        GMAIL_CLIENT_ID: 'id',
        GMAIL_REFRESH_TOKEN: 'rt',
      }),
      log as never,
    );
    expect(adapter.isConfigured()).toBe(true);
  });

  it('returns empty when not configured', async () => {
    const adapter = new GmailApiAdapter(
      mockConfig({
        GMAIL_CLIENT_ID: undefined,
        GMAIL_REFRESH_TOKEN: undefined,
      }),
      log as never,
    );
    expect(await adapter.fetchSince(new Date(), 'q')).toEqual([]);
  });

  it('fetches and decodes messages', async () => {
    messagesList.mockResolvedValue({
      data: { messages: [{ id: 'm1' }], resultSizeEstimate: 1 },
    });
    const html = Buffer.from('<b>x</b>').toString('base64url');
    messagesGet.mockResolvedValue({
      data: {
        payload: {
          headers: [
            { name: 'Subject', value: 'Test' },
            { name: 'From', value: 'a@b.it' },
            { name: 'Date', value: 'Mon, 01 Jan 2024 00:00:00 +0000' },
          ],
          mimeType: 'text/html',
          body: { data: html },
        },
      },
    });

    const adapter = new GmailApiAdapter(
      mockConfig({
        GMAIL_CLIENT_ID: 'id',
        GMAIL_CLIENT_SECRET: 'sec',
        GMAIL_REFRESH_TOKEN: 'rt',
      }),
      log as never,
    );
    const emails = await adapter.fetchSince(
      new Date('2020-01-01'),
      'newer_than:1d',
    );
    expect(emails).toHaveLength(1);
    expect(emails[0].htmlBody).toContain('x');
  });

  it('getGmailDiagnostics', () => {
    const adapter = new GmailApiAdapter(
      mockConfig({
        GMAIL_CLIENT_ID: 'id',
        GMAIL_CLIENT_SECRET: 'sec',
        GMAIL_REFRESH_TOKEN: 'rt',
      }),
      log as never,
    );
    const d = adapter.getGmailDiagnostics();
    expect(d.hasRefreshToken).toBe(true);
    expect(d.tokenFileExists).toBe(true);
  });

  it('reads refresh token from env when file has none', async () => {
    (readFileSync as jest.Mock).mockReturnValue(JSON.stringify({}));
    const adapter = new GmailApiAdapter(
      mockConfig({
        GMAIL_CLIENT_ID: 'id',
        GMAIL_REFRESH_TOKEN: ' env-token ',
      }),
      log as never,
    );
    expect(adapter.getGmailDiagnostics().hasRefreshToken).toBe(true);
  });

  it('uses env refresh when token file missing', async () => {
    (existsSync as jest.Mock).mockReturnValue(false);
    const adapter = new GmailApiAdapter(
      mockConfig({
        GMAIL_CLIENT_ID: 'id',
        GMAIL_REFRESH_TOKEN: 'rt-env',
      }),
      log as never,
    );
    expect(adapter.isConfigured()).toBe(true);
  });

  it('uses current date when Date header missing', async () => {
    messagesList.mockResolvedValue({
      data: { messages: [{ id: 'm4' }] },
    });
    messagesGet.mockResolvedValue({
      data: {
        payload: {
          headers: [{ name: 'Subject', value: 'No date' }],
          mimeType: 'text/plain',
          body: { data: Buffer.from('hi').toString('base64url') },
        },
      },
    });
    const adapter = new GmailApiAdapter(
      mockConfig({
        GMAIL_CLIENT_ID: 'id',
        GMAIL_REFRESH_TOKEN: 'rt',
      }),
      log as never,
    );
    const emails = await adapter.fetchSince(new Date(), 'q');
    expect(emails[0].receivedAt).toBeInstanceOf(Date);
  });

  it('decodes multipart and skips messages without id', async () => {
    messagesList.mockResolvedValue({
      data: { messages: [{ id: 'm3' }, {}] },
    });
    const plain = Buffer.from('plain text').toString('base64url');
    const htmlPart = Buffer.from('<p>h</p>').toString('base64url');
    messagesGet.mockResolvedValue({
      data: {
        payload: {
          headers: [{ name: 'Subject', value: 'Multi' }],
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: plain } },
            { mimeType: 'text/html', body: { data: htmlPart } },
          ],
        },
      },
    });
    const adapter = new GmailApiAdapter(
      mockConfig({
        GMAIL_CLIENT_ID: 'id',
        GMAIL_REFRESH_TOKEN: 'rt',
      }),
      log as never,
    );
    const emails = await adapter.fetchSince(new Date(), 'q');
    expect(emails[0].textBody).toContain('plain');
    expect(emails[0].htmlBody).toContain('h');
  });

  it('skips message without payload', async () => {
    messagesList.mockResolvedValue({
      data: { messages: [{ id: 'm2' }] },
    });
    messagesGet.mockResolvedValue({ data: {} });
    const adapter = new GmailApiAdapter(
      mockConfig({
        GMAIL_CLIENT_ID: 'id',
        GMAIL_REFRESH_TOKEN: 'rt',
      }),
      log as never,
    );
    expect(await adapter.fetchSince(new Date(), 'q')).toEqual([]);
  });
});
