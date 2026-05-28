/**
 * Remove junk clicks.* listings and re-queue Immobiliare emails for re-parse.
 * Run: npm run db:reset-immobiliare && npm run start:dev (then pipeline/run)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const deletedScores = await prisma.listingScore.deleteMany({
    where: {
      listing: { canonicalUrl: { contains: 'clicks.immobiliare.it' } },
    },
  });
  const deletedListings = await prisma.listing.deleteMany({
    where: { canonicalUrl: { contains: 'clicks.immobiliare.it' } },
  });
  const deletedEmails = await prisma.processedEmail.deleteMany({
    where: { fromAddress: { contains: 'immobiliare.it' } },
  });

  console.log('Deleted listing scores:', deletedScores.count);
  console.log('Deleted junk listings:', deletedListings.count);
  console.log('Deleted processed Immobiliare emails:', deletedEmails.count);
  console.log(
    '\nNext: POST /pipeline/run to re-fetch and parse with ImmobiliareAlertParser',
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
