-- Migration: add planId to PaymentOrder
-- Additive column; nullable so existing orders are not affected.
-- References lib/billing/plans.ts PlanId (e.g. 'standard_monthly').

ALTER TABLE "PaymentOrder" ADD COLUMN IF NOT EXISTS "planId" TEXT;
