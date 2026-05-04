-- Add ParentRelationship enum + ParentStudent.relationship, and extend ConsentScope

DO $$
BEGIN
  CREATE TYPE "ParentRelationship" AS ENUM ('father', 'mother', 'guardian');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "ConsentScope" ADD VALUE IF NOT EXISTS 'COMMUNITY_FEATURES';

ALTER TABLE "ParentStudent"
ADD COLUMN IF NOT EXISTS "relationship" "ParentRelationship" NOT NULL DEFAULT 'guardian';
