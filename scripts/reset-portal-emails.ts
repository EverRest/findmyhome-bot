/**
 * Re-queue Idealista, Casa.it and Immobiliare alert emails for re-parse + optional TG resend.
 * Run: npm run db:reset-portals && curl -X POST http://localhost:3000/pipeline/run -H "x-api-key: change-me"
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PORTAL_FROM = [
  { fromAddress: { contains: 'idealista' } },
  { fromAddress: { contains: 'casa.it' } },
  { fromAddress: { contains: 'immobiliare.it' } },
];

async function main(): Promise<void> {
  const deletedEmails = await prisma.processedEmail.deleteMany({
    where: { OR: PORTAL_FROM },
  });

  const resetTelegram = await prisma.listing.updateMany({
    where: {
      OR: [
        { source: { contains: 'idealista' } },
        { source: { contains: 'casa.it' } },
        { canonicalUrl: { contains: 'immobiliare.it' } },
        { canonicalUrl: { contains: 'idealista.it' } },
        { canonicalUrl: { contains: 'casa.it' } },
      ],
    },
    data: {
      telegramSentAt: null,
      telegramMessageId: null,
      lat: null,
      lng: null,
      geocodeSource: null,
      geocodedAt: null,
      distanceToRefM: null,
      proximityScore: null,
    },
  });

  const deletedScores = await prisma.listingScore.deleteMany({
    where: {
      listing: {
        OR: [
          { source: { contains: 'idealista' } },
          { source: { contains: 'casa.it' } },
          { canonicalUrl: { contains: 'immobiliare.it' } },
        ],
      },
    },
  });

  console.log('Deleted processed portal emails:', deletedEmails.count);
  console.log('Reset telegramSentAt on listings:', resetTelegram.count);
  console.log(
    'Deleted scores (will re-score on pipeline):',
    deletedScores.count,
  );
  console.log('\nNext: POST /pipeline/run');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
