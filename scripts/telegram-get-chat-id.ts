/**
 * Run while app is NOT needed. Send any message to your group, then run:
 * TELEGRAM_BOT_TOKEN=xxx npx ts-node scripts/telegram-get-chat-id.ts
 */
import { Telegraf } from 'telegraf';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const bot = new Telegraf(token);

bot.on('message', (ctx) => {
  const chat = ctx.chat;
  console.log({
    chatId: chat.id,
    type: chat.type,
    title: 'title' in chat ? chat.title : undefined,
  });
  console.log('\nAdd to .env:\nTELEGRAM_CHAT_IDS=' + chat.id);
  process.exit(0);
});

console.log('Write something in the Telegram group, then check output…');
void bot.launch();
