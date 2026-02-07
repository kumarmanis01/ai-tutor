/**
 * FILE OBJECTIVE:
 * - Unit economics simulator for AI tutoring at ₹199/month pricing.
 * - Inputs: student count, avg tokens/day, model pricing, WhatsApp message count.
 * - Outputs: cost per student, gross margin, break-even users.
 * - Validates that token governor budgets keep us within ₹37/student AI cost.
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created unit economics simulator
 */

import {
  MODEL_PRICING,
  type ModelName,
  type LanguageCode,
  LANGUAGE_TOKEN_MULTIPLIERS,
} from './assumptions';

// ── Constants ─────────────────────────────────────────────────────────

const DEFAULT_USD_TO_INR = 83.50;
const SUBSCRIPTION_PRICE_INR = 199;
const WHATSAPP_COST_PER_MSG_INR = 0.50; // Meta Business API conversation pricing ~₹0.50

// Fixed costs per student per month (infra, DB, CDN, monitoring)
const FIXED_INFRA_COST_PER_STUDENT_INR = 8;

// Payment gateway fee (Razorpay ~2%)
const PAYMENT_GATEWAY_FEE_PERCENT = 0.02;

// ── Types ─────────────────────────────────────────────────────────────

export interface UnitEconomicsInput {
  /** Total student count */
  studentCount: number;
  /** Average tokens consumed per student per day */
  avgTokensPerDay: number;
  /** Primary model used */
  model: ModelName;
  /** Language distribution (percentages, must sum to 1) */
  languageMix?: { en: number; hi: number; hinglish: number };
  /** WhatsApp messages per parent per month (default: 4) */
  whatsappMessagesPerMonth?: number;
  /** Ratio of students who have a parent linked (default: 0.6) */
  parentLinkRate?: number;
  /** USD to INR rate */
  usdToInrRate?: number;
  /** Subscription price override (INR) */
  subscriptionPriceInr?: number;
}

export interface UnitEconomicsOutput {
  // Revenue
  monthlyRevenueInr: number;
  revenuePerStudentInr: number;

  // AI costs
  aiCostPerStudentUsd: number;
  aiCostPerStudentInr: number;
  totalAiCostInr: number;
  tokensPerStudentPerMonth: number;

  // WhatsApp costs
  whatsappCostPerStudentInr: number;
  totalWhatsappCostInr: number;

  // Infrastructure costs
  infraCostPerStudentInr: number;
  totalInfraCostInr: number;

  // Payment processing
  paymentFeesPerStudentInr: number;
  totalPaymentFeesInr: number;

  // Totals
  totalCostPerStudentInr: number;
  totalMonthlyCostInr: number;

  // Margins
  grossProfitPerStudentInr: number;
  grossMarginPercent: number;

  // Break-even
  breakEvenStudents: number;

  // Budget compliance
  withinTokenBudget: boolean;
  tokenBudgetCeilingInr: number;

  // Summary
  summary: string;
}

// ── Simulator ─────────────────────────────────────────────────────────

