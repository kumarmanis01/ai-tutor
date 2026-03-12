-- AlterTable
ALTER TABLE "LearningSession" ADD COLUMN     "ratedAt" TIMESTAMP(3),
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "ratingFeedback" TEXT;
