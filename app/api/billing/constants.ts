export const DEBUG_MODE = process.env.NODE_ENV !== 'production';

// Extracted billing cycle strings as constants
export const BILLING_MONTHLY = 'monthly';
export const BILLING_ANNUAL = 'annual';
export const BILLING_PLAN_PRO = 'pro';

// Pricing constants
export const PRICES = {
  [BILLING_MONTHLY]: DEBUG_MODE ? 1 : 599,
  [BILLING_ANNUAL]: DEBUG_MODE ? 10 : 5499,
};

// Razorpay plan IDs mapped using constants
export const RAZORPAY_PLAN_IDS: Record<string, Record<string, string>> = {
  [BILLING_PLAN_PRO]: {
    [BILLING_MONTHLY]: DEBUG_MODE ? 'plan_RLRti4O5LzEFl7' : 'plan_RRj7b8PrZx9LXc', // Monthly plan ID
    [BILLING_ANNUAL]: DEBUG_MODE ? 'plan_RLRuDKLpa2tmMK' : 'plan_RRj8qCcuBOAF98', // Annual plan ID
  },
  // Add other plans if needed
};
