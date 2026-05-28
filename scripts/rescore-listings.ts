/**
 * Re-score all listings (after parser/scoring fixes). Deletes old scores.
 * Run: npm run db:rescore
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.listingScore.deleteMany({});
  await prisma.listing.updateMany({
    data: { telegramSentAt: null, telegramMessageId: null },
  });
  console.log('Deleted scores:', deleted.count);
  console.log('Cleared telegramSentAt on all listings');
  console.log(
    'Next: POST /pipeline/run (will re-score; set emails processed if needed)',
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
