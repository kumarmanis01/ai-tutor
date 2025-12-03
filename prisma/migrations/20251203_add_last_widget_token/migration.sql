-- Add lastWidgetToken column to User if it does not exist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'lastWidgetToken') THEN
        ALTER TABLE "User" ADD COLUMN "lastWidgetToken" TEXT;
    END IF;
END$$;
