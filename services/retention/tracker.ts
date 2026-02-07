/**
 * FILE OBJECTIVE:
 * - Calculate retention metrics from raw engagement data.
 * - Detect red flags and assess churn risk.
 * - Generate intervention recommendations.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/retention/tracker.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created retention tracker
 */

import {
  RetentionWindow,
  ChurnRisk,
  RedFlag,
  getRetentionTargets,
  DEFAULT_RED_FLAG_THRESHOLDS,
  RED_FLAG_INTERVENTIONS,
  type DailyEngagement,
  type ConfidenceTrend,
  type DifficultyProgression,
  type ParentInvolvement,
  type RetentionStatus,
  type CohortRetention,
  type RedFlagDetection,
  type ChurnRiskAssessment,
  type RedFlagThresholds,
} from './schemas';

// ============================================================================
// RETENTION CALCULATION
// ============================================================================

/**
 * Calculate retention status for a student at a given window.
 */
export function calculateRetentionStatus(
  studentId: string,
  cohortDate: Date,
  engagementData: DailyEngagement[],
  window: RetentionWindow
): RetentionStatus {
  const windowDays = getWindowDays(window);
  const windowEnd = new Date(cohortDate);
  windowEnd.setDate(windowEnd.getDate() + windowDays);
  
  // Filter engagement data within window
  const windowEngagement = engagementData.filter(e => {
    const date = new Date(e.date);
    return date > cohortDate && date <= windowEnd;
  });
  
  // Calculate metrics
  const sessionsInWindow = windowEngagement.reduce(
    (sum, e) => sum + e.sessionsStarted, 0
  );
  const minutesInWindow = windowEngagement.reduce(
    (sum, e) => sum + e.totalTimeMinutes, 0
  );
  
  // Determine if retained (at least 1 session)
  const isRetained = sessionsInWindow > 0;
  const returnedAt = isRetained 
    ? windowEngagement[0]?.date 
    : undefined;
  
  return {
    studentId,
    cohortDate: cohortDate.toISOString(),
    window,
    isRetained,
    returnedAt,
    sessionsInWindow,
    minutesInWindow,
  };
}

/**
 * Calculate cohort retention summary.
 */
export function calculateCohortRetention(
  cohortDate: Date,
  studentRetentions: RetentionStatus[],
  grade?: number
): CohortRetention {
  const cohortSize = studentRetentions.length;
  
  if (cohortSize === 0) {
    throw new Error('Cannot calculate retention for empty cohort');
  }
  
  // Calculate retention rate for each window
  const calculateRate = (window: RetentionWindow): number => {
    const retained = studentRetentions.filter(
      r => r.window === window && r.isRetained
    ).length;
    return retained / cohortSize;
  };
  
  const retentionRates = {
    day_1: calculateRate(RetentionWindow.DAY_1),
    day_3: calculateRate(RetentionWindow.DAY_3),
    day_7: calculateRate(RetentionWindow.DAY_7),
    day_14: calculateRate(RetentionWindow.DAY_14),
    day_30: calculateRate(RetentionWindow.DAY_30),
  };
  
  // Get targets for this grade
  const targetRates = grade 
    ? getRetentionTargets(grade)
    : getRetentionTargets(6); // Default to middle school
  
  // Check if meeting targets
  const meetsTargets = {
    day_1: retentionRates.day_1 >= targetRates.day_1,
    day_3: retentionRates.day_3 >= targetRates.day_3,
    day_7: retentionRates.day_7 >= targetRates.day_7,
    day_14: retentionRates.day_14 >= targetRates.day_14,
    day_30: retentionRates.day_30 >= targetRates.day_30,
  };
  
  return {
    cohortDate: cohortDate.toISOString(),
    cohortSize,
    grade,
    retentionRates,
    targetRates,
    meetsTargets,
  };
}

/**
 * Get number of days for a retention window.
 */
function getWindowDays(window: RetentionWindow): number {
  const days: Record<RetentionWindow, number> = {
    [RetentionWindow.DAY_1]: 1,
    [RetentionWindow.DAY_3]: 3,
    [RetentionWindow.DAY_7]: 7,
    [RetentionWindow.DAY_14]: 14,
    [RetentionWindow.DAY_30]: 30,
  };
  return days[window];
}

// ============================================================================
// RED FLAG DETECTION
// ============================================================================

/**
 * Detect all red flags for a student.
 */
