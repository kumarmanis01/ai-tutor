-- AlterTable
ALTER TABLE "AIContentLog" ADD COLUMN     "schemaHash" TEXT;

-- CreateIndex
CREATE INDEX "AIContentLog_promptType_schemaHash_idx" ON "AIContentLog"("promptType", "schemaHash");
