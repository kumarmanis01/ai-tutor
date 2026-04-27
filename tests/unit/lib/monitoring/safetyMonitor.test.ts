/**
 * FILE OBJECTIVE:
 * - Unit tests for safety monitor module.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/monitoring/safetyMonitor.test.ts (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-05T00:00:00Z | copilot | created test suite
 * - 2026-02-05T01:00:00Z | copilot | aligned tests with actual implementation API
 */

import {
  SafetyMonitor,
  KillSwitchType,
  AlertSeverity,
  MetricType,
  DEFAULT_THRESHOLDS,
  FALLBACK_BEHAVIORS,
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
  type ThresholdConfig,
  type KillSwitchState,
  type FallbackBehavior,
  type Alert,
  type DailyMetrics,
} from '@/lib/monitoring/safetyMonitor';

describe('SafetyMonitor', () => {
  // Reset state between tests
  beforeEach(() => {
    adminClearAllKillSwitches();
  });

  // ============================================================================
  // KillSwitchType
  // ============================================================================
  describe('KillSwitchType', () => {
    it('should have all expected kill switch types', () => {
      expect(KillSwitchType.FORCE_EASY_MODE).toBe('force_easy_mode');
      expect(KillSwitchType.DISABLE_AI_GENERATION).toBe('disable_ai_generation');
      expect(KillSwitchType.TEXT_ONLY_MODE).toBe('text_only_mode');
      expect(KillSwitchType.PAUSE_WHATSAPP).toBe('pause_whatsapp');
      expect(KillSwitchType.DISABLE_QUESTION).toBe('disable_question');
      expect(KillSwitchType.FALLBACK_TO_CACHE).toBe('fallback_to_cache');
    });
  });

  // ============================================================================
  // AlertSeverity
  // ============================================================================
  describe('AlertSeverity', () => {
    it('should have all severity levels', () => {
      expect(AlertSeverity.INFO).toBe('info');
      expect(AlertSeverity.WARNING).toBe('warning');
      expect(AlertSeverity.CRITICAL).toBe('critical');
      expect(AlertSeverity.EMERGENCY).toBe('emergency');
    });
  });

  // ============================================================================
  // MetricType
  // ============================================================================
  describe('MetricType', () => {
    it('should have all metric types', () => {
      expect(MetricType.TASK_COMPLETION_RATE).toBe('task_completion_rate');
      expect(MetricType.AVG_TIME_PER_TASK).toBe('avg_time_per_task');
      expect(MetricType.QUESTION_FAILURE_RATE).toBe('question_failure_rate');
      expect(MetricType.DROPOFF_MID_TASK).toBe('dropoff_mid_task');
      expect(MetricType.AI_RESPONSE_LENGTH).toBe('ai_response_length');
      expect(MetricType.TOKEN_USAGE).toBe('token_usage');
      expect(MetricType.PARENT_COMPLAINTS).toBe('parent_complaints');
    });
  });

  // ============================================================================
  // DEFAULT_THRESHOLDS
  // ============================================================================
  describe('DEFAULT_THRESHOLDS', () => {
    it('should be an array of threshold configs', () => {
      expect(Array.isArray(DEFAULT_THRESHOLDS)).toBe(true);
      expect(DEFAULT_THRESHOLDS.length).toBeGreaterThan(0);
    });

    it('should have threshold for failure rate', () => {
      const threshold = DEFAULT_THRESHOLDS.find(
        (t) => t.metric === MetricType.QUESTION_FAILURE_RATE
      );
      expect(threshold).toBeDefined();
      expect(threshold?.warningThreshold).toBeLessThan(threshold?.criticalThreshold ?? 0);
    });

    it('should have threshold for token usage', () => {
      const threshold = DEFAULT_THRESHOLDS.find(
        (t) => t.metric === MetricType.TOKEN_USAGE
      );
      expect(threshold).toBeDefined();
      expect(threshold?.warningThreshold).toBeGreaterThan(0);
    });

    it('should have threshold for parent complaints', () => {
      const threshold = DEFAULT_THRESHOLDS.find(
        (t) => t.metric === MetricType.PARENT_COMPLAINTS
      );
      expect(threshold).toBeDefined();
      expect(threshold?.action).toBe(KillSwitchType.PAUSE_WHATSAPP);
    });

    it('should have valid actions for each threshold', () => {
      DEFAULT_THRESHOLDS.forEach((threshold) => {
        expect(Object.values(KillSwitchType)).toContain(threshold.action);
      });
    });
  });

  // ============================================================================
  // FALLBACK_BEHAVIORS
  // ============================================================================
  describe('FALLBACK_BEHAVIORS', () => {
    it('should have fallback for each kill switch type', () => {
      expect(Array.isArray(FALLBACK_BEHAVIORS)).toBe(true);
      expect(FALLBACK_BEHAVIORS.length).toBeGreaterThan(0);
    });

    it('should have behavior description for each fallback', () => {
      FALLBACK_BEHAVIORS.forEach((fb) => {
        expect(fb.behavior).toBeDefined();
        expect(typeof fb.behavior).toBe('string');
        expect(fb.behavior.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // initializeKillSwitch
  // ============================================================================
  describe('initializeKillSwitch', () => {
    it('should create disabled kill switch state', () => {
      const state = initializeKillSwitch(KillSwitchType.FORCE_EASY_MODE);
      expect(state.type).toBe(KillSwitchType.FORCE_EASY_MODE);
      expect(state.enabled).toBe(false);
      expect(state.enabledAt).toBeNull();
      expect(state.reason).toBeNull();
    });

    it('should set default affected scope to global', () => {
      const state = initializeKillSwitch(KillSwitchType.DISABLE_QUESTION);
      // initializeKillSwitch creates a default disabled state with global scope
      expect(state.affectedScope).toBe('global');
    });
  });

  // ============================================================================
  // enableKillSwitch / disableKillSwitch
  // ============================================================================
  describe('enableKillSwitch', () => {
    it('should enable a kill switch', () => {
      enableKillSwitch(
        KillSwitchType.FORCE_EASY_MODE,
        'high failure rate',
        'system'
      );
      expect(isKillSwitchEnabled(KillSwitchType.FORCE_EASY_MODE)).toBe(true);
    });

    it('should record who enabled the switch', () => {
      enableKillSwitch(
        KillSwitchType.TEXT_ONLY_MODE,
        'test reason',
        'admin'
      );
      const active = getActiveKillSwitches();
      const textOnly = active.find((s) => s.type === KillSwitchType.TEXT_ONLY_MODE);
      expect(textOnly?.enabledBy).toBe('admin');
    });

    it('should store the reason', () => {
      enableKillSwitch(
        KillSwitchType.PAUSE_WHATSAPP,
        'parent complaints',
        'system'
      );
      const active = getActiveKillSwitches();
      const paused = active.find((s) => s.type === KillSwitchType.PAUSE_WHATSAPP);
      expect(paused?.reason).toBe('parent complaints');
    });
  });

  describe('disableKillSwitch', () => {
    it('should disable an active kill switch', () => {
      enableKillSwitch(
        KillSwitchType.FORCE_EASY_MODE,
        'test',
        'system'
      );
      expect(isKillSwitchEnabled(KillSwitchType.FORCE_EASY_MODE)).toBe(true);

      disableKillSwitch(KillSwitchType.FORCE_EASY_MODE);
      expect(isKillSwitchEnabled(KillSwitchType.FORCE_EASY_MODE)).toBe(false);
    });

    it('should succeed even if switch not active', () => {
      expect(() => {
        disableKillSwitch(KillSwitchType.DISABLE_AI_GENERATION);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // getActiveKillSwitches
  // ============================================================================
  describe('getActiveKillSwitches', () => {
    it('should return empty array when no switches active', () => {
      const active = getActiveKillSwitches();
      expect(active).toEqual([]);
    });

    it('should return all active switches', () => {
      enableKillSwitch(KillSwitchType.FORCE_EASY_MODE, 'reason1', 'system');
      enableKillSwitch(KillSwitchType.TEXT_ONLY_MODE, 'reason2', 'admin');

      const active = getActiveKillSwitches();
      expect(active.length).toBe(2);
      expect(active.map((s) => s.type)).toContain(KillSwitchType.FORCE_EASY_MODE);
      expect(active.map((s) => s.type)).toContain(KillSwitchType.TEXT_ONLY_MODE);
    });
  });

  // ============================================================================
  // isKillSwitchEnabled
  // ============================================================================
  describe('isKillSwitchEnabled', () => {
    it('should return false for inactive switch', () => {
      expect(isKillSwitchEnabled(KillSwitchType.DISABLE_AI_GENERATION)).toBe(false);
    });

    it('should return true for active switch', () => {
      enableKillSwitch(
        KillSwitchType.DISABLE_AI_GENERATION,
        'test',
        'system'
      );
      expect(isKillSwitchEnabled(KillSwitchType.DISABLE_AI_GENERATION)).toBe(true);
    });
  });

  // ============================================================================
  // checkMetric
  // ============================================================================
  describe('checkMetric', () => {
    it('should return null for values within thresholds (no alert)', () => {
      const result = checkMetric(MetricType.QUESTION_FAILURE_RATE, 10);
      // checkMetric returns null when no threshold exceeded
      expect(result).toBeNull();
    });

    it('should return warning alert for values at warning threshold', () => {
      const result = checkMetric(MetricType.QUESTION_FAILURE_RATE, 35);
      expect(result).not.toBeNull();
      expect(result?.severity).toBe(AlertSeverity.WARNING);
    });

    it('should return critical alert for values above critical threshold', () => {
      const result = checkMetric(MetricType.QUESTION_FAILURE_RATE, 50);
      expect(result).not.toBeNull();
      expect(result?.severity).toBe(AlertSeverity.CRITICAL);
      expect(result?.actionTaken).toBe(KillSwitchType.DISABLE_QUESTION);
    });
  });

  // ============================================================================
  // checkQuestionHealth / isQuestionDisabled
  // ============================================================================
  describe('checkQuestionHealth', () => {
    it('should return healthy for low failure rate', () => {
      const result = checkQuestionHealth('question-1', 10, 100);
      expect(result.healthy).toBe(true);
      expect(result.action).toBeNull();
    });

    it('should disable question with high failure rate', () => {
      const result = checkQuestionHealth('question-2', 50, 100);
      expect(result.healthy).toBe(false);
      expect(result.action).toBe('disabled');
    });
  });

  describe('isQuestionDisabled', () => {
    it('should return false for non-disabled question', () => {
      expect(isQuestionDisabled('any-question')).toBe(false);
    });
  });

  // ============================================================================
  // getFallbackBehavior
  // ============================================================================
  describe('getFallbackBehavior', () => {
    it('should return fallback for known kill switch', () => {
      const fallback = getFallbackBehavior(KillSwitchType.FORCE_EASY_MODE);
      expect(fallback).not.toBeNull();
      expect(fallback?.behavior).toBeDefined();
    });

    it('should return null for unknown kill switch', () => {
      const fallback = getFallbackBehavior('nonexistent' as KillSwitchType);
      expect(fallback).toBeNull();
    });
  });

  // ============================================================================
  // logAIResponse
  // ============================================================================
  describe('logAIResponse', () => {
    it('should log response without error', () => {
      expect(() => {
        logAIResponse({
          responseId: 'resp-1',
          contentType: 'text',
          tokenCount: 500,
          responseLength: 200,
          latencyMs: 100,
          modelVersion: '1.0',
          grade: 5,
          subject: 'math',
        });
      }).not.toThrow();
    });

    it('should check metrics for high token usage (function returns void)', () => {
      // logAIResponse returns void but internally calls checkMetric
      expect(() => {
        logAIResponse({
          responseId: 'resp-2',
          contentType: 'text',
          tokenCount: 100000,
          responseLength: 200,
          latencyMs: 100,
          modelVersion: '1.0',
          grade: 5,
          subject: 'math',
        });
      }).not.toThrow();
      // High token usage should trigger an alert
      const alerts = getActiveAlerts();
      const tokenAlert = alerts.find((a) => a.metric === MetricType.TOKEN_USAGE);
      expect(tokenAlert).toBeDefined();
    });
  });

  // ============================================================================
  // getActiveAlerts / resolveAlert
  // ============================================================================
  describe('getActiveAlerts', () => {
    it('should return array of alerts', () => {
      const alerts = getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert without error', () => {
      expect(() => {
        resolveAlert('nonexistent-alert');
      }).not.toThrow();
    });
  });

  // ============================================================================
  // calculateHealthScore
  // ============================================================================
  describe('calculateHealthScore', () => {
    it('should return high score for healthy metrics', () => {
      const metrics: DailyMetrics = {
        date: '2026-02-05',
        taskCompletionRate: 85,
        avgTimePerTask: 5,
        questionFailureRates: new Map(),
        dropoffRate: 5,
        avgResponseLength: 500,
        totalTokensUsed: 1000,
        parentComplaints: 0,
        totalStudents: 100,
        activeStudents: 80,
      };
      const result = calculateHealthScore(metrics);
      expect(result.score).toBeGreaterThan(70);
      expect(result.status).toBe('healthy');
    });

    it('should return low score for poor metrics', () => {
      const metrics: DailyMetrics = {
        date: '2026-02-05',
        taskCompletionRate: 30,
        avgTimePerTask: 20,
        questionFailureRates: new Map([['q1', 60], ['q2', 70]]),
        dropoffRate: 50,
        avgResponseLength: 3000,
        totalTokensUsed: 100000,
        parentComplaints: 10,
        totalStudents: 100,
        activeStudents: 20,
      };
      const result = calculateHealthScore(metrics);
      expect(result.score).toBeLessThan(50);
      expect(result.status).not.toBe('healthy');
    });

    it('should identify issues', () => {
      const metrics: DailyMetrics = {
        date: '2026-02-05',
        taskCompletionRate: 40,
        avgTimePerTask: 5,
        questionFailureRates: new Map(),
        dropoffRate: 45,
        avgResponseLength: 500,
        totalTokensUsed: 1000,
        parentComplaints: 0,
        totalStudents: 100,
        activeStudents: 80,
      };
      const result = calculateHealthScore(metrics);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // getAdminDashboard
  // ============================================================================
  describe('getAdminDashboard', () => {
    it('should return dashboard with active switches', () => {
      enableKillSwitch(KillSwitchType.FORCE_EASY_MODE, 'test', 'admin');
      const dashboard = getAdminDashboard();
      expect(dashboard.activeKillSwitches.length).toBe(1);
    });

    it('should return dashboard with disabled questions list', () => {
      const dashboard = getAdminDashboard();
      expect(dashboard.disabledQuestions).toBeDefined();
      expect(Array.isArray(dashboard.disabledQuestions)).toBe(true);
    });

    it('should return dashboard with active alerts', () => {
      const dashboard = getAdminDashboard();
      expect(dashboard.activeAlerts).toBeDefined();
      expect(Array.isArray(dashboard.activeAlerts)).toBe(true);
    });
  });

  // ============================================================================
  // Admin Functions
  // ============================================================================
  describe('Admin Functions', () => {
    it('adminForceEasyMode should enable easy mode switch', () => {
      adminForceEasyMode('manual intervention');
      expect(isKillSwitchEnabled(KillSwitchType.FORCE_EASY_MODE)).toBe(true);
    });

    it('adminDisableAIGeneration should disable AI', () => {
      adminDisableAIGeneration('testing');
      expect(isKillSwitchEnabled(KillSwitchType.DISABLE_AI_GENERATION)).toBe(true);
    });

    it('adminTextOnlyMode should enable text-only', () => {
      adminTextOnlyMode('bandwidth concerns');
      expect(isKillSwitchEnabled(KillSwitchType.TEXT_ONLY_MODE)).toBe(true);
    });

    it('adminClearAllKillSwitches should clear all switches', () => {
      enableKillSwitch(KillSwitchType.FORCE_EASY_MODE, 'test1', 'admin');
      enableKillSwitch(KillSwitchType.TEXT_ONLY_MODE, 'test2', 'admin');
      expect(getActiveKillSwitches().length).toBe(2);

      adminClearAllKillSwitches();
      expect(getActiveKillSwitches().length).toBe(0);
    });
  });

  // ============================================================================
  // SafetyMonitor export
  // ============================================================================
  describe('SafetyMonitor export', () => {
    it('should export all required functions', () => {
      expect(SafetyMonitor.initializeKillSwitch).toBeDefined();
      expect(SafetyMonitor.enableKillSwitch).toBeDefined();
      expect(SafetyMonitor.disableKillSwitch).toBeDefined();
      expect(SafetyMonitor.isKillSwitchEnabled).toBeDefined();
      expect(SafetyMonitor.getActiveKillSwitches).toBeDefined();
      expect(SafetyMonitor.checkMetric).toBeDefined();
      expect(SafetyMonitor.checkQuestionHealth).toBeDefined();
      expect(SafetyMonitor.isQuestionDisabled).toBeDefined();
      expect(SafetyMonitor.getFallbackBehavior).toBeDefined();
      expect(SafetyMonitor.logAIResponse).toBeDefined();
      expect(SafetyMonitor.getActiveAlerts).toBeDefined();
      expect(SafetyMonitor.resolveAlert).toBeDefined();
      expect(SafetyMonitor.calculateHealthScore).toBeDefined();
      expect(SafetyMonitor.getAdminDashboard).toBeDefined();
    });

    it('should export constants', () => {
      expect(SafetyMonitor.DEFAULT_THRESHOLDS).toBeDefined();
      expect(SafetyMonitor.FALLBACK_BEHAVIORS).toBeDefined();
    });
  });
});
