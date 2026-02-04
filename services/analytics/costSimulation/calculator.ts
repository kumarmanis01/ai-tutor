/**
 * FILE OBJECTIVE:
 * - Core cost calculation functions for AI token usage.
 * - Calculate cost per request, per student, per month.
 * - Support different models, languages, and usage patterns.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/analytics/costSimulation/calculator.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created cost calculator module
 */

import {
  MODEL_PRICING,
  FEATURE_TOKEN_BUDGETS,
  USAGE_PATTERNS,
  COST_MULTIPLIERS,
  FREE_TIER_LIMITS,
  PREMIUM_TIER_CONFIG,
  getGradeBand,
  getLanguageMultiplier,
  calculateVolumeDiscount,
  type ModelName,
  type LanguageCode,
  type FeatureType,
  type GradeBand,
} from './assumptions';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RequestCostBreakdown {
  feature: FeatureType;
  model: ModelName;
  language: LanguageCode;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  inputCostUSD: number;
  outputCostUSD: number;
  cachedInputCostUSD: number;
  totalCostUSD: number;
  totalCostINR: number;
}

export interface MonthlyStudentCost {
  grade: number;
  gradeBand: GradeBand;
  isPremium: boolean;
  language: LanguageCode;
  model: ModelName;
  
  // Request counts
  notesRequests: number;
  practiceRequests: number;
  doubtRequests: number;
  quizRequests: number;
  totalRequests: number;
  
  // Retry/fallback overhead
  retryRequests: number;
  fallbackRequests: number;
  
  // Costs
  notesCostUSD: number;
  practiceCostUSD: number;
  doubtCostUSD: number;
  quizCostUSD: number;
  retryCostUSD: number;
  
  subtotalUSD: number;
  infrastructureOverheadUSD: number;
  volumeDiscountUSD: number;
  totalCostUSD: number;
  totalCostINR: number;
  
  // Per-unit metrics
  costPerRequestUSD: number;
  costPerSessionUSD: number;
  costPerMinuteUSD: number;
}