export function detectRedFlags(
  studentId: string,
  engagement: DailyEngagement[],
  confidence: ConfidenceTrend | null,
  difficulty: DifficultyProgression | null,
  parentInvolvement: ParentInvolvement | null,
  thresholds: RedFlagThresholds = DEFAULT_RED_FLAG_THRESHOLDS
): RedFlagDetection[] {
  const flags: RedFlagDetection[] = [];
  const now = new Date().toISOString();
  
  // Check each red flag condition
  
  // 1. High doubts + low confidence
  if (engagement.length > 0 && confidence) {
    const recentEngagement = engagement.slice(-7);
    const totalDoubts = recentEngagement.reduce((sum, e) => sum + e.doubtsAsked, 0);
    const avgDoubts = totalDoubts / Math.max(recentEngagement.length, 1);
    
    if (avgDoubts >= thresholds.highDoubtsMinimum && 
        confidence.averageConfidence < thresholds.lowConfidenceThreshold) {
      flags.push({
        studentId,
        flag: RedFlag.HIGH_DOUBTS_LOW_CONFIDENCE,
        severity: ChurnRisk.HIGH,
        detectedAt: now,
        evidence: {
          metric: 'doubts_and_confidence',
          currentValue: avgDoubts,
          threshold: thresholds.highDoubtsMinimum,
          periodDays: 7,
        },
        suggestedIntervention: RED_FLAG_INTERVENTIONS[RedFlag.HIGH_DOUBTS_LOW_CONFIDENCE],
      });
    }
  }
  
  // 2. Flat difficulty for 3+ weeks
  if (difficulty && difficulty.isFlat && 
      difficulty.weeksFlat >= thresholds.flatDifficultyWeeks) {
    flags.push({
      studentId,
      flag: RedFlag.FLAT_DIFFICULTY_3_WEEKS,
      severity: ChurnRisk.MODERATE,
      detectedAt: now,
      evidence: {
        metric: 'difficulty_progression',
        currentValue: difficulty.weeksFlat,
        threshold: thresholds.flatDifficultyWeeks,
        periodDays: difficulty.weeksFlat * 7,
      },
      suggestedIntervention: RED_FLAG_INTERVENTIONS[RedFlag.FLAT_DIFFICULTY_3_WEEKS],
    });
  }
  
  // 3. No parent views
  if (parentInvolvement && !parentInvolvement.isActive &&
      parentInvolvement.daysSinceActive >= thresholds.parentInactiveDays) {
    flags.push({
      studentId,
      flag: RedFlag.NO_PARENT_VIEWS,
      severity: ChurnRisk.MODERATE,
      detectedAt: now,
      evidence: {
        metric: 'parent_activity_days',
        currentValue: parentInvolvement.daysSinceActive,
        threshold: thresholds.parentInactiveDays,
        periodDays: parentInvolvement.daysSinceActive,
      },
      suggestedIntervention: RED_FLAG_INTERVENTIONS[RedFlag.NO_PARENT_VIEWS],
    });
  }
  
  // 4. Declining session length
  if (engagement.length >= 7) {
    const firstWeek = engagement.slice(0, 7);
    const lastWeek = engagement.slice(-7);
    
    const firstAvg = average(firstWeek.map(e => e.avgSessionLengthMinutes));
    const lastAvg = average(lastWeek.map(e => e.avgSessionLengthMinutes));
    
    const declinePercent = firstAvg > 0 ? (firstAvg - lastAvg) / firstAvg : 0;
    
    if (declinePercent >= thresholds.sessionLengthDeclinePercent / 100) {
      flags.push({
        studentId,
        flag: RedFlag.DECLINING_SESSION_LENGTH,
        severity: ChurnRisk.MODERATE,
        detectedAt: now,
        evidence: {
          metric: 'session_length_decline',
          currentValue: declinePercent * 100,
          threshold: thresholds.sessionLengthDeclinePercent,
          periodDays: engagement.length,
        },
        suggestedIntervention: RED_FLAG_INTERVENTIONS[RedFlag.DECLINING_SESSION_LENGTH],
      });
    }
  }
  
  // 5. Increasing skip rate
  if (engagement.length >= 7) {
    const recentEngagement = engagement.slice(-7);
    const totalAttempted = recentEngagement.reduce(
      (sum, e) => sum + e.questionsAttempted, 0
    );
    const totalSkipped = recentEngagement.reduce(
      (sum, e) => sum + e.questionsSkipped, 0
    );
    
    const skipRate = totalAttempted > 0 
      ? totalSkipped / (totalAttempted + totalSkipped) 
      : 0;
    
    if (skipRate >= thresholds.skipRateThreshold) {
      flags.push({
        studentId,
        flag: RedFlag.INCREASING_SKIP_RATE,
        severity: ChurnRisk.MODERATE,
        detectedAt: now,
        evidence: {
          metric: 'skip_rate',
          currentValue: skipRate * 100,
          threshold: thresholds.skipRateThreshold * 100,
          periodDays: 7,
        },
        suggestedIntervention: RED_FLAG_INTERVENTIONS[RedFlag.INCREASING_SKIP_RATE],
      });
    }
  }
  
  // 6. Low completion rate
  if (engagement.length > 0) {
    const recentEngagement = engagement.slice(-14);
    const totalStarted = recentEngagement.reduce(
      (sum, e) => sum + e.sessionsStarted, 0
    );
    const totalCompleted = recentEngagement.reduce(
      (sum, e) => sum + e.sessionsCompleted, 0
    );
    
    const completionRate = totalStarted > 0 ? totalCompleted / totalStarted : 1;
    
    if (completionRate < thresholds.completionRateThreshold) {
      flags.push({
        studentId,
        flag: RedFlag.LOW_COMPLETION_RATE,
        severity: ChurnRisk.HIGH,
        detectedAt: now,
        evidence: {
          metric: 'completion_rate',
          currentValue: completionRate * 100,
          threshold: thresholds.completionRateThreshold * 100,
          periodDays: 14,
        },
        suggestedIntervention: RED_FLAG_INTERVENTIONS[RedFlag.LOW_COMPLETION_RATE],
      });
    }
  }
  
  // 7. Negative confidence trend
  if (confidence && confidence.trend === 'declining') {
    const decline = Math.max(
      ...confidence.confidenceScores.map(c => c.score)
    ) - Math.min(
      ...confidence.confidenceScores.map(c => c.score)
    );
    
    if (decline >= thresholds.confidenceDeclineThreshold) {
      flags.push({
        studentId,
        flag: RedFlag.NEGATIVE_CONFIDENCE_TREND,
        severity: ChurnRisk.HIGH,
        detectedAt: now,
        evidence: {
          metric: 'confidence_decline',
          currentValue: decline * 100,
          threshold: thresholds.confidenceDeclineThreshold * 100,
          periodDays: 14,
        },
        suggestedIntervention: RED_FLAG_INTERVENTIONS[RedFlag.NEGATIVE_CONFIDENCE_TREND],
      });
    }
  }
  
  return flags;
}

