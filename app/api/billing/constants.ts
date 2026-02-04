export const DEBUG_MODE = process.env.NODE_ENV !== 'production';

// Extracted billing cycle strings as constants
export const BILLING_FREE = 'free';
export const BILLING_MONTHLY = 'monthly';
export const BILLING_ANNUAL = 'annual';
export const BILLING_PLAN_PRO = 'pro';
export const BILLING_PLAN_FAMILY = 'family';

// Pricing constants
export const PRICES: Record<string, number> = {
  [BILLING_FREE]: 0,
  [BILLING_MONTHLY]: DEBUG_MODE ? 1 : 599,
  [BILLING_ANNUAL]: DEBUG_MODE ? 10 : 5499,
};

// Family plan pricing (base includes 1 child, add-on per extra child)
export const FAMILY_PRICES: Record<string, number> = {
  [BILLING_MONTHLY]: DEBUG_MODE ? 2 : 799,
  [BILLING_ANNUAL]: DEBUG_MODE ? 15 : 6999,
};

// Per additional child add-on
export const FAMILY_ADDON_PER_CHILD: Record<string, number> = {
  [BILLING_MONTHLY]: DEBUG_MODE ? 1 : 199,
  [BILLING_ANNUAL]: DEBUG_MODE ? 5 : 1499,
};

export const FAMILY_MAX_CHILDREN = 5;

// Razorpay plan IDs mapped using constants
export const RAZORPAY_PLAN_IDS: Record<string, Record<string, string>> = {
  [BILLING_PLAN_PRO]: {
    [BILLING_MONTHLY]: 'plan_RRj7b8PrZx9LXc', // Monthly plan ID (production)
    [BILLING_ANNUAL]: 'plan_RRj8qCcuBOAF98', // Annual plan ID (production)
  },
  [BILLING_PLAN_FAMILY]: {
    [BILLING_MONTHLY]: process.env.RAZORPAY_FAMILY_MONTHLY_PLAN_ID || '', // To be configured
    [BILLING_ANNUAL]: process.env.RAZORPAY_FAMILY_ANNUAL_PLAN_ID || '', // To be configured
  },
};
