import type { ListingRepositoryPort } from '../../listing/domain/listing.repository.port';
import type { TelegramPort } from '../domain/telegram.port';
import { formatListingCard } from '../application/format-listing-card';
import type { TelegramSendJob } from './telegram-send-job';

export async function processTelegramSendJob(
  job: TelegramSendJob,
  telegram: TelegramPort,
  listings: ListingRepositoryPort,
): Promise<void> {
  if (job.kind === 'text') {
    await telegram.sendText(job.text);
    return;
  }

  if (!(await listings.shouldSendToTelegram(job.listingId))) {
    return;
  }

  const item = await listings.findByIdForDigest(job.listingId);
  if (!item) {
    return;
  }

  const text = formatListingCard(item);
  const msgId = await telegram.sendText(text);
  await listings.markTelegramSent(item.id, msgId);
}
