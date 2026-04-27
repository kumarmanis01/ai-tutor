/**
 * FILE OBJECTIVE:
 * - Pilot Experiment Analyzer for silent launch validation.
 * - Analyzes retention, completion, and parent engagement.
 * - Provides brutal Go/No-Go recommendation.
 * - Prefer delaying launch over false confidence.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/pilot/pilotAnalyzer.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created pilot analyzer
 */

// ============================================================================
// TYPES & ENUMS
// ============================================================================

/**
 * Pilot recommendation
 */
export enum PilotRecommendation {
  GO = 'go',
  NO_GO = 'no_go',
  EXTEND_PILOT = 'extend_pilot',
  PIVOT_REQUIRED = 'pivot_required',
}

/**
 * Student activity record for a day
 */
export interface DailyActivity {
  readonly studentId: string;
  readonly date: string;
  readonly dayNumber: number;
  readonly completed: boolean;
  readonly timeSpentMinutes: number;
  readonly questionsAttempted: number;
  readonly questionsCorrect: number;
  readonly droppedMidTask: boolean;
}

/**
 * Parent interaction record
 */
export interface ParentInteraction {
  readonly parentId: string;
  readonly studentId: string;
  readonly date: string;
  readonly messageType: 'day1_soft' | 'day4_progress' | 'day7_celebration';
  readonly opened: boolean;
  readonly replied: boolean;
  readonly sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
}

/**
 * Confusion report from student
 */
export interface ConfusionReport {
  readonly studentId: string;
  readonly date: string;
  readonly questionId: string;
  readonly confusionType: 'unclear_question' | 'wrong_answer' | 'ui_issue' | 'other';
  readonly description: string;
}

/**
 * Pilot cohort configuration
 */
export interface PilotCohort {
  readonly cohortId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly targetSize: number;
  readonly actualSize: number;
  readonly grades: number[];
  readonly pricing: 'free' | 'paid_99';
  readonly region: string;
}

/**
 * Retention data point
 */
export interface RetentionPoint {
  readonly day: number;
  readonly totalStudents: number;
  readonly activeStudents: number;
  readonly retentionRate: number;
}

/**
 * Failure hotspot
 */
export interface FailureHotspot {
  readonly questionId: string;
  readonly failureCount: number;
  readonly attemptCount: number;
  readonly failureRate: number;
  readonly commonError: string;
}

/**
 * Pilot analysis result
 */
export interface PilotAnalysis {
  readonly cohortId: string;
  readonly analysisDate: string;
  readonly durationDays: number;
  
  // Key metrics
  readonly day1CompletionRate: number;
  readonly day3RetentionRate: number;
  readonly day7RetentionRate: number;
  readonly overallTaskCompletionRate: number;
  readonly parentWhatsAppOpenRate: number;
  
  // Retention curve
  readonly retentionCurve: RetentionPoint[];
  
  // Failure analysis
  readonly failureHotspots: FailureHotspot[];
  readonly confusionReports: ConfusionReport[];
  
  // Parent feedback
  readonly parentSentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  
  // Final recommendation
  readonly recommendation: PilotRecommendation;
  readonly recommendationReason: string;
  readonly criticalIssues: string[];
  readonly improvements: string[];
}

// ============================================================================
// SUCCESS CRITERIA (BRUTAL)
// ============================================================================

/**
 * Success criteria thresholds
 * If these fail → do not scale.
 */
export const SUCCESS_CRITERIA = {
  /** Minimum Day 7 retention rate */
  minDay7Retention: 60,
  /** Minimum task completion rate */
  minTaskCompletion: 70,
  /** Minimum parent WhatsApp open rate */
  minParentOpenRate: 50,
  /** Maximum acceptable confusion reports per 100 students */
  maxConfusionPer100: 10,
  /** Maximum acceptable negative parent sentiment */
  maxNegativeSentiment: 10,
} as const;

// ============================================================================
// CORE ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Calculate retention curve from daily activity
 */
