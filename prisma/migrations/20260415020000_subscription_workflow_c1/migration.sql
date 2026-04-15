-- Migration: subscription_workflow_c1
-- Adds razorpaySubscriptionId to Subscription for webhook reconciliation.
-- Creates TestPlanAccess table for test plan whitelist management.
-- Both changes are purely additive.

-- Add razorpaySubscriptionId to Subscription (nullable, safe for existing rows)
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "razorpaySubscriptionId" TEXT;
CREATE INDEX IF NOT EXISTS "Subscription_razorpaySubscriptionId_idx" ON "Subscription"("razorpaySubscriptionId");

-- Create TestPlanAccess table
CREATE TABLE IF NOT EXISTS "TestPlanAccess" (
    "id"        TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT NOT NULL,

    CONSTRAINT "TestPlanAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TestPlanAccess_email_key" ON "TestPlanAccess"("email");
CREATE INDEX        IF NOT EXISTS "TestPlanAccess_email_idx" ON "TestPlanAccess"("email");
