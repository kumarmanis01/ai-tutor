/*
  Warnings:

  - Made the column `difficulty` on table `HydrationJob` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `difficultyLevel` to the `LearningSession` table without a default value. This is not possible if the table is not empty.
  - Made the column `difficulty` on table `StudentContentPreference` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "HydrationJob" ALTER COLUMN "difficulty" SET NOT NULL;

-- AlterTable
ALTER TABLE "LearningSession" DROP COLUMN "difficultyLevel",
ADD COLUMN     "difficultyLevel" "DifficultyLevel" NOT NULL;

-- AlterTable
ALTER TABLE "StudentContentPreference" ALTER COLUMN "difficulty" SET NOT NULL;