export function calculateRetentionCurve(
  activities: DailyActivity[],
  totalStudents: number,
  maxDays: number = 21
): RetentionPoint[] {
  const curve: RetentionPoint[] = [];
  
  for (let day = 1; day <= maxDays; day++) {
    const dayActivities = activities.filter(a => a.dayNumber === day);
    const activeStudents = new Set(dayActivities.filter(a => a.completed).map(a => a.studentId)).size;
    const retentionRate = (activeStudents / totalStudents) * 100;
    
    curve.push({
      day,
      totalStudents,
      activeStudents,
      retentionRate: Math.round(retentionRate * 10) / 10,
    });
  }
  
  return curve;
}

/**
 * Calculate Day-N retention rate
 */
export function getDayRetention(curve: RetentionPoint[], day: number): number {
  const point = curve.find(p => p.day === day);
  return point?.retentionRate || 0;
}

/**
 * Identify failure hotspots (questions with >40% failure)
 */
export function identifyFailureHotspots(
  activities: DailyActivity[],
  questionFailures: Map<string, { failures: number; attempts: number; commonError: string }>
): FailureHotspot[] {
  const hotspots: FailureHotspot[] = [];
  
  questionFailures.forEach((data, questionId) => {
    const failureRate = (data.failures / data.attempts) * 100;
    if (failureRate >= 30) { // Flag anything over 30%
      hotspots.push({
        questionId,
        failureCount: data.failures,
        attemptCount: data.attempts,
        failureRate: Math.round(failureRate * 10) / 10,
        commonError: data.commonError,
      });
    }
  });
  
  // Sort by failure rate descending
  return hotspots.sort((a, b) => b.failureRate - a.failureRate);
}

/**
 * Calculate parent engagement metrics
 */
export function calculateParentEngagement(
  interactions: ParentInteraction[]
): {
  openRate: number;
  replyRate: number;
  sentiment: { positive: number; neutral: number; negative: number };
} {
  const total = interactions.length;
  if (total === 0) {
    return { openRate: 0, replyRate: 0, sentiment: { positive: 0, neutral: 0, negative: 0 } };
  }
  
  const opened = interactions.filter(i => i.opened).length;
  const replied = interactions.filter(i => i.replied).length;
  
  const sentiment = {
    positive: interactions.filter(i => i.sentiment === 'positive').length,
    neutral: interactions.filter(i => i.sentiment === 'neutral').length,
    negative: interactions.filter(i => i.sentiment === 'negative').length,
  };
  
  return {
    openRate: Math.round((opened / total) * 100),
    replyRate: Math.round((replied / total) * 100),
    sentiment,
  };
}

/**
 * Determine Go/No-Go recommendation
 * Be brutally honest. Prefer delaying launch over false confidence.
 */
