export type TelegramSendJob =
  | { kind: 'text'; text: string }
  | { kind: 'listing-card'; listingId: string };

export const TELEGRAM_SEND_QUEUE_NAME = 'telegram-send';
