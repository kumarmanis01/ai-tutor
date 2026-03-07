-- AlterEnum
-- Add EXPIRED to SessionPhase for GAP-05 session staleness policy
ALTER TYPE "SessionPhase" ADD VALUE 'EXPIRED';