/**
 * Calculate average of numbers.
 */
function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ============================================================================
// CHURN RISK ASSESSMENT
// ============================================================================

/**
 * Assess overall churn risk for a student.
 */
export function assessChurnRisk(
  studentId: string,
  redFlags: RedFlagDetection[],
  engagement: DailyEngagement[],
  confidence: ConfidenceTrend | null
): ChurnRiskAssessment {
  const now = new Date().toISOString();
  
  // Calculate risk score (0-100)
  let riskScore = 0;
  
  // Base risk from red flags
  for (const flag of redFlags) {
    switch (flag.severity) {
      case ChurnRisk.CRITICAL:
        riskScore += 30;
        break;
      case ChurnRisk.HIGH:
        riskScore += 20;
        break;
      case ChurnRisk.MODERATE:
        riskScore += 10;
        break;
      case ChurnRisk.LOW:
        riskScore += 5;
        break;
    }
  }
  
  // Engagement recency factor
  if (engagement.length > 0) {
    const lastEngagement = new Date(engagement[engagement.length - 1].date);
    const daysSinceActive = Math.floor(
      (Date.now() - lastEngagement.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceActive > 7) {
      riskScore += 15;
    } else if (daysSinceActive > 3) {
      riskScore += 5;
    }
  } else {
    riskScore += 20; // No engagement data is high risk
  }
  
  // Confidence factor
  if (confidence) {
    if (confidence.trend === 'declining') {
      riskScore += 10;
    }
    if (confidence.averageConfidence < 0.4) {
      riskScore += 10;
    }
  }
  
  // Cap at 100
  riskScore = Math.min(riskScore, 100);
  
  // Determine overall risk level
  let overallRisk: ChurnRisk;
  if (riskScore >= 70) {
    overallRisk = ChurnRisk.CRITICAL;
  } else if (riskScore >= 50) {
    overallRisk = ChurnRisk.HIGH;
  } else if (riskScore >= 30) {
    overallRisk = ChurnRisk.MODERATE;
  } else {
    overallRisk = ChurnRisk.LOW;
  }
  
  // Calculate churn probability
  const churnProbability30Day = riskScore / 100;
  const confidenceInterval = {
    lower: Math.max(0, churnProbability30Day - 0.15),
    upper: Math.min(1, churnProbability30Day + 0.15),
  };
  
  // Identify top factors
  const topChurnFactors = identifyTopFactors(redFlags, engagement, confidence);
  
  // Generate interventions
  const interventions = generateInterventions(redFlags, overallRisk);
  
  return {
    studentId,
    assessedAt: now,
    overallRisk,
    riskScore,
    activeRedFlags: redFlags,
    resolvedRedFlags: [],
    churnProbability30Day,
    confidenceInterval,
    topChurnFactors,
    interventions,
  };
}

/**
 * Identify top factors contributing to churn.
 */
function identifyTopFactors(
  redFlags: RedFlagDetection[],
  engagement: DailyEngagement[],
  confidence: ConfidenceTrend | null
): ChurnRiskAssessment['topChurnFactors'] {
  const factors: ChurnRiskAssessment['topChurnFactors'] = [];
  
  // Red flags as factors
  for (const flag of redFlags.slice(0, 3)) {
    factors.push({
      factor: flag.flag,
      impact: flag.severity === ChurnRisk.CRITICAL ? -0.8 
            : flag.severity === ChurnRisk.HIGH ? -0.6 
            : -0.4,
      description: flag.suggestedIntervention,
    });
  }
  
  // Positive factors (if any)
  if (engagement.length > 0) {
    const recentEngagement = engagement.slice(-7);
    const avgSessions = average(recentEngagement.map(e => e.sessionsCompleted));
    
    if (avgSessions >= 1) {
      factors.push({
        factor: 'consistent_engagement',
        impact: 0.3,
        description: 'Student maintains regular learning sessions',
      });
    }
  }
  
  if (confidence && confidence.trend === 'improving') {
    factors.push({
      factor: 'improving_confidence',
      impact: 0.4,
      description: 'Student confidence is trending upward',
    });
  }
  
  return factors.sort((a, b) => a.impact - b.impact);
}

/**
 * Generate interventions based on risk level.
 */
function generateInterventions(
  redFlags: RedFlagDetection[],
  overallRisk: ChurnRisk
): ChurnRiskAssessment['interventions'] {
  const interventions: ChurnRiskAssessment['interventions'] = [];
  
  // Add interventions for each red flag
  for (let i = 0; i < Math.min(redFlags.length, 3); i++) {
    const flag = redFlags[i];
    interventions.push({
      priority: i + 1,
      action: flag.suggestedIntervention,
      expectedImpact: 'Reduce churn probability by 10-20%',
      owner: determineInterventionOwner(flag.flag),
    });
  }
  
  // Add general interventions for high risk
  if (overallRisk === ChurnRisk.CRITICAL || overallRisk === ChurnRisk.HIGH) {
    if (!interventions.some(i => i.owner === 'parent')) {
      interventions.push({
        priority: interventions.length + 1,
        action: 'Send progress report to parent with actionable insights',
        expectedImpact: 'Increase family engagement',
        owner: 'system',
      });
    }
    
    if (overallRisk === ChurnRisk.CRITICAL) {
      interventions.push({
        priority: interventions.length + 1,
        action: 'Schedule check-in call or message from support team',
        expectedImpact: 'Direct intervention for at-risk student',
        owner: 'admin',
      });
    }
  }
  
  return interventions;
}

/**
 * Determine who should handle an intervention.
 */
function determineInterventionOwner(
  flag: RedFlag
): 'system' | 'parent' | 'teacher' | 'admin' {
  const ownerMap: Record<RedFlag, 'system' | 'parent' | 'teacher' | 'admin'> = {
    [RedFlag.HIGH_DOUBTS_LOW_CONFIDENCE]: 'system',
    [RedFlag.FLAT_DIFFICULTY_3_WEEKS]: 'teacher',
    [RedFlag.NO_PARENT_VIEWS]: 'parent',
    [RedFlag.DECLINING_SESSION_LENGTH]: 'system',
    [RedFlag.INCREASING_SKIP_RATE]: 'system',
    [RedFlag.NO_RETURN_AFTER_STRUGGLE]: 'system',
    [RedFlag.LOW_COMPLETION_RATE]: 'system',
    [RedFlag.NEGATIVE_CONFIDENCE_TREND]: 'teacher',
    [RedFlag.ABANDONED_DIAGNOSTIC]: 'system',
    [RedFlag.STUCK_WITHOUT_RECOVERY]: 'system',
  };
  
  return ownerMap[flag] || 'system';
}
