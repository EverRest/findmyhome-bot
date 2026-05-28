-- CreateTable
CREATE TABLE "ProcessedEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gmailMessageId" TEXT NOT NULL,
    "subject" TEXT,
    "fromAddress" TEXT,
    "receivedAt" DATETIME NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "listingsFound" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalUrl" TEXT NOT NULL,
    "alternateUrls" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT,
    "externalId" TEXT,
    "title" TEXT,
    "addressRaw" TEXT,
    "locationHint" TEXT,
    "rentEur" INTEGER,
    "condoFeeEur" INTEGER,
    "totalCostEur" INTEGER,
    "areaSqm" REAL,
    "rooms" REAL,
    "floor" INTEGER,
    "hasLift" BOOLEAN,
    "rawSnippet" TEXT,
    "listingFingerprint" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priceChangedAt" DATETIME,
    "materialHash" TEXT,
    "telegramSentAt" DATETIME,
    "telegramMessageId" TEXT,
    "dismissedAt" DATETIME,
    "savedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ListingScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" TEXT NOT NULL DEFAULT '[]',
    "riskLevel" TEXT NOT NULL DEFAULT 'none',
    "riskReasons" TEXT NOT NULL DEFAULT '[]',
    "riskSource" TEXT,
    "model" TEXT,
    "scoredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingScore_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "emailsProcessed" INTEGER NOT NULL DEFAULT 0,
    "listingsParsed" INTEGER NOT NULL DEFAULT 0,
    "listingsNew" INTEGER NOT NULL DEFAULT 0,
    "duplicatesSkipped" INTEGER NOT NULL DEFAULT 0,
    "listingsScored" INTEGER NOT NULL DEFAULT 0,
    "telegramSent" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEmail_gmailMessageId_key" ON "ProcessedEmail"("gmailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_canonicalUrl_key" ON "Listing"("canonicalUrl");

-- CreateIndex
CREATE INDEX "ListingScore_listingId_scoredAt_idx" ON "ListingScore"("listingId", "scoredAt");
