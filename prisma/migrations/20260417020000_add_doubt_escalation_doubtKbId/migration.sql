-- Add doubtKbId column to DoubtEscalation for traceability to DoubtKb
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = '"DoubtEscalation"'::regclass AND attname = 'doubtKbId'
  ) THEN
    ALTER TABLE "DoubtEscalation" ADD COLUMN "doubtKbId" TEXT;
  END IF;
END
$$;

-- Add FK constraint to DoubtKb (nullable; set null on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DoubtEscalation_doubtKbId_fkey'
  ) THEN
    ALTER TABLE "DoubtEscalation" ADD CONSTRAINT "DoubtEscalation_doubtKbId_fkey" FOREIGN KEY ("doubtKbId") REFERENCES "DoubtKb" (id) ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'DoubtEscalation_doubtKbId_idx'
  ) THEN
    CREATE INDEX "DoubtEscalation_doubtKbId_idx" ON "DoubtEscalation"("doubtKbId");
  END IF;
END
$$;
