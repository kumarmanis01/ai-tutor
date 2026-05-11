-- Migration: subscription_workflow_c1
-- Adds razorpaySubscriptionId to Subscription for webhook reconciliation.
-- Purely additive.

-- Add razorpaySubscriptionId to Subscription (nullable, safe for existing rows)
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "razorpaySubscriptionId" TEXT;
CREATE INDEX IF NOT EXISTS "Subscription_razorpaySubscriptionId_idx" ON "Subscription"("razorpaySubscriptionId");
