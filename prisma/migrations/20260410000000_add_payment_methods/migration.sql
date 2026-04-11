-- Migration: add payment customer & payment method tables
-- Adds: PaymentCustomer, PaymentMethod models to persist payment tokens and customer IDs

CREATE TABLE IF NOT EXISTS "PaymentCustomer" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerCustomerId" TEXT,
  "meta" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentMethod" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "customerId" TEXT,
  "provider" TEXT NOT NULL,
  "providerPaymentMethodId" TEXT,
  "type" TEXT NOT NULL,
  "last4" TEXT,
  "cardBrand" TEXT,
  "expiryMonth" integer,
  "expiryYear" integer,
  "isDefault" boolean NOT NULL DEFAULT false,
  "verified" boolean NOT NULL DEFAULT false,
  "meta" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_paymentcustomer_userId ON "PaymentCustomer" ("userId");
CREATE INDEX IF NOT EXISTS idx_paymentcustomer_provider ON "PaymentCustomer" ("provider");
CREATE INDEX IF NOT EXISTS idx_paymentmethod_userId ON "PaymentMethod" ("userId");
CREATE INDEX IF NOT EXISTS idx_paymentmethod_provider ON "PaymentMethod" ("provider");
CREATE UNIQUE INDEX IF NOT EXISTS uniq_paymentmethod_provider_pm_id ON "PaymentMethod" ("providerPaymentMethodId");
CREATE UNIQUE INDEX IF NOT EXISTS uniq_paymentcustomer_provider_customer_id ON "PaymentCustomer" ("providerCustomerId");

-- Foreign keys
ALTER TABLE "PaymentMethod" ADD CONSTRAINT fk_paymentmethod_user FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE;
ALTER TABLE "PaymentCustomer" ADD CONSTRAINT fk_paymentcustomer_user FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE;
ALTER TABLE "PaymentMethod" ADD CONSTRAINT fk_paymentmethod_customer FOREIGN KEY ("customerId") REFERENCES "PaymentCustomer" ("id") ON DELETE SET NULL;
