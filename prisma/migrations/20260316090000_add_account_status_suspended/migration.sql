-- This migration is not transactional (ALTER TYPE ADD VALUE cannot run inside a transaction)

ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'suspended';
ALTER TYPE "AccountStatus" ADD VALUE IF NOT EXISTS 'deletion_pending';
