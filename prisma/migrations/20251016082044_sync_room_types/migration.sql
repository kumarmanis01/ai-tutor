-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "createdByAI" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "topic" TEXT;

-- AlterTable
ALTER TABLE "RoomMember" ADD COLUMN     "score" INTEGER;