export function determineRecommendation(
  day7Retention: number,
  taskCompletionRate: number,
  parentOpenRate: number,
  confusionReportsPer100: number,
  negativeSentimentPercent: number
): { recommendation: PilotRecommendation; reason: string; criticalIssues: string[] } {
  const criticalIssues: string[] = [];
  
  // Check each criterion
  if (day7Retention < SUCCESS_CRITERIA.minDay7Retention) {
    criticalIssues.push(`Day 7 retention (${day7Retention}%) below minimum (${SUCCESS_CRITERIA.minDay7Retention}%)`);
  }
  
  if (taskCompletionRate < SUCCESS_CRITERIA.minTaskCompletion) {
    criticalIssues.push(`Task completion (${taskCompletionRate}%) below minimum (${SUCCESS_CRITERIA.minTaskCompletion}%)`);
  }
  
  if (parentOpenRate < SUCCESS_CRITERIA.minParentOpenRate) {
    criticalIssues.push(`Parent open rate (${parentOpenRate}%) below minimum (${SUCCESS_CRITERIA.minParentOpenRate}%)`);
  }
  
  if (confusionReportsPer100 > SUCCESS_CRITERIA.maxConfusionPer100) {
    criticalIssues.push(`Confusion reports (${confusionReportsPer100}/100) above maximum (${SUCCESS_CRITERIA.maxConfusionPer100}/100)`);
  }
  
  if (negativeSentimentPercent > SUCCESS_CRITERIA.maxNegativeSentiment) {
    criticalIssues.push(`Negative sentiment (${negativeSentimentPercent}%) above maximum (${SUCCESS_CRITERIA.maxNegativeSentiment}%)`);
  }
  
  // Decision logic
  if (criticalIssues.length === 0) {
    return {
      recommendation: PilotRecommendation.GO,
      reason: 'All success criteria met. Ready for controlled scale.',
      criticalIssues: [],
    };
  }
  
  if (criticalIssues.length <= 2 && day7Retention >= 50 && taskCompletionRate >= 60) {
    return {
      recommendation: PilotRecommendation.EXTEND_PILOT,
      reason: 'Some criteria not met. Extend pilot with targeted fixes.',
      criticalIssues,
    };
  }
  
  if (day7Retention < 40 || taskCompletionRate < 50) {
    return {
      recommendation: PilotRecommendation.PIVOT_REQUIRED,
      reason: 'Core metrics critically low. Fundamental changes needed.',
      criticalIssues,
    };
  }
  
  return {
    recommendation: PilotRecommendation.NO_GO,
    reason: 'Multiple critical issues. Do not scale until resolved.',
    criticalIssues,
  };
}

/**
 * Generate improvement suggestions based on analysis
 */
export function generateImprovements(
  analysis: Partial<PilotAnalysis>
): string[] {
  const improvements: string[] = [];
  
  if ((analysis.day1CompletionRate || 0) < 80) {
    improvements.push('Day 1 completion low - simplify onboarding further');
  }
  
  if ((analysis.day3RetentionRate || 0) < 70) {
    improvements.push('Day 3 drop-off high - add more engagement hooks in first 3 days');
  }
  
  if ((analysis.day7RetentionRate || 0) < 60) {
    improvements.push('Week 1 retention critical - review entire first-week journey');
  }
  
  if ((analysis.failureHotspots?.length || 0) > 5) {
    improvements.push('Multiple question issues - review and fix/disable problematic questions');
  }
  
  if ((analysis.parentWhatsAppOpenRate || 0) < 50) {
    improvements.push('Parent engagement low - revise message timing and content');
  }
  
  if ((analysis.parentSentiment?.negative || 0) > 10) {
    improvements.push('Negative parent feedback - analyze complaints and address root causes');
  }
  
  if (improvements.length === 0) {
    improvements.push('Consider A/B testing minor optimizations');
  }
  
  return improvements;
}

/**
 * Main analysis function - run complete pilot analysis
 */
