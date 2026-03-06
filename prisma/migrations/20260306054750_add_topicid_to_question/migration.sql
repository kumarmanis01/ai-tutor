-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "topicId" TEXT;

-- CreateIndex
CREATE INDEX "Question_topicId_idx" ON "Question"("topicId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "TopicDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;
