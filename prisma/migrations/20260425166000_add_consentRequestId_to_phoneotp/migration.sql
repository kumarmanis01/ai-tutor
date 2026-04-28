-- Migration: add consentRequestId to PhoneOtp to scope OTPs to a ConsentRequest
ALTER TABLE "PhoneOtp" ADD COLUMN "consentRequestId" text;

ALTER TABLE "PhoneOtp" ADD CONSTRAINT "PhoneOtp_consentRequestId_fkey" FOREIGN KEY ("consentRequestId") REFERENCES "ConsentRequest"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "PhoneOtp_consentRequestId_idx" ON "PhoneOtp" ("consentRequestId");
