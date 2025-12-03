-- Convert `subjects` JSONB column to text[] safely (idempotent)
-- If column doesn't exist yet, we create the new text[] column and rename accordingly.

-- 1) Add a new temp column to hold text[] values (if not exists)
ALTER TABLE IF EXISTS "public"."User"
ADD COLUMN IF NOT EXISTS "subjects_new" text[] DEFAULT '{}'::text[];

-- 2) Populate the new column from the existing jsonb `subjects` column when possible
-- If the existing column is a JSON array, convert elements to text; otherwise leave default
UPDATE "public"."User"
SET "subjects_new" = (
  CASE
    WHEN jsonb_typeof("subjects") = 'array' THEN (
      SELECT array_agg(elem) FROM (
        SELECT jsonb_array_elements_text("subjects") AS elem
      ) AS x
    )
    ELSE NULL
  END
)
WHERE "subjects" IS NOT NULL;

-- 3) Drop the old `subjects` column if it exists (jsonb)
ALTER TABLE IF EXISTS "public"."User"
DROP COLUMN IF EXISTS "subjects";

-- 4) Rename the new column into place
ALTER TABLE IF EXISTS "public"."User"
RENAME COLUMN "subjects_new" TO "subjects";

-- Ensure the final column has a default empty array
ALTER TABLE IF EXISTS "public"."User"
ALTER COLUMN "subjects" SET DEFAULT '{}'::text[];
