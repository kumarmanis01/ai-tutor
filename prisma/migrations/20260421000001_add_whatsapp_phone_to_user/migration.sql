-- AddColumn: whatsappPhone to User
-- Immutable after first save (enforced at application layer).
ALTER TABLE "User" ADD COLUMN "whatsappPhone" TEXT;
