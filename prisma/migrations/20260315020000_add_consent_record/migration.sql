-- Migration: add_consent_record (T37 — DPDP)
-- Adds Consent table + ConsentScope enum.

CREATE TYPE "ConsentScope" AS ENUM (
  'DATA_PROCESSING',
  'AI_INTERACTION',
  'PARENT_NOTIFICATION',
  'MARKETING'
);

CREATE TABLE "Consent" (
  "id"          TEXT         NOT NULL,
  "userId"      TEXT         NOT NULL,
  "scope"       "ConsentScope" NOT NULL,
  "givenAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "withdrawnAt" TIMESTAMP(3),
  "version"     TEXT         NOT NULL DEFAULT '1.0',

  CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Consent_userId_scope_idx" ON "Consent"("userId", "scope");

ALTER TABLE "Consent"
  ADD CONSTRAINT "Consent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
