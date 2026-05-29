-- Migration: add_parent_created_child_flow
-- Adds createdByParentId FK on User for audit trail of parent-created child accounts (F-PAR-002).
-- Additive-only: new nullable column + FK + index. No existing data is affected.

-- Add nullable FK column
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdByParentId" TEXT;

-- Add FK constraint (SET NULL on parent delete so child account is not cascade-deleted)
ALTER TABLE "User"
  ADD CONSTRAINT "User_createdByParentId_fkey"
  FOREIGN KEY ("createdByParentId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Index for reverse lookup: "show me all children created by this parent"
CREATE INDEX IF NOT EXISTS "User_createdByParentId_idx" ON "User"("createdByParentId");
