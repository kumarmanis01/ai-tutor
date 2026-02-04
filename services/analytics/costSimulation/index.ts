/**
 * FILE OBJECTIVE:
 * - Barrel export for cost simulation module.
 * - Provides clean public API for cost calculations.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/analytics/costSimulation/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created barrel export
 */

// ============================================================================
// ASSUMPTIONS & CONFIGURATION
// ============================================================================

export {
  MODEL_PRICING,
  LANGUAGE_TOKEN_MULTIPLIERS,
  FEATURE_TOKEN_BUDGETS,
  USAGE_PATTERNS,
  COST_MULTIPLIERS,
  FREE_TIER_LIMITS,
  PREMIUM_TIER_CONFIG,
  getGradeBand,
  getModelPricing,
  getLanguageMultiplier,
  getUsagePattern,
  calculateVolumeDiscount,
  type ModelName,
  type LanguageCode,
  type FeatureType,
  type GradeBand,
} from './assumptions';

// ============================================================================
// COST CALCULATOR
// ============================================================================

export {
  calculateRequestCost,
  calculateMonthlyStudentCost,
  calculateCohortCost,
  compareModelCosts,
  compareLanguageCosts,
  formatCostUSD,
  formatCostINR,
  type RequestCostBreakdown,
  type MonthlyStudentCost,
  type CostSimulationConfig,
} from './calculator';

// ============================================================================
// EXAMPLE SIMULATIONS
// ============================================================================

export {
  simulateGrade3StudentCost,
  simulateGrade8StudentCost,
  simulateCohort100Students,
  compareModelsForNotes,
  compareLanguageCostsForPractice,
  projectAnnualCosts,
  runAllExamples,
} from './examples';

// ============================================================================
// UNIT ECONOMICS SIMULATOR
// ============================================================================

export {
  simulateUnitEconomics,
  simulateBaseline,
  simulateWorstCase,
  simulateScale,
  checkTokenGovernorCompliance,
  type UnitEconomicsInput,
  type UnitEconomicsOutput,
} from './unitEconomics';
