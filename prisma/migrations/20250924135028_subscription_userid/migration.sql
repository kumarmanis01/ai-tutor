/*
  Warnings:

  - You are about to drop the column `status` on the `Subscription` table. All the data in the column will be lost.
  - Added the required column `billingCycle` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Made the column `endDate` on table `Subscription` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("createdAt", "endDate", "id", "plan", "startDate", "updatedAt", "userId") SELECT "createdAt", "endDate", "id", "plan", "startDate", "updatedAt", "userId" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
