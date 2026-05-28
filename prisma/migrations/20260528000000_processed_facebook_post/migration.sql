-- CreateTable
CREATE TABLE "ProcessedFacebookPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "permalink" TEXT,
    "message" TEXT,
    "postedAt" DATETIME NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "listingsFound" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedFacebookPost_postId_key" ON "ProcessedFacebookPost"("postId");

-- CreateIndex
CREATE INDEX "ProcessedFacebookPost_groupId_postedAt_idx" ON "ProcessedFacebookPost"("groupId", "postedAt");
