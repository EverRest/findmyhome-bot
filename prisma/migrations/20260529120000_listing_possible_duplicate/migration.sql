-- AlterTable
ALTER TABLE "Listing" ADD COLUMN "propertyMatchKey" TEXT;
ALTER TABLE "Listing" ADD COLUMN "possibleDuplicateOfId" TEXT;

-- CreateIndex
CREATE INDEX "Listing_propertyMatchKey_idx" ON "Listing"("propertyMatchKey");

-- CreateIndex
CREATE INDEX "Listing_possibleDuplicateOfId_idx" ON "Listing"("possibleDuplicateOfId");
