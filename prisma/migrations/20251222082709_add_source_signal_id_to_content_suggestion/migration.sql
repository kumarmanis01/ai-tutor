/*
  Warnings:

  - A unique constraint covering the columns `[sourceSignalId,type,targetId]` on the table `ContentSuggestion` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ContentSuggestion" ADD COLUMN     "sourceSignalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ContentSuggestion_sourceSignalId_type_targetId_key" ON "ContentSuggestion"("sourceSignalId", "type", "targetId");