export interface CostSimulationConfig {
  grade: number;
  language: LanguageCode;
  isPremium: boolean;
  model?: ModelName;
  usageMultiplier?: number; // For heavy/light users
  usdToInrRate?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_USD_TO_INR = 83.50;
const TOKENS_PER_MILLION = 1_000_000;

// ============================================================================
// SINGLE REQUEST COST CALCULATION
// ============================================================================

/**
 * Calculate cost for a single AI request.
 */
export function calculateRequestCost(
  feature: FeatureType,
  model: ModelName,
  language: LanguageCode = 'en',
  cachingEnabled: boolean = true,
  usdToInrRate: number = DEFAULT_USD_TO_INR
): RequestCostBreakdown {
  const pricing = MODEL_PRICING[model];
  const tokenBudget = FEATURE_TOKEN_BUDGETS[feature];
  const languageMultiplier = getLanguageMultiplier(language);
  
  // Calculate token counts
  const inputTokens = Math.ceil(
    (tokenBudget.systemPrompt + tokenBudget.userPrompt + tokenBudget.contextInjection + tokenBudget.schemaOverhead) *
    languageMultiplier
  );
  
  const outputTokens = Math.ceil(tokenBudget.expectedOutput * languageMultiplier);
  
  // Estimate cached tokens (system prompt is often cached)
  const cachedInputTokens = cachingEnabled ? Math.ceil(tokenBudget.systemPrompt * 0.8) : 0;
  const nonCachedInputTokens = inputTokens - cachedInputTokens;
  
  // Calculate costs (per million tokens)
  const inputCostUSD = (nonCachedInputTokens / TOKENS_PER_MILLION) * pricing.input;
  const cachedInputCostUSD = (cachedInputTokens / TOKENS_PER_MILLION) * pricing.cachedInput;
  const outputCostUSD = (outputTokens / TOKENS_PER_MILLION) * pricing.output;
  
  const totalCostUSD = inputCostUSD + cachedInputCostUSD + outputCostUSD;
  
  return {
    feature,
    model,
    language,
    inputTokens: nonCachedInputTokens,
    outputTokens,
    cachedInputTokens,
    inputCostUSD: roundToSixDecimals(inputCostUSD),
    outputCostUSD: roundToSixDecimals(outputCostUSD),
    cachedInputCostUSD: roundToSixDecimals(cachedInputCostUSD),
    totalCostUSD: roundToSixDecimals(totalCostUSD),
    totalCostINR: roundToTwoDecimals(totalCostUSD * usdToInrRate),
  };
}

// ============================================================================
// MONTHLY STUDENT COST CALCULATION
// ============================================================================

/**
 * Calculate monthly cost for a single student.
 */
export function calculateMonthlyStudentCost(config: CostSimulationConfig): MonthlyStudentCost {
  const {
    grade,
    language,
    isPremium,
    usageMultiplier = 1.0,
    usdToInrRate = DEFAULT_USD_TO_INR,
  } = config;
  
  const gradeBand = getGradeBand(grade);
  const usagePattern = USAGE_PATTERNS[gradeBand];
  const model = config.model ?? (isPremium ? PREMIUM_TIER_CONFIG.preferredModel : 'gpt-4o-mini');
  
  // Calculate request counts
  const notesRequests = Math.ceil(usagePattern.monthlyNotesRequests * usageMultiplier);
  const practiceRequests = Math.ceil(usagePattern.monthlyPracticeRequests * usageMultiplier);
  const doubtRequests = Math.ceil(usagePattern.monthlyDoubtRequests * usageMultiplier);
  const quizRequests = Math.ceil(usagePattern.monthlyQuizRequests * usageMultiplier);
  
  // Apply free tier limits if not premium
  const cappedNotes = isPremium ? notesRequests : Math.min(notesRequests, FREE_TIER_LIMITS.dailyNotesRequests * 30);
  const cappedPractice = isPremium ? practiceRequests : Math.min(practiceRequests, FREE_TIER_LIMITS.dailyPracticeRequests * 30);
  const cappedDoubts = isPremium ? doubtRequests : Math.min(doubtRequests, FREE_TIER_LIMITS.dailyDoubtRequests * 30);
  const cappedQuiz = isPremium ? quizRequests : Math.min(quizRequests, FREE_TIER_LIMITS.dailyQuizRequests * 30);
  
  const totalRequests = cappedNotes + cappedPractice + cappedDoubts + cappedQuiz;
  
  // Calculate retry/fallback overhead
  const retryRequests = Math.ceil(totalRequests * usagePattern.retryRate);
  const fallbackRequests = Math.ceil(totalRequests * usagePattern.fallbackRate);
  
  // Calculate per-feature costs
  const notesCost = calculateRequestCost('notes', model, language);
  const practiceCost = calculateRequestCost('practice', model, language);
  const doubtCost = calculateRequestCost('doubt', model, language);
  const quizCost = calculateRequestCost('quiz', model, language);
  
  const notesCostUSD = notesCost.totalCostUSD * cappedNotes;
  const practiceCostUSD = practiceCost.totalCostUSD * cappedPractice;
  const doubtCostUSD = doubtCost.totalCostUSD * cappedDoubts;
  const quizCostUSD = quizCost.totalCostUSD * cappedQuiz;
  
  // Average cost for retry calculation
  const avgRequestCost = (notesCost.totalCostUSD + practiceCost.totalCostUSD + doubtCost.totalCostUSD + quizCost.totalCostUSD) / 4;
  const retryCostUSD = retryRequests * avgRequestCost * COST_MULTIPLIERS.retryMultiplier;
  
  const subtotalUSD = notesCostUSD + practiceCostUSD + doubtCostUSD + quizCostUSD + retryCostUSD;
  
  // Apply overhead
  const infrastructureOverheadUSD = subtotalUSD * (COST_MULTIPLIERS.infrastructureOverhead - 1);
  
  // Apply volume discount
  const volumeDiscount = calculateVolumeDiscount(totalRequests);
  const volumeDiscountUSD = subtotalUSD * (1 - volumeDiscount);
  
  const totalCostUSD = subtotalUSD + infrastructureOverheadUSD - volumeDiscountUSD;
  
  // Calculate per-unit metrics
  const totalMinutes = usagePattern.averageSessionMinutes * usagePattern.sessionsPerWeek * 4;
  const totalSessions = usagePattern.sessionsPerWeek * 4;
  
  return {
    grade,
    gradeBand,
    isPremium,
    language,
    model,
    
    notesRequests: cappedNotes,
    practiceRequests: cappedPractice,
    doubtRequests: cappedDoubts,
    quizRequests: cappedQuiz,
    totalRequests,
    
    retryRequests,
    fallbackRequests,
    
    notesCostUSD: roundToSixDecimals(notesCostUSD),
    practiceCostUSD: roundToSixDecimals(practiceCostUSD),
    doubtCostUSD: roundToSixDecimals(doubtCostUSD),
    quizCostUSD: roundToSixDecimals(quizCostUSD),
    retryCostUSD: roundToSixDecimals(retryCostUSD),
    
    subtotalUSD: roundToSixDecimals(subtotalUSD),
    infrastructureOverheadUSD: roundToSixDecimals(infrastructureOverheadUSD),
    volumeDiscountUSD: roundToSixDecimals(volumeDiscountUSD),
    totalCostUSD: roundToSixDecimals(totalCostUSD),
    totalCostINR: roundToTwoDecimals(totalCostUSD * usdToInrRate),
    
    costPerRequestUSD: roundToSixDecimals(totalCostUSD / totalRequests),
    costPerSessionUSD: roundToSixDecimals(totalCostUSD / totalSessions),
    costPerMinuteUSD: roundToSixDecimals(totalCostUSD / totalMinutes),
  };
}

// ============================================================================
// BATCH COST CALCULATION
// ============================================================================

/**
 * Calculate costs for multiple students (cohort simulation).
 */
export function calculateCohortCost(
  students: CostSimulationConfig[],
  usdToInrRate: number = DEFAULT_USD_TO_INR
): {
  students: MonthlyStudentCost[];
  totalCostUSD: number;
  totalCostINR: number;
  averageCostUSD: number;
  costByGradeBand: Record<GradeBand, number>;
  costByLanguage: Record<LanguageCode, number>;
} {
  const studentCosts = students.map(s => calculateMonthlyStudentCost({ ...s, usdToInrRate }));
  
  const totalCostUSD = studentCosts.reduce((sum, s) => sum + s.totalCostUSD, 0);
  
  const costByGradeBand: Record<GradeBand, number> = {
    junior: 0,
    middle: 0,
    senior: 0,
  };
  
  const costByLanguage: Record<LanguageCode, number> = {
    en: 0,
    hi: 0,
    hinglish: 0,
  };
  
  studentCosts.forEach(s => {
    costByGradeBand[s.gradeBand] += s.totalCostUSD;
    costByLanguage[s.language] += s.totalCostUSD;
  });
  
  return {
    students: studentCosts,
    totalCostUSD: roundToTwoDecimals(totalCostUSD),
    totalCostINR: roundToTwoDecimals(totalCostUSD * usdToInrRate),
    averageCostUSD: roundToSixDecimals(totalCostUSD / students.length),
    costByGradeBand: {
      junior: roundToTwoDecimals(costByGradeBand.junior),
      middle: roundToTwoDecimals(costByGradeBand.middle),
      senior: roundToTwoDecimals(costByGradeBand.senior),
    },
    costByLanguage: {
      en: roundToTwoDecimals(costByLanguage.en),
      hi: roundToTwoDecimals(costByLanguage.hi),
      hinglish: roundToTwoDecimals(costByLanguage.hinglish),
    },
  };
}

// ============================================================================
// COMPARISON UTILITIES
// ============================================================================

/**
 * Compare costs between two models.
 */
export function compareModelCosts(
  feature: FeatureType,
  model1: ModelName,
  model2: ModelName,
  language: LanguageCode = 'en'
): {
  model1: RequestCostBreakdown;
  model2: RequestCostBreakdown;
  savingsUSD: number;
  savingsPercent: number;
  cheaperModel: ModelName;
} {
  const cost1 = calculateRequestCost(feature, model1, language);
  const cost2 = calculateRequestCost(feature, model2, language);
  
  const savingsUSD = Math.abs(cost1.totalCostUSD - cost2.totalCostUSD);
  const maxCost = Math.max(cost1.totalCostUSD, cost2.totalCostUSD);
  const savingsPercent = (savingsUSD / maxCost) * 100;
  
  return {
    model1: cost1,
    model2: cost2,
    savingsUSD: roundToSixDecimals(savingsUSD),
    savingsPercent: roundToTwoDecimals(savingsPercent),
    cheaperModel: cost1.totalCostUSD < cost2.totalCostUSD ? model1 : model2,
  };
}

/**
 * Compare costs between languages.
 */
export function compareLanguageCosts(
  feature: FeatureType,
  model: ModelName,
  language1: LanguageCode,
  language2: LanguageCode
): {
  language1: RequestCostBreakdown;
  language2: RequestCostBreakdown;
  additionalCostUSD: number;
  additionalCostPercent: number;
  cheaperLanguage: LanguageCode;
} {
  const cost1 = calculateRequestCost(feature, model, language1);
  const cost2 = calculateRequestCost(feature, model, language2);
  
  const additionalCostUSD = Math.abs(cost1.totalCostUSD - cost2.totalCostUSD);
  const minCost = Math.min(cost1.totalCostUSD, cost2.totalCostUSD);
  const additionalCostPercent = (additionalCostUSD / minCost) * 100;
  
  return {
    language1: cost1,
    language2: cost2,
    additionalCostUSD: roundToSixDecimals(additionalCostUSD),
    additionalCostPercent: roundToTwoDecimals(additionalCostPercent),
    cheaperLanguage: cost1.totalCostUSD < cost2.totalCostUSD ? language1 : language2,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function roundToSixDecimals(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Format cost for display.
 */
export function formatCostUSD(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(6)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Format cost in INR for display.
 */
export function formatCostINR(cost: number): string {
  return `₹${cost.toFixed(2)}`;
}
