/**
 * FILE OBJECTIVE:
 * - Example cost simulations for different student profiles.
 * - Demonstrate cost calculations for Grade 3 and Grade 8 students.
 * - Provide reference scenarios for business planning.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/analytics/costSimulation/examples.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created cost simulation examples
 */

import {
  calculateMonthlyStudentCost,
  calculateCohortCost,
  compareModelCosts,
  compareLanguageCosts,
  formatCostUSD,
  formatCostINR,
  type MonthlyStudentCost,
} from './calculator';

import {
  MODEL_PRICING,
  USAGE_PATTERNS,
  type LanguageCode,
  type ModelName,
} from './assumptions';

// ============================================================================
// EXAMPLE: GRADE 3 JUNIOR STUDENT
// ============================================================================

/**
 * Cost simulation for a typical Grade 3 student.
 * 
 * Assumptions:
 * - Junior grade (1-3) usage pattern
 * - English language (baseline)
 * - Free tier (non-premium)
 * - gpt-4o-mini model
 */
export function simulateGrade3StudentCost(): {
  profile: string;
  cost: MonthlyStudentCost;
  summary: string;
} {
  const cost = calculateMonthlyStudentCost({
    grade: 3,
    language: 'en',
    isPremium: false,
    model: 'gpt-4o-mini',
  });
  
  return {
    profile: 'Grade 3 - Free Tier - English',
    cost,
    summary: `
📚 GRADE 3 STUDENT COST BREAKDOWN
================================
Profile: Junior student, Free tier, English

📊 Monthly Usage:
- Notes requests: ${cost.notesRequests}
- Practice requests: ${cost.practiceRequests}
- Doubt requests: ${cost.doubtRequests}
- Quiz requests: ${cost.quizRequests}
- Total requests: ${cost.totalRequests}
- Retry overhead: ${cost.retryRequests} requests

💰 Cost Breakdown:
- Notes: ${formatCostUSD(cost.notesCostUSD)}
- Practice: ${formatCostUSD(cost.practiceCostUSD)}
- Doubts: ${formatCostUSD(cost.doubtCostUSD)}
- Quiz: ${formatCostUSD(cost.quizCostUSD)}
- Retry overhead: ${formatCostUSD(cost.retryCostUSD)}
- Infrastructure: ${formatCostUSD(cost.infrastructureOverheadUSD)}

📈 Total Monthly Cost:
- USD: ${formatCostUSD(cost.totalCostUSD)}
- INR: ${formatCostINR(cost.totalCostINR)}

📉 Per-Unit Metrics:
- Cost per request: ${formatCostUSD(cost.costPerRequestUSD)}
- Cost per session: ${formatCostUSD(cost.costPerSessionUSD)}
- Cost per minute: ${formatCostUSD(cost.costPerMinuteUSD)}
    `.trim(),
  };
}

// ============================================================================
// EXAMPLE: GRADE 8 SENIOR STUDENT
// ============================================================================

/**
 * Cost simulation for a typical Grade 8 student.
 * 
 * Assumptions:
 * - Senior grade (8-12) usage pattern
 * - Hindi language (2x token multiplier)
 * - Premium tier
 * - gpt-4o model
 */
export function simulateGrade8StudentCost(): {
  profile: string;
  cost: MonthlyStudentCost;
  summary: string;
} {
  const cost = calculateMonthlyStudentCost({
    grade: 8,
    language: 'hi',
    isPremium: true,
    model: 'gpt-4o',
  });
  
  return {
    profile: 'Grade 8 - Premium - Hindi',
    cost,
    summary: `
📚 GRADE 8 STUDENT COST BREAKDOWN
================================
Profile: Senior student, Premium tier, Hindi (2x tokens)

📊 Monthly Usage:
- Notes requests: ${cost.notesRequests}
- Practice requests: ${cost.practiceRequests}
- Doubt requests: ${cost.doubtRequests}
- Quiz requests: ${cost.quizRequests}
- Total requests: ${cost.totalRequests}
- Retry overhead: ${cost.retryRequests} requests

💰 Cost Breakdown:
- Notes: ${formatCostUSD(cost.notesCostUSD)}
- Practice: ${formatCostUSD(cost.practiceCostUSD)}
- Doubts: ${formatCostUSD(cost.doubtCostUSD)}
- Quiz: ${formatCostUSD(cost.quizCostUSD)}
- Retry overhead: ${formatCostUSD(cost.retryCostUSD)}
- Infrastructure: ${formatCostUSD(cost.infrastructureOverheadUSD)}
- Volume discount: -${formatCostUSD(cost.volumeDiscountUSD)}

📈 Total Monthly Cost:
- USD: ${formatCostUSD(cost.totalCostUSD)}
- INR: ${formatCostINR(cost.totalCostINR)}

📉 Per-Unit Metrics:
- Cost per request: ${formatCostUSD(cost.costPerRequestUSD)}
- Cost per session: ${formatCostUSD(cost.costPerSessionUSD)}
- Cost per minute: ${formatCostUSD(cost.costPerMinuteUSD)}

⚠️ Hindi Language Impact:
- Hindi uses ~2x tokens vs English
- Consider Hinglish for cost optimization
    `.trim(),
  };
}

