-- DropIndex
DROP INDEX "AIContentLog_board_grade_subject_idx";

-- AlterTable
ALTER TABLE "ChapterDef" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';
