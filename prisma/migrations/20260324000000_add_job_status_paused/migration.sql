-- Add paused to JobStatus enum (additive only)
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'paused';

-- Add JOB_PAUSE and JOB_RESUME to AdminActionType enum (additive only)
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'JOB_PAUSE';
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'JOB_RESUME';