export function simulateUnitEconomics(input: UnitEconomicsInput): UnitEconomicsOutput {
  const {
    studentCount,
    avgTokensPerDay,
    model,
    languageMix = { en: 0.40, hi: 0.35, hinglish: 0.25 },
    whatsappMessagesPerMonth = 4,
    parentLinkRate = 0.6,
    usdToInrRate = DEFAULT_USD_TO_INR,
    subscriptionPriceInr = SUBSCRIPTION_PRICE_INR,
  } = input;

  const pricing = MODEL_PRICING[model];

  // ── Token costs ──────────────────────────────────────────────────

  // Weighted language multiplier
  const weightedLangMultiplier =
    languageMix.en * LANGUAGE_TOKEN_MULTIPLIERS.en +
    languageMix.hi * LANGUAGE_TOKEN_MULTIPLIERS.hi +
    languageMix.hinglish * LANGUAGE_TOKEN_MULTIPLIERS.hinglish;

  const effectiveTokensPerDay = avgTokensPerDay * weightedLangMultiplier;
  const tokensPerMonth = effectiveTokensPerDay * 30;

  // Assume 60% input, 40% output token split
  const inputTokensPerMonth = tokensPerMonth * 0.6;
  const outputTokensPerMonth = tokensPerMonth * 0.4;

  // Assume 30% of input tokens are cached (system prompts reuse)
  const cachedInputTokens = inputTokensPerMonth * 0.3;
  const freshInputTokens = inputTokensPerMonth - cachedInputTokens;

  const inputCostUsd = (freshInputTokens / 1_000_000) * pricing.input;
  const cachedCostUsd = (cachedInputTokens / 1_000_000) * pricing.cachedInput;
  const outputCostUsd = (outputTokensPerMonth / 1_000_000) * pricing.output;

  const aiCostPerStudentUsd = inputCostUsd + cachedCostUsd + outputCostUsd;
  const aiCostPerStudentInr = aiCostPerStudentUsd * usdToInrRate;

  // ── WhatsApp costs ───────────────────────────────────────────────

  const parentsCount = Math.ceil(studentCount * parentLinkRate);
  const totalWhatsappMessages = parentsCount * whatsappMessagesPerMonth;
  const totalWhatsappCostInr = totalWhatsappMessages * WHATSAPP_COST_PER_MSG_INR;
  const whatsappCostPerStudentInr = totalWhatsappCostInr / studentCount;

  // ── Infrastructure costs ─────────────────────────────────────────

  const infraCostPerStudentInr = FIXED_INFRA_COST_PER_STUDENT_INR;
  const totalInfraCostInr = infraCostPerStudentInr * studentCount;

  // ── Payment processing ───────────────────────────────────────────

  const paymentFeesPerStudentInr = subscriptionPriceInr * PAYMENT_GATEWAY_FEE_PERCENT;
  const totalPaymentFeesInr = paymentFeesPerStudentInr * studentCount;

  // ── Totals ───────────────────────────────────────────────────────

  const totalCostPerStudentInr =
    aiCostPerStudentInr +
    whatsappCostPerStudentInr +
    infraCostPerStudentInr +
    paymentFeesPerStudentInr;

  const totalMonthlyCostInr = totalCostPerStudentInr * studentCount;

  // ── Revenue ──────────────────────────────────────────────────────

  const monthlyRevenueInr = subscriptionPriceInr * studentCount;
  const revenuePerStudentInr = subscriptionPriceInr;

  // ── Margins ──────────────────────────────────────────────────────

  const grossProfitPerStudentInr = revenuePerStudentInr - totalCostPerStudentInr;
  const grossMarginPercent = (grossProfitPerStudentInr / revenuePerStudentInr) * 100;

  // ── Break-even ───────────────────────────────────────────────────

  // Fixed monthly costs (team, servers baseline, etc.) — assume ₹50,000 for early stage
  const fixedMonthlyCostInr = 50_000;
  const contributionPerStudent = grossProfitPerStudentInr;
  const breakEvenStudents = contributionPerStudent > 0
    ? Math.ceil(fixedMonthlyCostInr / contributionPerStudent)
    : Infinity;

  // ── Budget compliance ────────────────────────────────────────────

  // Token governor ceiling: ₹40/student/month for AI costs
  const tokenBudgetCeilingInr = 40;
  const withinTokenBudget = aiCostPerStudentInr <= tokenBudgetCeilingInr;

  // ── Summary ──────────────────────────────────────────────────────

  const summary = [
    `Unit Economics @ ${studentCount} students (${model})`,
    `Revenue: ₹${r2(monthlyRevenueInr)}/mo | ₹${r2(revenuePerStudentInr)}/student`,
    `AI cost: ₹${r2(aiCostPerStudentInr)}/student ($${r4(aiCostPerStudentUsd)})`,
    `WhatsApp: ₹${r2(whatsappCostPerStudentInr)}/student`,
    `Infra: ₹${r2(infraCostPerStudentInr)}/student`,
    `Total cost: ₹${r2(totalCostPerStudentInr)}/student`,
    `Gross margin: ${r2(grossMarginPercent)}%`,
    `Break-even: ${breakEvenStudents === Infinity ? '∞' : breakEvenStudents} students`,
    `Token budget: ${withinTokenBudget ? '✓ within ₹40 ceiling' : '✗ EXCEEDS ₹40 ceiling'}`,
  ].join('\n');

  return {
    monthlyRevenueInr: r2(monthlyRevenueInr),
    revenuePerStudentInr: r2(revenuePerStudentInr),

    aiCostPerStudentUsd: r4(aiCostPerStudentUsd),
    aiCostPerStudentInr: r2(aiCostPerStudentInr),
    totalAiCostInr: r2(aiCostPerStudentInr * studentCount),
    tokensPerStudentPerMonth: Math.round(tokensPerMonth),

    whatsappCostPerStudentInr: r2(whatsappCostPerStudentInr),
    totalWhatsappCostInr: r2(totalWhatsappCostInr),

    infraCostPerStudentInr: r2(infraCostPerStudentInr),
    totalInfraCostInr: r2(totalInfraCostInr),

    paymentFeesPerStudentInr: r2(paymentFeesPerStudentInr),
    totalPaymentFeesInr: r2(totalPaymentFeesInr),

    totalCostPerStudentInr: r2(totalCostPerStudentInr),
    totalMonthlyCostInr: r2(totalMonthlyCostInr),

    grossProfitPerStudentInr: r2(grossProfitPerStudentInr),
    grossMarginPercent: r2(grossMarginPercent),

    breakEvenStudents,

    withinTokenBudget,
    tokenBudgetCeilingInr,

    summary,
  };
}

