/**
 * FILE OBJECTIVE:
 * - Token governor: enforces per-request token budgets based on grade band.
 * - Selects cheapest viable model per grade.
 * - Provides middleware for callLLM to enforce ceilings.
 * - Critical for ₹199/month unit economics sustainability.
 *
 * Token Budget Strategy:
 *   Grade 1-3:  300-500  tokens → gpt-4o-mini (gpt-4.1-mini equivalent)
 *   Grade 4-6:  600-900  tokens → gpt-4o-mini
 *   Grade 7-8:  900-1200 tokens → gpt-4o
 *   Grade 9-10: 1200-1600 tokens → gpt-4o
 *   Recovery:   ≤300 tokens     → gpt-4o-mini
 *
 * Hard rule: No student costs more than ₹40/month in tokens.
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created token governor with grade-based budgets
 */

import { logger } from '@/lib/logger';

// ── Budget table ───────────────────────────────────────────────────

export interface TokenBudget {
  maxTokens: number;
  model: string;
  gradeBand: string;
}

const GRADE_BUDGETS: Record<string, { min: number; max: number; model: string }> = {
  'junior':   { min: 300,  max: 500,  model: 'gpt-4o-mini' },   // Grade 1-3
  'middle':   { min: 600,  max: 900,  model: 'gpt-4o-mini' },   // Grade 4-6
  'upper':    { min: 900,  max: 1200, model: 'gpt-4o' },        // Grade 7-8
  'senior':   { min: 1200, max: 1600, model: 'gpt-4o' },        // Grade 9-10
  'recovery': { min: 150,  max: 300,  model: 'gpt-4o-mini' },   // Recovery tasks
};

// Feature-level overrides (daily_task, parent_report use smaller budgets)
const FEATURE_BUDGET_OVERRIDES: Record<string, { maxMultiplier: number; forceModel?: string }> = {
  'daily_task':     { maxMultiplier: 0.8 },             // 80% of grade budget
  'parent_report':  { maxMultiplier: 0.6, forceModel: 'gpt-4o-mini' }, // Always cheap
  'recovery_task':  { maxMultiplier: 0.5, forceModel: 'gpt-4o-mini' }, // Ultra cheap
};

// Monthly cost ceiling per student (₹40 ≈ $0.48 at ₹83/$)
const MONTHLY_COST_CEILING_USD = 0.48;

// ── Public API ─────────────────────────────────────────────────────

/**
 * Resolve the token budget and model for a given grade + feature.
 */
export function resolveTokenBudget(grade: number, feature?: string): TokenBudget {
  const gradeBand = getGradeBand(grade);
  const baseBudget = GRADE_BUDGETS[gradeBand] || GRADE_BUDGETS['middle'];

  let maxTokens = baseBudget.max;
  let model = baseBudget.model;

  // Apply feature overrides
  if (feature && FEATURE_BUDGET_OVERRIDES[feature]) {
    const override = FEATURE_BUDGET_OVERRIDES[feature];
    maxTokens = Math.round(baseBudget.max * override.maxMultiplier);
    if (override.forceModel) {
      model = override.forceModel;
    }
  }

  return { maxTokens, model, gradeBand };
}

/**
 * Enforce token ceiling on a prompt. Returns adjusted prompt if too long.
 * Truncates context, not core instruction.
 */
export function enforceTokenCeiling(
  prompt: string,
  grade: number,
  feature?: string,
): { prompt: string; budget: TokenBudget; truncated: boolean } {
  const budget = resolveTokenBudget(grade, feature);

  // Rough estimate: 1 token ≈ 4 characters (English)
  // Hindi multiplier: 2x tokens per character
  const charLimit = budget.maxTokens * 4;

  if (prompt.length <= charLimit) {
    return { prompt, budget, truncated: false };
  }

  // Truncation strategy: keep system instructions, trim context
  const parts = prompt.split('INSTRUCTIONS:');
  if (parts.length === 2) {
    // Keep instructions, truncate context
    const contextPart = parts[0];
    const instructionsPart = parts[1];
    const instructionsLen = instructionsPart.length;
    const remainingBudget = charLimit - instructionsLen - 20; // 20 for separator

    if (remainingBudget > 100) {
      const truncatedContext = contextPart.slice(0, remainingBudget) + '...';
      return {
        prompt: truncatedContext + 'INSTRUCTIONS:' + instructionsPart,
        budget,
        truncated: true,
      };
    }
  }

  // Fallback: hard truncation
  const truncated = prompt.slice(0, charLimit);
  logger.warn('tokenGovernor.hardTruncation', {
    grade,
    feature,
    originalLength: prompt.length,
    truncatedLength: truncated.length,
    maxTokens: budget.maxTokens,
  });

  return { prompt: truncated, budget, truncated: true };
}

/**
 * Check if a student has exceeded their monthly token cost ceiling.
 * Returns true if within budget, false if exceeded.
 */
export function isWithinMonthlyCeiling(
  monthlySpendUsd: number,
): boolean {
  return monthlySpendUsd < MONTHLY_COST_CEILING_USD;
}

/**
 * Select the cheapest viable model. Falls back to mini if budget is tight.
 */
export function selectCheapestModel(
  grade: number,
  monthlySpendUsd: number,
  feature?: string,
): string {
  const budget = resolveTokenBudget(grade, feature);

  // If approaching 80% of monthly ceiling, force cheapest model
  if (monthlySpendUsd >= MONTHLY_COST_CEILING_USD * 0.8) {
    return 'gpt-4o-mini';
  }

  return budget.model;
}

/**
 * Estimate cost for a single request based on grade and feature.
 * Returns estimated USD cost.
 */
export function estimateRequestCost(grade: number, feature?: string): number {
  const budget = resolveTokenBudget(grade, feature);

  // Pricing per 1M tokens
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4o':      { input: 2.50, output: 10.00 },
  };

  const modelPrice = pricing[budget.model] || pricing['gpt-4o-mini'];

  // Assume 40% input, 60% output split
  const inputTokens = Math.round(budget.maxTokens * 0.4);
  const outputTokens = Math.round(budget.maxTokens * 0.6);

  const cost = (inputTokens * modelPrice.input / 1_000_000) +
               (outputTokens * modelPrice.output / 1_000_000);

  return cost;
}

// ── Internal helpers ───────────────────────────────────────────────

function getGradeBand(grade: number): string {
  if (grade <= 3) return 'junior';
  if (grade <= 6) return 'middle';
  if (grade <= 8) return 'upper';
  return 'senior';
}
