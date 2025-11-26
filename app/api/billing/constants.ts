export const DEBUG_MODE = process.env.NODE_ENV !== 'production';

// Extracted billing cycle strings as constants
export const BILLING_FREE = 'free';
export const BILLING_MONTHLY = 'monthly';
export const BILLING_ANNUAL = 'annual';
export const BILLING_PLAN_PRO = 'pro';

// Pricing constants
export const PRICES = {
  [BILLING_FREE]: 0,
  [BILLING_MONTHLY]: DEBUG_MODE ? 1 : 599,
  [BILLING_ANNUAL]: DEBUG_MODE ? 10 : 5499,
};

// Razorpay plan IDs mapped using constants
export const RAZORPAY_PLAN_IDS: Record<string, Record<string, string>> = {
  [BILLING_PLAN_PRO]: {
    // Use the production plan IDs by default to ensure valid plan IDs in dev/testing.
    [BILLING_MONTHLY]: 'plan_RRj7b8PrZx9LXc', // Monthly plan ID (production)
    [BILLING_ANNUAL]: 'plan_RRj8qCcuBOAF98', // Annual plan ID (production)
  },
  // Add other plans if needed
};
