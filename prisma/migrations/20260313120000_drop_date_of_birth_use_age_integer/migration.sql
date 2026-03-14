-- DropColumn: remove dateOfBirth; parent verification now uses integer age only.
ALTER TABLE "User" DROP COLUMN IF EXISTS "dateOfBirth";
