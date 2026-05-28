export const TELEGRAM_PORT = Symbol('TELEGRAM_PORT');

export interface TelegramPort {
  isConfigured(): boolean;
  sendText(text: string): Promise<string | undefined>;
}
