/*
  Warnings:

  - Added the required column `updatedAt` to the `TopicDef` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TopicDef" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "TopicDef_status_idx" ON "TopicDef"("status");

-- CreateIndex
CREATE INDEX "TopicDef_isActive_idx" ON "TopicDef"("isActive");

-- CreateIndex
CREATE INDEX "TopicDef_parentId_idx" ON "TopicDef"("parentId");

-- AddForeignKey
ALTER TABLE "TopicDef" ADD CONSTRAINT "TopicDef_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TopicDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;
