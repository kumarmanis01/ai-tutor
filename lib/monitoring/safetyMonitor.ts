/**
 * FILE OBJECTIVE:
 * - Monitoring and Kill Switches for AI safety.
 * - Detects repeated failures, token spikes, confusion.
 * - Provides fallback behaviors and admin overrides.
 * - Priority: Stability > Intelligence.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/monitoring/safetyMonitor.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created safety monitoring system
 */

// ============================================================================
// TYPES & ENUMS
// ============================================================================

/**
 * Kill switch types
 */
export enum KillSwitchType {
  FORCE_EASY_MODE = 'force_easy_mode',
  DISABLE_AI_GENERATION = 'disable_ai_generation',
  TEXT_ONLY_MODE = 'text_only_mode',
  PAUSE_WHATSAPP = 'pause_whatsapp',
  DISABLE_QUESTION = 'disable_question',
  FALLBACK_TO_CACHE = 'fallback_to_cache',
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency',
}

/**
 * Metric types tracked
 */
export enum MetricType {
  TASK_COMPLETION_RATE = 'task_completion_rate',
  AVG_TIME_PER_TASK = 'avg_time_per_task',
  QUESTION_FAILURE_RATE = 'question_failure_rate',
  DROPOFF_MID_TASK = 'dropoff_mid_task',
  AI_RESPONSE_LENGTH = 'ai_response_length',
  TOKEN_USAGE = 'token_usage',
  PARENT_COMPLAINTS = 'parent_complaints',
}

/**
 * Threshold configuration
 */
export interface ThresholdConfig {
  readonly metric: MetricType;
  readonly warningThreshold: number;
  readonly criticalThreshold: number;
  readonly action: KillSwitchType;
  readonly description: string;
}

/**
 * Alert record
 */
export interface Alert {
  readonly id: string;
  readonly timestamp: string;
  readonly severity: AlertSeverity;
  readonly metric: MetricType;
  readonly value: number;
  readonly threshold: number;
  readonly message: string;
  readonly actionTaken: KillSwitchType | null;
  readonly resolved: boolean;
}

/**
 * Daily metrics snapshot
 */
export interface DailyMetrics {
  readonly date: string;
  readonly taskCompletionRate: number;
  readonly avgTimePerTask: number;
  readonly questionFailureRates: Map<string, number>;
  readonly dropoffRate: number;
  readonly avgResponseLength: number;
  readonly totalTokensUsed: number;
  readonly parentComplaints: number;
  readonly totalStudents: number;
  readonly activeStudents: number;
}

/**
 * Kill switch state
 */
export interface KillSwitchState {
  readonly type: KillSwitchType;
  readonly enabled: boolean;
  readonly enabledAt: string | null;
  readonly enabledBy: 'system' | 'admin';
  readonly reason: string | null;
  readonly affectedScope: 'global' | 'question' | 'user';
  readonly scopeId: string | null;
}

/**
 * Fallback behavior configuration
 */