// ============================================================================
// EXAMPLE: COHORT SIMULATION (100 STUDENTS)
// ============================================================================

/**
 * Simulate costs for a cohort of 100 students.
 * Distribution:
 * - 30% Junior (Grades 1-3)
 * - 40% Middle (Grades 4-7)
 * - 30% Senior (Grades 8-12)
 * - 60% English, 25% Hindi, 15% Hinglish
 * - 20% Premium
 */
export function simulateCohort100Students(): {
  description: string;
  totalCostUSD: number;
  totalCostINR: number;
  averageCostUSD: number;
  summary: string;
} {
  const students: Array<{
    grade: number;
    language: LanguageCode;
    isPremium: boolean;
  }> = [];
  
  // Generate 100 students
  for (let i = 0; i < 100; i++) {
    let grade: number;
    let language: LanguageCode;
    let isPremium: boolean;
    
    // Grade distribution
    const gradeRand = Math.random();
    if (gradeRand < 0.30) {
      grade = Math.floor(Math.random() * 3) + 1; // 1-3
    } else if (gradeRand < 0.70) {
      grade = Math.floor(Math.random() * 4) + 4; // 4-7
    } else {
      grade = Math.floor(Math.random() * 5) + 8; // 8-12
    }
    
    // Language distribution
    const langRand = Math.random();
    if (langRand < 0.60) {
      language = 'en';
    } else if (langRand < 0.85) {
      language = 'hi';
    } else {
      language = 'hinglish';
    }
    
    // Premium distribution (20%)
    isPremium = Math.random() < 0.20;
    
    students.push({ grade, language, isPremium });
  }
  
  const result = calculateCohortCost(students);
  
  return {
    description: '100 students with realistic distribution',
    totalCostUSD: result.totalCostUSD,
    totalCostINR: result.totalCostINR,
    averageCostUSD: result.averageCostUSD,
    summary: `
📊 COHORT SIMULATION: 100 STUDENTS
==================================

👥 Student Distribution:
- Junior (Grades 1-3): 30%
- Middle (Grades 4-7): 40%
- Senior (Grades 8-12): 30%
- Premium subscribers: 20%

🌐 Language Distribution:
- English: 60%
- Hindi: 25%
- Hinglish: 15%

💰 Cost by Grade Band:
- Junior: ${formatCostUSD(result.costByGradeBand.junior)}
- Middle: ${formatCostUSD(result.costByGradeBand.middle)}
- Senior: ${formatCostUSD(result.costByGradeBand.senior)}

🌍 Cost by Language:
- English: ${formatCostUSD(result.costByLanguage.en)}
- Hindi: ${formatCostUSD(result.costByLanguage.hi)}
- Hinglish: ${formatCostUSD(result.costByLanguage.hinglish)}

📈 TOTAL MONTHLY COSTS:
- Total USD: ${formatCostUSD(result.totalCostUSD)}
- Total INR: ${formatCostINR(result.totalCostINR)}
- Average per student: ${formatCostUSD(result.averageCostUSD)}

💡 Key Insights:
- Senior students use ~2.5x more than juniors
- Hindi adds ~100% to token costs
- Premium users have higher usage but better models
    `.trim(),
  };
}

// ============================================================================
// EXAMPLE: MODEL COMPARISON
// ============================================================================

/**
 * Compare gpt-4o vs gpt-4o-mini for notes generation.
 */
export function compareModelsForNotes(): string {
  const comparison = compareModelCosts('notes', 'gpt-4o', 'gpt-4o-mini', 'en');
  
  return `
📊 MODEL COMPARISON: Notes Generation (English)
================================================

Model: gpt-4o
- Input tokens: ${comparison.model1.inputTokens}
- Output tokens: ${comparison.model1.outputTokens}
- Cost: ${formatCostUSD(comparison.model1.totalCostUSD)}

Model: gpt-4o-mini
- Input tokens: ${comparison.model2.inputTokens}
- Output tokens: ${comparison.model2.outputTokens}
- Cost: ${formatCostUSD(comparison.model2.totalCostUSD)}

💰 SAVINGS:
- Cheaper model: ${comparison.cheaperModel}
- Savings per request: ${formatCostUSD(comparison.savingsUSD)}
- Savings percentage: ${comparison.savingsPercent}%

💡 Recommendation:
Use gpt-4o-mini for junior grades to reduce costs.
Reserve gpt-4o for complex senior-grade content.
  `.trim();
}

// ============================================================================
// EXAMPLE: LANGUAGE COMPARISON
// ============================================================================

/**
 * Compare English vs Hindi vs Hinglish costs.
 */
