export interface IncomingEmail {
  gmailMessageId: string;
  subject: string;
  fromAddress: string;
  receivedAt: Date;
  htmlBody: string;
  textBody: string;
}