export interface FallbackBehavior {
  readonly trigger: KillSwitchType;
  readonly behavior: string;
  readonly fallbackContent: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default threshold configurations
 */
export const DEFAULT_THRESHOLDS: ThresholdConfig[] = [
  {
    metric: MetricType.QUESTION_FAILURE_RATE,
    warningThreshold: 30,
    criticalThreshold: 40,
    action: KillSwitchType.DISABLE_QUESTION,
    description: 'Same question fails too often - auto-disable',
  },
  {
    metric: MetricType.TOKEN_USAGE,
    warningThreshold: 10000,
    criticalThreshold: 50000,
    action: KillSwitchType.FALLBACK_TO_CACHE,
    description: 'Token spike detected - switch to cached content',
  },
  {
    metric: MetricType.AI_RESPONSE_LENGTH,
    warningThreshold: 2000,
    criticalThreshold: 5000,
    action: KillSwitchType.TEXT_ONLY_MODE,
    description: 'AI response too long - simplify output',
  },
  {
    metric: MetricType.PARENT_COMPLAINTS,
    warningThreshold: 3,
    criticalThreshold: 5,
    action: KillSwitchType.PAUSE_WHATSAPP,
    description: 'Parent complaints - pause WhatsApp messages',
  },
  {
    metric: MetricType.DROPOFF_MID_TASK,
    warningThreshold: 20,
    criticalThreshold: 35,
    action: KillSwitchType.FORCE_EASY_MODE,
    description: 'High dropoff rate - force easy mode',
  },
  {
    metric: MetricType.TASK_COMPLETION_RATE,
    warningThreshold: 70,
    criticalThreshold: 50,
    action: KillSwitchType.FORCE_EASY_MODE,
    description: 'Low completion rate - force easy mode',
  },
];

/**
 * Fallback behaviors for each kill switch
 */
export const FALLBACK_BEHAVIORS: FallbackBehavior[] = [
  {
    trigger: KillSwitchType.FORCE_EASY_MODE,
    behavior: 'Reduce all difficulty levels by 2',
    fallbackContent: null,
  },
  {
    trigger: KillSwitchType.DISABLE_AI_GENERATION,
    behavior: 'Use pre-generated content only',
    fallbackContent: 'We\'re preparing something special for you! 🌟',
  },
  {
    trigger: KillSwitchType.TEXT_ONLY_MODE,
    behavior: 'Disable rich content, use plain text',
    fallbackContent: null,
  },
  {
    trigger: KillSwitchType.PAUSE_WHATSAPP,
    behavior: 'Stop all WhatsApp notifications',
    fallbackContent: null,
  },
  {
    trigger: KillSwitchType.DISABLE_QUESTION,
    behavior: 'Remove question from active pool',
    fallbackContent: null,
  },
  {
    trigger: KillSwitchType.FALLBACK_TO_CACHE,
    behavior: 'Serve cached responses only',
    fallbackContent: null,
  },
];

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * In-memory kill switch states (in production, use Redis/DB)
 */
const killSwitchStates: Map<string, KillSwitchState> = new Map();

/**
 * Active alerts
 */
const activeAlerts: Alert[] = [];

/**
 * Disabled questions
 */
const disabledQuestions: Set<string> = new Set();

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Initialize kill switch state
 */
export function initializeKillSwitch(type: KillSwitchType): KillSwitchState {
  const state: KillSwitchState = {
    type,
    enabled: false,
    enabledAt: null,
    enabledBy: 'system',
    reason: null,
    affectedScope: 'global',
    scopeId: null,
  };
  killSwitchStates.set(type, state);
  return state;
}

/**
 * Enable a kill switch
 */
export function enableKillSwitch(
  type: KillSwitchType,
  reason: string,
  enabledBy: 'system' | 'admin' = 'system',
  scope: 'global' | 'question' | 'user' = 'global',
  scopeId: string | null = null
): KillSwitchState {
  const state: KillSwitchState = {
    type,
    enabled: true,
    enabledAt: new Date().toISOString(),
    enabledBy,
    reason,
    affectedScope: scope,
    scopeId,
  };
  killSwitchStates.set(scope === 'global' ? type : `${type}:${scopeId}`, state);
  return state;
}

/**
 * Disable a kill switch
 */
export function disableKillSwitch(type: KillSwitchType, scopeId: string | null = null): void {
  const key = scopeId ? `${type}:${scopeId}` : type;
  killSwitchStates.delete(key);
}

/**
 * Check if kill switch is enabled
 */
export function isKillSwitchEnabled(type: KillSwitchType, scopeId: string | null = null): boolean {
  // Check global first
  const globalState = killSwitchStates.get(type);
  if (globalState?.enabled) return true;
  
  // Check scoped
  if (scopeId) {
    const scopedState = killSwitchStates.get(`${type}:${scopeId}`);
    return scopedState?.enabled || false;
  }
  
  return false;
}

/**
 * Get all active kill switches
 */
export function getActiveKillSwitches(): KillSwitchState[] {
  return Array.from(killSwitchStates.values()).filter(s => s.enabled);
}

/**
 * Check metric against thresholds and trigger alerts
 */
export function checkMetric(
  metric: MetricType,
  value: number,
  questionId?: string
): Alert | null {
  const config = DEFAULT_THRESHOLDS.find(t => t.metric === metric);
  if (!config) return null;
  
  // For completion rate, lower is worse
  const isRateMetric = metric === MetricType.TASK_COMPLETION_RATE;
  const isAboveThreshold = isRateMetric
    ? value <= config.criticalThreshold
    : value >= config.criticalThreshold;
  const isWarning = isRateMetric
    ? value <= config.warningThreshold && value > config.criticalThreshold
    : value >= config.warningThreshold && value < config.criticalThreshold;
  
  if (!isAboveThreshold && !isWarning) return null;
  
  const severity = isAboveThreshold ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;
  
  const alert: Alert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    severity,
    metric,
    value,
    threshold: isAboveThreshold ? config.criticalThreshold : config.warningThreshold,
    message: `${config.description} (${value}${isRateMetric ? '%' : ''})`,
    actionTaken: isAboveThreshold ? config.action : null,
    resolved: false,
  };
  
  activeAlerts.push(alert);
  
  // Auto-trigger kill switch for critical alerts
  if (isAboveThreshold) {
    const scope = questionId ? 'question' : 'global';
    enableKillSwitch(config.action, alert.message, 'system', scope, questionId || null);
  }
  
  return alert;
}

/**
 * Check question failure rate and disable if needed
 */
export function checkQuestionHealth(
  questionId: string,
  failureCount: number,
  attemptCount: number
): { healthy: boolean; action: string | null } {
  if (attemptCount < 10) {
    // Not enough data
    return { healthy: true, action: null };
  }
  
  const failureRate = (failureCount / attemptCount) * 100;
  
  if (failureRate >= 40) {
    disabledQuestions.add(questionId);
    enableKillSwitch(
      KillSwitchType.DISABLE_QUESTION,
      `Question ${questionId} has ${failureRate.toFixed(1)}% failure rate`,
      'system',
      'question',
      questionId
    );
    return { healthy: false, action: 'disabled' };
  }
  
  return { healthy: true, action: null };
}

/**
 * Check if question is disabled
 */
