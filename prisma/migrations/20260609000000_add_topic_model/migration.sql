-- CreateTable
CREATE TABLE "TopicConcept" (
    "id" TEXT NOT NULL,
    "topicSlug" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicConcept_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopicConcept_topicSlug_subject_grade_board_title_key" ON "TopicConcept"("topicSlug", "subject", "grade", "board", "title");

-- CreateIndex
CREATE INDEX "TopicConcept_topicSlug_subject_grade_board_idx" ON "TopicConcept"("topicSlug", "subject", "grade", "board");