export function analyzePilot(
  cohort: PilotCohort,
  activities: DailyActivity[],
  parentInteractions: ParentInteraction[],
  confusionReports: ConfusionReport[],
  questionFailures: Map<string, { failures: number; attempts: number; commonError: string }>
): PilotAnalysis {
  // Calculate retention curve
  const retentionCurve = calculateRetentionCurve(activities, cohort.actualSize, 21);
  
  // Get key retention points
  const day1Completion = getDayRetention(retentionCurve, 1);
  const day3Retention = getDayRetention(retentionCurve, 3);
  const day7Retention = getDayRetention(retentionCurve, 7);
  
  // Calculate task completion
  const totalTasks = activities.length;
  const completedTasks = activities.filter(a => a.completed).length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Parent engagement
  const parentEngagement = calculateParentEngagement(parentInteractions);
  
  // Failure hotspots
  const failureHotspots = identifyFailureHotspots(activities, questionFailures);
  
  // Confusion reports per 100 students
  const confusionPer100 = Math.round((confusionReports.length / cohort.actualSize) * 100);
  
  // Negative sentiment percentage
  const totalSentiment = parentEngagement.sentiment.positive + 
    parentEngagement.sentiment.neutral + 
    parentEngagement.sentiment.negative;
  const negativeSentimentPercent = totalSentiment > 0
    ? Math.round((parentEngagement.sentiment.negative / totalSentiment) * 100)
    : 0;
  
  // Get recommendation
  const { recommendation, reason, criticalIssues } = determineRecommendation(
    day7Retention,
    taskCompletionRate,
    parentEngagement.openRate,
    confusionPer100,
    negativeSentimentPercent
  );
  
  // Build partial analysis for improvements
  const partialAnalysis: Partial<PilotAnalysis> = {
    day1CompletionRate: day1Completion,
    day3RetentionRate: day3Retention,
    day7RetentionRate: day7Retention,
    failureHotspots,
    parentWhatsAppOpenRate: parentEngagement.openRate,
    parentSentiment: parentEngagement.sentiment,
  };
  
  const improvements = generateImprovements(partialAnalysis);
  
  // Calculate duration
  const startDate = new Date(cohort.startDate);
  const analysisDate = new Date();
  const durationDays = Math.floor((analysisDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    cohortId: cohort.cohortId,
    analysisDate: analysisDate.toISOString(),
    durationDays,
    
    day1CompletionRate: day1Completion,
    day3RetentionRate: day3Retention,
    day7RetentionRate: day7Retention,
    overallTaskCompletionRate: taskCompletionRate,
    parentWhatsAppOpenRate: parentEngagement.openRate,
    
    retentionCurve,
    failureHotspots,
    confusionReports,
    parentSentiment: parentEngagement.sentiment,
    
    recommendation,
    recommendationReason: reason,
    criticalIssues,
    improvements,
  };
}

/**
 * Format analysis as human-readable report
 */
export function formatReport(analysis: PilotAnalysis): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '                    PILOT ANALYSIS REPORT                      ',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Cohort: ${analysis.cohortId}`,
    `Analysis Date: ${analysis.analysisDate}`,
    `Duration: ${analysis.durationDays} days`,
    '',
    '─── KEY METRICS ───────────────────────────────────────────────',
    `Day 1 Completion:     ${analysis.day1CompletionRate}%`,
    `Day 3 Retention:      ${analysis.day3RetentionRate}%`,
    `Day 7 Retention:      ${analysis.day7RetentionRate}% (target: ≥${SUCCESS_CRITERIA.minDay7Retention}%)`,
    `Task Completion:      ${analysis.overallTaskCompletionRate}% (target: ≥${SUCCESS_CRITERIA.minTaskCompletion}%)`,
    `Parent WhatsApp Open: ${analysis.parentWhatsAppOpenRate}% (target: ≥${SUCCESS_CRITERIA.minParentOpenRate}%)`,
    '',
    '─── RECOMMENDATION ────────────────────────────────────────────',
    `Status: ${analysis.recommendation.toUpperCase()}`,
    `Reason: ${analysis.recommendationReason}`,
    '',
  ];
  
  if (analysis.criticalIssues.length > 0) {
    lines.push('─── CRITICAL ISSUES ───────────────────────────────────────────');
    analysis.criticalIssues.forEach((issue, i) => {
      lines.push(`${i + 1}. ${issue}`);
    });
    lines.push('');
  }
  
  if (analysis.failureHotspots.length > 0) {
    lines.push('─── FAILURE HOTSPOTS ──────────────────────────────────────────');
    analysis.failureHotspots.slice(0, 5).forEach((hotspot) => {
      lines.push(`• Question ${hotspot.questionId}: ${hotspot.failureRate}% failure rate`);
    });
    lines.push('');
  }
  
  lines.push('─── IMPROVEMENTS ──────────────────────────────────────────────');
  analysis.improvements.forEach((improvement, i) => {
    lines.push(`${i + 1}. ${improvement}`);
  });
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

export const PilotAnalyzer = {
  calculateRetentionCurve,
  getDayRetention,
  identifyFailureHotspots,
  calculateParentEngagement,
  determineRecommendation,
  generateImprovements,
  analyzePilot,
  formatReport,
  SUCCESS_CRITERIA,
};
