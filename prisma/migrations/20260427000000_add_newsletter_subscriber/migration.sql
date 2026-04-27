-- Migration: add_newsletter_subscriber
-- Created: 2026-04-27T00:00:00Z
-- Purpose: LP v3 — adds NewsletterSubscriber table for DPDP-compliant email capture

CREATE TABLE "NewsletterSubscriber" (
    "id"           TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "source"       TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");
CREATE INDEX "NewsletterSubscriber_createdAt_idx" ON "NewsletterSubscriber"("createdAt");
