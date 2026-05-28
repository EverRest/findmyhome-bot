-- AlterTable
ALTER TABLE "Listing" ADD COLUMN "lat" REAL;
ALTER TABLE "Listing" ADD COLUMN "lng" REAL;
ALTER TABLE "Listing" ADD COLUMN "geocodeSource" TEXT;
ALTER TABLE "Listing" ADD COLUMN "geocodedAt" DATETIME;
ALTER TABLE "Listing" ADD COLUMN "distanceToRefM" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "proximityScore" INTEGER;

-- CreateTable
CREATE TABLE "GeocodeCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queryKey" TEXT NOT NULL,
    "queryRaw" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nominatim',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "GeocodeCache_queryKey_key" ON "GeocodeCache"("queryKey");