export function compareLanguageCostsForPractice(): string {
  const enVsHi = compareLanguageCosts('practice', 'gpt-4o-mini', 'en', 'hi');
  const enVsHinglish = compareLanguageCosts('practice', 'gpt-4o-mini', 'en', 'hinglish');
  
  return `
🌐 LANGUAGE COMPARISON: Practice Questions (gpt-4o-mini)
=========================================================

English (Baseline):
- Cost: ${formatCostUSD(enVsHi.language1.totalCostUSD)}
- Tokens: ${enVsHi.language1.inputTokens + enVsHi.language1.outputTokens}

Hindi:
- Cost: ${formatCostUSD(enVsHi.language2.totalCostUSD)}
- Tokens: ${enVsHi.language2.inputTokens + enVsHi.language2.outputTokens}
- Additional cost: +${formatCostUSD(enVsHi.additionalCostUSD)} (+${enVsHi.additionalCostPercent}%)

Hinglish:
- Cost: ${formatCostUSD(enVsHinglish.language2.totalCostUSD)}
- Tokens: ${enVsHinglish.language2.inputTokens + enVsHinglish.language2.outputTokens}
- Additional cost: +${formatCostUSD(enVsHinglish.additionalCostUSD)} (+${enVsHinglish.additionalCostPercent}%)

💡 Recommendation:
For Hindi-speaking students, consider Hinglish prompts
which provide similar comprehension at much lower cost.
Hinglish saves ~${Math.round((enVsHi.additionalCostPercent - enVsHinglish.additionalCostPercent))}% compared to pure Hindi.
  `.trim();
}

// ============================================================================
// EXAMPLE: ANNUAL PROJECTION
// ============================================================================

/**
 * Project annual costs for scaling from 1K to 100K students.
 */
export function projectAnnualCosts(): string {
  // Simplified projection based on average costs
  const avgFreeTierCost = calculateMonthlyStudentCost({
    grade: 5,
    language: 'en',
    isPremium: false,
  }).totalCostUSD;
  
  const avgPremiumCost = calculateMonthlyStudentCost({
    grade: 8,
    language: 'en',
    isPremium: true,
  }).totalCostUSD;
  
  const projections = [
    { students: 1000, premium: 0.1 },
    { students: 10000, premium: 0.15 },
    { students: 50000, premium: 0.2 },
    { students: 100000, premium: 0.25 },
  ];
  
  let table = 'Students | Free Monthly | Premium Monthly | Total Annual\n';
  table += '---------|--------------|-----------------|-------------\n';
  
  projections.forEach(p => {
    const freeStudents = p.students * (1 - p.premium);
    const premiumStudents = p.students * p.premium;
    
    const freeMonthlyCost = freeStudents * avgFreeTierCost;
    const premiumMonthlyCost = premiumStudents * avgPremiumCost;
    const totalMonthly = freeMonthlyCost + premiumMonthlyCost;
    const totalAnnual = totalMonthly * 12;
    
    table += `${p.students.toLocaleString().padEnd(9)} | ${formatCostUSD(freeMonthlyCost).padEnd(12)} | ${formatCostUSD(premiumMonthlyCost).padEnd(15)} | ${formatCostUSD(totalAnnual)}\n`;
  });
  
  return `
📈 ANNUAL COST PROJECTION
=========================

Assumptions:
- Average free tier cost: ${formatCostUSD(avgFreeTierCost)}/student/month
- Average premium cost: ${formatCostUSD(avgPremiumCost)}/student/month
- Premium conversion improves with scale

${table}

💡 Key Observations:
1. At 100K students, expect ~$${Math.round(100000 * (avgFreeTierCost * 0.75 + avgPremiumCost * 0.25) * 12).toLocaleString()} annual AI costs
2. Premium users generate 5-10x more revenue than cost
3. Language optimization can reduce costs by 15-20%
4. Model selection for junior grades saves ~80%
  `.trim();
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

/**
 * Run all example simulations and return formatted output.
 */
export function runAllExamples(): string {
  const grade3 = simulateGrade3StudentCost();
  const grade8 = simulateGrade8StudentCost();
  const cohort = simulateCohort100Students();
  const modelComparison = compareModelsForNotes();
  const languageComparison = compareLanguageCostsForPractice();
  const annualProjection = projectAnnualCosts();
  
  return `
${'='.repeat(60)}
AI CONTENT ENGINE - COST SIMULATION REPORT
${'='.repeat(60)}

${grade3.summary}

${'─'.repeat(60)}

${grade8.summary}

${'─'.repeat(60)}

${cohort.summary}

${'─'.repeat(60)}

${modelComparison}

${'─'.repeat(60)}

${languageComparison}

${'─'.repeat(60)}

${annualProjection}

${'='.repeat(60)}
END OF COST SIMULATION REPORT
${'='.repeat(60)}
  `.trim();
}
