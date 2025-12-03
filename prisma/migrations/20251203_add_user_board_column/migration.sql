-- Add board column to User if it does not exist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'board') THEN
        ALTER TABLE "User" ADD COLUMN "board" TEXT;
    END IF;
END$$;
