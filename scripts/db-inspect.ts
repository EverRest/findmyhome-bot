/**
 * Inspect SQLite DB: listings, scores, emails, pipeline runs.
 *
 * Usage:
 *   npm run db:inspect
 *   npm run db:inspect -- --json
 *   npm run db:inspect -- --listings
 *   npm run db:inspect -- --emails
 *   npm run db:inspect -- --runs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Section = 'summary' | 'listings' | 'emails' | 'runs';

function parseArgs(): { json: boolean; sections: Set<Section> } {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const sections = new Set<Section>();

  if (args.includes('--listings')) sections.add('listings');
  if (args.includes('--emails')) sections.add('emails');
  if (args.includes('--runs')) sections.add('runs');
  if (args.includes('--summary') || sections.size === 0) {
    sections.add('summary');
    if (
      !args.includes('--listings') &&
      !args.includes('--emails') &&
      !args.includes('--runs')
    ) {
      sections.add('listings');
      sections.add('emails');
      sections.add('runs');
    }
  }

  return { json, sections };
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function parseJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  const { json, sections } = parseArgs();
  const dbUrl = process.env.DATABASE_URL ?? '(not set)';

  const [listingCount, emailCount, runCount, scoreCount] = await Promise.all([
    prisma.listing.count(),
    prisma.processedEmail.count(),
    prisma.pipelineRun.count(),
    prisma.listingScore.count(),
  ]);

  const summary = {
    database: dbUrl,
    counts: {
      listings: listingCount,
      listingScores: scoreCount,
      processedEmails: emailCount,
      pipelineRuns: runCount,
    },
  };

  const listings = sections.has('listings')
    ? await prisma.listing.findMany({
        orderBy: { lastSeenAt: 'desc' },
        include: {
          scores: { orderBy: { scoredAt: 'desc' }, take: 1 },
        },
      })
    : [];

  const listingsOut = listings.map((l) => {
    const score = l.scores[0];
    return {
      id: l.id,
      url: l.listingUrl ?? l.canonicalUrl,
      canonicalUrl: l.canonicalUrl,
      listingUrl: l.listingUrl,
      source: l.source,
      title: l.title,
      locationHint: l.locationHint,
      addressRaw: l.addressRaw,
      rentEur: l.rentEur,
      condoFeeEur: l.condoFeeEur,
      totalCostEur: l.totalCostEur,
      areaSqm: l.areaSqm,
      rooms: l.rooms,
      floor: l.floor,
      hasLift: l.hasLift,
      firstSeenAt: l.firstSeenAt.toISOString(),
      lastSeenAt: l.lastSeenAt.toISOString(),
      priceChangedAt: l.priceChangedAt?.toISOString() ?? null,
      telegramSentAt: l.telegramSentAt?.toISOString() ?? null,
      dismissedAt: l.dismissedAt?.toISOString() ?? null,
      savedAt: l.savedAt?.toISOString() ?? null,
      rawSnippet: l.rawSnippet?.slice(0, 200) ?? null,
      latestScore: score
        ? {
            score: score.score,
            riskLevel: score.riskLevel,
            riskSource: score.riskSource,
            model: score.model,
            reasons: parseJsonArray(score.reasons),
            riskReasons: parseJsonArray(score.riskReasons),
            scoredAt: score.scoredAt.toISOString(),
          }
        : null,
    };
  });

  const emails = sections.has('emails')
    ? await prisma.processedEmail.findMany({
        orderBy: { receivedAt: 'desc' },
      })
    : [];

  const emailsOut = emails.map((e) => ({
    id: e.id,
    gmailMessageId: e.gmailMessageId,
    subject: e.subject,
    from: e.fromAddress,
    receivedAt: e.receivedAt.toISOString(),
    processedAt: e.processedAt.toISOString(),
    listingsFound: e.listingsFound,
  }));

  const runs = sections.has('runs')
    ? await prisma.pipelineRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 20,
      })
    : [];

  const runsOut = runs.map((r) => ({
    id: r.id,
    status: r.status,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    emailsProcessed: r.emailsProcessed,
    listingsParsed: r.listingsParsed,
    listingsNew: r.listingsNew,
    duplicatesSkipped: r.duplicatesSkipped,
    listingsScored: r.listingsScored,
    telegramSent: r.telegramSent,
    errorMessage: r.errorMessage,
  }));

  if (json) {
    console.log(
      JSON.stringify(
        { summary, listings: listingsOut, emails: emailsOut, runs: runsOut },
        null,
        2,
      ),
    );
    return;
  }

  console.log('\n=== FindMyHome DB ===');
  console.log(`Database: ${dbUrl}\n`);

  if (sections.has('summary')) {
    console.log('--- Summary ---');
    console.log(`  Listings:          ${listingCount}`);
    console.log(`  Listing scores:    ${scoreCount}`);
    console.log(`  Processed emails:  ${emailCount}`);
    console.log(`  Pipeline runs:     ${runCount}`);
    console.log('');
  }

  if (sections.has('listings')) {
    console.log(
      `--- Listings (${listingsOut.length}) — newest lastSeen first ---\n`,
    );
    if (listingsOut.length === 0) {
      console.log('  (empty)\n');
    } else {
      for (const l of listingsOut) {
        const sc = l.latestScore;
        console.log(`  ${l.url}`);
        console.log(
          `    ${l.title ?? '(no title)'} | ${l.rooms ?? '?'} loc | ${l.areaSqm ?? '?'} m² | ${l.rentEur ?? '?'}€`,
        );
        if (l.locationHint) console.log(`    📍 ${l.locationHint}`);
        if (sc) {
          console.log(
            `    ⭐ ${sc.score}/100 | risk: ${sc.riskLevel} | ${sc.reasons.slice(0, 2).join('; ')}`,
          );
        }
        console.log(
          `    seen: ${fmtDate(new Date(l.firstSeenAt))} → ${fmtDate(new Date(l.lastSeenAt))} | TG: ${l.telegramSentAt ? fmtDate(new Date(l.telegramSentAt)) : 'not sent'}`,
        );
        console.log('');
      }
    }
  }

  if (sections.has('emails')) {
    console.log(`--- Processed emails (${emailsOut.length}) ---\n`);
    if (emailsOut.length === 0) {
      console.log('  (empty)\n');
    } else {
      for (const e of emailsOut) {
        console.log(
          `  ${fmtDate(new Date(e.receivedAt))} | ${e.listingsFound} listings`,
        );
        console.log(`    ${e.subject ?? '(no subject)'}`);
        console.log(`    from: ${e.from ?? '?'} | id: ${e.gmailMessageId}`);
        console.log('');
      }
    }
  }

  if (sections.has('runs')) {
    console.log(`--- Pipeline runs (last ${runsOut.length}) ---\n`);
    if (runsOut.length === 0) {
      console.log('  (empty)\n');
    } else {
      for (const r of runsOut) {
        console.log(
          `  ${fmtDate(new Date(r.startedAt))} | ${r.status} | emails: ${r.emailsProcessed} | new: ${r.listingsNew} | dup: ${r.duplicatesSkipped} | scored: ${r.listingsScored} | TG: ${r.telegramSent}`,
        );
        if (r.errorMessage) console.log(`    error: ${r.errorMessage}`);
      }
      console.log('');
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