export function isQuestionDisabled(questionId: string): boolean {
  return disabledQuestions.has(questionId);
}

/**
 * Get fallback behavior for a kill switch
 */
export function getFallbackBehavior(type: KillSwitchType): FallbackBehavior | null {
  return FALLBACK_BEHAVIORS.find(f => f.trigger === type) || null;
}

/**
 * Log AI response metadata (no PII)
 */
export function logAIResponse(metadata: {
  _responseId: string;
  contentType: string;
  tokenCount: number;
  responseLength: number;
  latencyMs: number;
  modelVersion: string;
  grade: number;
  subject: string;
}): void {
  // In production, send to monitoring service
  // For now, just validate and store
  const { tokenCount, responseLength } = metadata;
  
  // Check for token spike
  checkMetric(MetricType.TOKEN_USAGE, tokenCount);
  
  // Check for response length spike
  checkMetric(MetricType.AI_RESPONSE_LENGTH, responseLength);
}

/**
 * Get active alerts
 */
export function getActiveAlerts(): Alert[] {
  return activeAlerts.filter(a => !a.resolved);
}

/**
 * Resolve an alert
 */
export function resolveAlert(alertId: string): void {
  const alert = activeAlerts.find(a => a.id === alertId);
  if (alert) {
    (alert as any).resolved = true;
  }
}

/**
 * Calculate daily health score (0-100)
 */
export function calculateHealthScore(metrics: DailyMetrics): {
  score: number;
  status: 'healthy' | 'degraded' | 'critical';
  issues: string[];
} {
  const issues: string[] = [];
  let deductions = 0;
  
  // Completion rate (most important)
  if (metrics.taskCompletionRate < 70) {
    deductions += 30;
    issues.push(`Low completion rate: ${metrics.taskCompletionRate}%`);
  } else if (metrics.taskCompletionRate < 85) {
    deductions += 10;
    issues.push(`Completion rate below target: ${metrics.taskCompletionRate}%`);
  }
  
  // Dropoff rate
  if (metrics.dropoffRate > 20) {
    deductions += 20;
    issues.push(`High dropoff rate: ${metrics.dropoffRate}%`);
  }
  
  // Parent complaints
  if (metrics.parentComplaints > 0) {
    deductions += metrics.parentComplaints * 5;
    issues.push(`Parent complaints: ${metrics.parentComplaints}`);
  }
  
  // Active students ratio
  const activeRatio = metrics.activeStudents / metrics.totalStudents;
  if (activeRatio < 0.5) {
    deductions += 15;
    issues.push(`Low active student ratio: ${(activeRatio * 100).toFixed(1)}%`);
  }
  
  const score = Math.max(0, 100 - deductions);
  
  let status: 'healthy' | 'degraded' | 'critical';
  if (score >= 80) {
    status = 'healthy';
  } else if (score >= 50) {
    status = 'degraded';
  } else {
    status = 'critical';
  }
  
  return { score, status, issues };
}

/**
 * Get admin dashboard summary
 */
export function getAdminDashboard(): {
  activeKillSwitches: KillSwitchState[];
  activeAlerts: Alert[];
  disabledQuestions: string[];
} {
  return {
    activeKillSwitches: getActiveKillSwitches(),
    activeAlerts: getActiveAlerts(),
    disabledQuestions: Array.from(disabledQuestions),
  };
}

// ============================================================================
// ADMIN OVERRIDE FUNCTIONS
// ============================================================================

/**
 * Admin: Force easy mode globally
 */
export function adminForceEasyMode(reason: string): void {
  enableKillSwitch(KillSwitchType.FORCE_EASY_MODE, reason, 'admin');
}

/**
 * Admin: Disable AI generation globally
 */
export function adminDisableAIGeneration(reason: string): void {
  enableKillSwitch(KillSwitchType.DISABLE_AI_GENERATION, reason, 'admin');
}

/**
 * Admin: Enable text-only mode
 */
export function adminTextOnlyMode(reason: string): void {
  enableKillSwitch(KillSwitchType.TEXT_ONLY_MODE, reason, 'admin');
}

/**
 * Admin: Clear all kill switches (emergency reset)
 */
export function adminClearAllKillSwitches(): void {
  killSwitchStates.clear();
}

/**
 * Admin: Re-enable a disabled question
 */
export function adminReenableQuestion(questionId: string): void {
  disabledQuestions.delete(questionId);
  disableKillSwitch(KillSwitchType.DISABLE_QUESTION, questionId);
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

export const SafetyMonitor = {
  initializeKillSwitch,
  enableKillSwitch,
  disableKillSwitch,
  isKillSwitchEnabled,
  getActiveKillSwitches,
  checkMetric,
  checkQuestionHealth,
  isQuestionDisabled,
  getFallbackBehavior,
  logAIResponse,
  getActiveAlerts,
  resolveAlert,
  calculateHealthScore,
  getAdminDashboard,
  adminForceEasyMode,
  adminDisableAIGeneration,
  adminTextOnlyMode,
  adminClearAllKillSwitches,
  adminReenableQuestion,
  DEFAULT_THRESHOLDS,
  FALLBACK_BEHAVIORS,
};
