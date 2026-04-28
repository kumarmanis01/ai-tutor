CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "CurriculumChunk" ADD COLUMN     "embedding" vector(1536);
