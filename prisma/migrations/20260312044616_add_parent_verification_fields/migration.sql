-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "parentVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "requiresParentVerification" BOOLEAN NOT NULL DEFAULT false;