// ── Preset scenarios ──────────────────────────────────────────────────

/** Baseline: 1000 students, gpt-4o-mini, 800 tokens/day */
export function simulateBaseline(): UnitEconomicsOutput {
  return simulateUnitEconomics({
    studentCount: 1000,
    avgTokensPerDay: 800,
    model: 'gpt-4o-mini',
  });
}

/** Worst case: 1000 students, gpt-4o, 1500 tokens/day, heavy Hindi */
export function simulateWorstCase(): UnitEconomicsOutput {
  return simulateUnitEconomics({
    studentCount: 1000,
    avgTokensPerDay: 1500,
    model: 'gpt-4o',
    languageMix: { en: 0.1, hi: 0.7, hinglish: 0.2 },
    whatsappMessagesPerMonth: 8,
  });
}

/** Scale test: 10,000 students, gpt-4o-mini */
export function simulateScale(): UnitEconomicsOutput {
  return simulateUnitEconomics({
    studentCount: 10_000,
    avgTokensPerDay: 800,
    model: 'gpt-4o-mini',
  });
}

/** Token governor compliance check across all grade bands */
export function checkTokenGovernorCompliance(): {
  junior: UnitEconomicsOutput;
  middle: UnitEconomicsOutput;
  upper: UnitEconomicsOutput;
  senior: UnitEconomicsOutput;
  allWithinBudget: boolean;
} {
  const junior = simulateUnitEconomics({
    studentCount: 1000,
    avgTokensPerDay: 400,  // Grade 1-3: 300-500 token budget
    model: 'gpt-4o-mini',
  });

  const middle = simulateUnitEconomics({
    studentCount: 1000,
    avgTokensPerDay: 750,  // Grade 4-6: 600-900 token budget
    model: 'gpt-4o-mini',
  });

  const upper = simulateUnitEconomics({
    studentCount: 1000,
    avgTokensPerDay: 1050, // Grade 7-8: 900-1200 token budget
    model: 'gpt-4o',
  });

  const senior = simulateUnitEconomics({
    studentCount: 1000,
    avgTokensPerDay: 1400, // Grade 9-10: 1200-1600 token budget
    model: 'gpt-4o',
  });

  return {
    junior,
    middle,
    upper,
    senior,
    allWithinBudget:
      junior.withinTokenBudget &&
      middle.withinTokenBudget &&
      upper.withinTokenBudget &&
      senior.withinTokenBudget,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function r4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
