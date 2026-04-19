-- Add notifiedAt column to DoubtEscalation to track when student was notified
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = '"DoubtEscalation"'::regclass AND attname = 'notifiedAt'
  ) THEN
    ALTER TABLE "DoubtEscalation" ADD COLUMN "notifiedAt" TIMESTAMP(3);
  END IF;
END
$$;

-- Add index on notifiedAt for efficient lookup of unresolved notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'DoubtEscalation_notifiedAt_idx'
  ) THEN
    CREATE INDEX "DoubtEscalation_notifiedAt_idx" ON "DoubtEscalation"("notifiedAt");
  END IF;
END
$$;
