/**
 * FILE OBJECTIVE:
 * - Define token cost rates and assumptions for cost simulation.
 * - Provide configurable parameters for different pricing tiers.
 * - Support multiple OpenAI models and pricing changes.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/analytics/costSimulation/assumptions.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created cost assumptions module
 */

// ============================================================================
// MODEL PRICING (per 1M tokens, USD)
// ============================================================================

/**
 * OpenAI model pricing as of January 2025.
 * Prices are per 1 million tokens.
 */
export const MODEL_PRICING = {
  'gpt-4o': {
    input: 2.50,
    output: 10.00,
    cachedInput: 1.25,
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.60,
    cachedInput: 0.075,
  },
  'gpt-4-turbo': {
    input: 10.00,
    output: 30.00,
    cachedInput: 5.00,
  },
  'gpt-3.5-turbo': {
    input: 0.50,
    output: 1.50,
    cachedInput: 0.25,
  },
} as const;

export type ModelName = keyof typeof MODEL_PRICING;

// ============================================================================
// LANGUAGE TOKEN MULTIPLIERS
// ============================================================================

/**
 * Token multipliers for different languages.
 * Non-English languages typically use more tokens due to encoding.
 */
export const LANGUAGE_TOKEN_MULTIPLIERS = {
  en: 1.0,
  hi: 2.0, // Hindi uses ~2x tokens vs English
  hinglish: 1.15, // Hinglish is closer to English token count
} as const;

export type LanguageCode = keyof typeof LANGUAGE_TOKEN_MULTIPLIERS;

// ============================================================================
// FEATURE TOKEN BUDGETS
// ============================================================================

/**
 * Estimated token usage per feature call.
 * These are conservative estimates including system prompts.
 */
export const FEATURE_TOKEN_BUDGETS = {
  notes: {
    systemPrompt: 500,
    userPrompt: 100,
    contextInjection: 200,
    expectedOutput: 1500,
    schemaOverhead: 100,
  },
  practice: {
    systemPrompt: 600,
    userPrompt: 150,
    contextInjection: 300,
    expectedOutput: 800, // Per question
    schemaOverhead: 150,
  },
  doubt: {
    systemPrompt: 400,
    userPrompt: 200,
    contextInjection: 150,
    expectedOutput: 600,
    schemaOverhead: 100,
  },
  quiz: {
    systemPrompt: 500,
    userPrompt: 100,
    contextInjection: 200,
    expectedOutput: 1200, // 5 questions average
    schemaOverhead: 200,
  },
} as const;

export type FeatureType = keyof typeof FEATURE_TOKEN_BUDGETS;

// ============================================================================
// USAGE PATTERNS BY GRADE BAND
// ============================================================================

/**
 * Monthly usage patterns by grade band.
 * Based on typical student learning behavior.
 */
export const USAGE_PATTERNS = {
  junior: {
    grades: [1, 2, 3],
    monthlyNotesRequests: 15,
    monthlyPracticeRequests: 30,
    monthlyDoubtRequests: 10,
    monthlyQuizRequests: 8,
    averageSessionMinutes: 20,
    sessionsPerWeek: 4,
    retryRate: 0.15, // 15% of requests need retry
    fallbackRate: 0.05, // 5% end in fallback
  },
  middle: {
    grades: [4, 5, 6, 7],
    monthlyNotesRequests: 25,
    monthlyPracticeRequests: 50,
    monthlyDoubtRequests: 20,
    monthlyQuizRequests: 12,
    averageSessionMinutes: 35,
    sessionsPerWeek: 5,
    retryRate: 0.12,
    fallbackRate: 0.03,
  },
  senior: {
    grades: [8, 9, 10, 11, 12],
    monthlyNotesRequests: 40,
    monthlyPracticeRequests: 80,
    monthlyDoubtRequests: 35,
    monthlyQuizRequests: 20,
    averageSessionMinutes: 50,
    sessionsPerWeek: 6,
    retryRate: 0.10,
    fallbackRate: 0.02,
  },
} as const;

export type GradeBand = keyof typeof USAGE_PATTERNS;

// ============================================================================
// COST MULTIPLIERS
// ============================================================================

/**
 * Additional cost factors beyond raw token costs.
 */
export const COST_MULTIPLIERS = {
  // Retry overhead
  retryMultiplier: 1.5, // Average retry adds 50% token cost
  
  // Infrastructure overhead (logging, monitoring, etc.)
  infrastructureOverhead: 1.10, // 10% overhead
  
  // Safety margin for price fluctuations
  safetyMargin: 1.15, // 15% buffer
  
  // Caching discount (for repeated content)
  cachingDiscount: 0.85, // 15% savings from caching
  
  // Volume discount tiers (monthly requests)
  volumeDiscounts: {
    tier1: { threshold: 100000, discount: 0.95 }, // 5% off
    tier2: { threshold: 500000, discount: 0.90 }, // 10% off
    tier3: { threshold: 1000000, discount: 0.85 }, // 15% off
  },
} as const;

// ============================================================================
// FREE TIER LIMITS
// ============================================================================

/**
 * Free tier limits for non-premium students.
 */
export const FREE_TIER_LIMITS = {
  dailyNotesRequests: 3,
  dailyPracticeRequests: 5,
  dailyDoubtRequests: 2,
  dailyQuizRequests: 1,
  maxMonthlyRequests: 150,
  // Free tier uses cheaper models
  allowedModels: ['gpt-4o-mini', 'gpt-3.5-turbo'] as ModelName[],
} as const;

// ============================================================================
// PREMIUM TIER CONFIG
// ============================================================================

/**
 * Premium tier configuration.
 */
export const PREMIUM_TIER_CONFIG = {
  dailyNotesRequests: 50,
  dailyPracticeRequests: 100,
  dailyDoubtRequests: 50,
  dailyQuizRequests: 20,
  maxMonthlyRequests: 5000,
  // Premium gets better models
  preferredModel: 'gpt-4o' as ModelName,
  fallbackModel: 'gpt-4o-mini' as ModelName,
} as const;

// ============================================================================
// ASSUMPTION HELPERS
// ============================================================================

/**
 * Get grade band for a specific grade.
 */
export function getGradeBand(grade: number): GradeBand {
  if (grade <= 3) return 'junior';
  if (grade <= 7) return 'middle';
  return 'senior';
}

/**
 * Get model pricing for a model name.
 */
export function getModelPricing(model: ModelName) {
  return MODEL_PRICING[model];
}

/**
 * Get token multiplier for a language.
 */
export function getLanguageMultiplier(language: LanguageCode): number {
  return LANGUAGE_TOKEN_MULTIPLIERS[language];
}

/**
 * Get usage pattern for a grade band.
 */
export function getUsagePattern(gradeBand: GradeBand) {
  return USAGE_PATTERNS[gradeBand];
}

/**
 * Calculate volume discount based on monthly request count.
 */
export function calculateVolumeDiscount(monthlyRequests: number): number {
  const { volumeDiscounts } = COST_MULTIPLIERS;
  
  if (monthlyRequests >= volumeDiscounts.tier3.threshold) {
    return volumeDiscounts.tier3.discount;
  }
  if (monthlyRequests >= volumeDiscounts.tier2.threshold) {
    return volumeDiscounts.tier2.discount;
  }
  if (monthlyRequests >= volumeDiscounts.tier1.threshold) {
    return volumeDiscounts.tier1.discount;
  }
  
  return 1.0; // No discount
}
