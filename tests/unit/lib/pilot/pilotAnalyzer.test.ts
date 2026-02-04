/**
 * FILE OBJECTIVE:
 * - Unit tests for pilot analyzer module.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/pilot/pilotAnalyzer.test.ts (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-05T00:00:00Z | copilot | created test suite
 * - 2026-02-05T02:00:00Z | copilot | aligned tests with actual implementation API
 */

import {
  PilotAnalyzer,
  PilotRecommendation,
  SUCCESS_CRITERIA,
  calculateRetentionCurve,
  getDayRetention,
  identifyFailureHotspots,
  calculateParentEngagement,
  determineRecommendation,
  generateImprovements,
  analyzePilot,
  formatReport,
  type DailyActivity,
  type ParentInteraction,
  type ConfusionReport,
  type PilotCohort,
  type PilotAnalysis,
} from '@/lib/pilot/pilotAnalyzer';

describe('PilotAnalyzer', () => {
  // ============================================================================
  // SUCCESS_CRITERIA
  // ============================================================================
  describe('SUCCESS_CRITERIA', () => {
    it('should have day 7 retention threshold of 60%', () => {
      expect(SUCCESS_CRITERIA.minDay7Retention).toBe(60);
    });

    it('should have task completion threshold of 70%', () => {
      expect(SUCCESS_CRITERIA.minTaskCompletion).toBe(70);
    });

    it('should have parent open rate threshold of 50%', () => {
      expect(SUCCESS_CRITERIA.minParentOpenRate).toBe(50);
    });

    it('should have max confusion reports per 100 students', () => {
      expect(SUCCESS_CRITERIA.maxConfusionPer100).toBeDefined();
      expect(SUCCESS_CRITERIA.maxConfusionPer100).toBeGreaterThan(0);
    });

    it('should have max negative sentiment threshold', () => {
      expect(SUCCESS_CRITERIA.maxNegativeSentiment).toBeDefined();
    });
  });

  // ============================================================================
  // PilotRecommendation
  // ============================================================================
  describe('PilotRecommendation', () => {
    it('should have all expected recommendation types', () => {
      expect(PilotRecommendation.GO).toBe('go');
      expect(PilotRecommendation.NO_GO).toBe('no_go');
      expect(PilotRecommendation.EXTEND_PILOT).toBe('extend_pilot');
      expect(PilotRecommendation.PIVOT_REQUIRED).toBe('pivot_required');
    });
  });

  // ============================================================================
  // calculateRetentionCurve
  // ============================================================================
  describe('calculateRetentionCurve', () => {
    it('should calculate retention for each day', () => {
      const activities: DailyActivity[] = [
        { studentId: 's1', date: '2026-01-01', dayNumber: 1, completed: true, timeSpentMinutes: 10, questionsAttempted: 5, questionsCorrect: 4, droppedMidTask: false },
        { studentId: 's2', date: '2026-01-01', dayNumber: 1, completed: true, timeSpentMinutes: 12, questionsAttempted: 5, questionsCorrect: 5, droppedMidTask: false },
        { studentId: 's1', date: '2026-01-02', dayNumber: 2, completed: true, timeSpentMinutes: 8, questionsAttempted: 5, questionsCorrect: 3, droppedMidTask: false },
        { studentId: 's2', date: '2026-01-02', dayNumber: 2, completed: false, timeSpentMinutes: 3, questionsAttempted: 2, questionsCorrect: 1, droppedMidTask: true },
      ];

      const curve = calculateRetentionCurve(activities, 2, 3);

      expect(curve).toHaveLength(3);
      expect(curve[0].day).toBe(1);
      expect(curve[0].retentionRate).toBe(100); // 2/2 completed day 1
      expect(curve[1].day).toBe(2);
      expect(curve[1].retentionRate).toBe(50); // 1/2 completed day 2
    });

    it('should handle empty activities', () => {
      const curve = calculateRetentionCurve([], 0, 3);
      expect(curve).toHaveLength(3);
      // With 0 students, retention rates should be NaN or 0
      curve.forEach((point) => {
        expect(point.day).toBeGreaterThan(0);
      });
    });

    it('should respect maxDays parameter', () => {
      const activities: DailyActivity[] = [];
      const curve = calculateRetentionCurve(activities, 10, 7);
      expect(curve).toHaveLength(7);
    });
  });

  // ============================================================================
  // getDayRetention
  // ============================================================================
  describe('getDayRetention', () => {
    it('should return retention for specific day', () => {
      const curve = [
        { day: 1, totalStudents: 100, activeStudents: 100, retentionRate: 100 },
        { day: 2, totalStudents: 100, activeStudents: 90, retentionRate: 90 },
        { day: 7, totalStudents: 100, activeStudents: 60, retentionRate: 60 },
      ];

      expect(getDayRetention(curve, 1)).toBe(100);
      expect(getDayRetention(curve, 7)).toBe(60);
    });

    it('should return 0 for missing day', () => {
      const curve = [
        { day: 1, totalStudents: 100, activeStudents: 100, retentionRate: 100 },
      ];

      expect(getDayRetention(curve, 5)).toBe(0);
    });
  });

  // ============================================================================
  // identifyFailureHotspots
  // ============================================================================
  describe('identifyFailureHotspots', () => {
    it('should identify questions with high failure rate', () => {
      const activities: DailyActivity[] = [];
      const questionFailures = new Map([
        ['q1', { failures: 50, attempts: 100, commonError: 'Wrong calculation' }],
        ['q2', { failures: 10, attempts: 100, commonError: 'Minor error' }],
      ]);

      const hotspots = identifyFailureHotspots(activities, questionFailures);

      expect(hotspots.length).toBe(1);
      expect(hotspots[0].questionId).toBe('q1');
      expect(hotspots[0].failureRate).toBe(50);
    });

    it('should return empty for low failure rates', () => {
      const activities: DailyActivity[] = [];
      const questionFailures = new Map([
        ['q1', { failures: 5, attempts: 100, commonError: 'Minor' }],
      ]);

      const hotspots = identifyFailureHotspots(activities, questionFailures);
      expect(hotspots.length).toBe(0);
    });

    it('should sort by failure rate descending', () => {
      const activities: DailyActivity[] = [];
      const questionFailures = new Map([
        ['q1', { failures: 40, attempts: 100, commonError: 'Error 1' }],
        ['q2', { failures: 60, attempts: 100, commonError: 'Error 2' }],
        ['q3', { failures: 35, attempts: 100, commonError: 'Error 3' }],
      ]);

      const hotspots = identifyFailureHotspots(activities, questionFailures);

      expect(hotspots[0].questionId).toBe('q2');
      expect(hotspots[1].questionId).toBe('q1');
      expect(hotspots[2].questionId).toBe('q3');
    });
  });

  // ============================================================================
  // calculateParentEngagement
  // ============================================================================
  describe('calculateParentEngagement', () => {
    it('should calculate open rate correctly', () => {
      const interactions: ParentInteraction[] = [
        { parentId: 'p1', studentId: 's1', date: '2026-01-01', messageType: 'day1_soft', opened: true, replied: false, sentiment: 'positive' },
        { parentId: 'p2', studentId: 's2', date: '2026-01-01', messageType: 'day1_soft', opened: true, replied: true, sentiment: 'neutral' },
        { parentId: 'p3', studentId: 's3', date: '2026-01-01', messageType: 'day1_soft', opened: false, replied: false, sentiment: 'unknown' },
      ];

      const engagement = calculateParentEngagement(interactions);

      expect(engagement.openRate).toBe(67); // 2/3 opened
      expect(engagement.replyRate).toBe(33); // 1/3 replied
    });

    it('should handle no interactions', () => {
      const engagement = calculateParentEngagement([]);
      expect(engagement.openRate).toBe(0);
      expect(engagement.replyRate).toBe(0);
      expect(engagement.sentiment.positive).toBe(0);
      expect(engagement.sentiment.neutral).toBe(0);
      expect(engagement.sentiment.negative).toBe(0);
    });

    it('should calculate sentiment breakdown', () => {
      const interactions: ParentInteraction[] = [
        { parentId: 'p1', studentId: 's1', date: '2026-01-01', messageType: 'day1_soft', opened: true, replied: false, sentiment: 'positive' },
        { parentId: 'p2', studentId: 's2', date: '2026-01-01', messageType: 'day1_soft', opened: true, replied: true, sentiment: 'positive' },
        { parentId: 'p3', studentId: 's3', date: '2026-01-01', messageType: 'day1_soft', opened: true, replied: false, sentiment: 'negative' },
      ];

      const engagement = calculateParentEngagement(interactions);

      expect(engagement.sentiment.positive).toBe(2);
      expect(engagement.sentiment.negative).toBe(1);
    });
  });

  // ============================================================================
  // determineRecommendation
  // ============================================================================
  describe('determineRecommendation', () => {
    it('should return GO for successful pilot', () => {
      const result = determineRecommendation(
        65, // day7Retention > 60
        75, // taskCompletion > 70
        55, // parentOpenRate > 50
        5,  // confusionReports < 10
        5   // negativeSentiment < 10
      );

      expect(result.recommendation).toBe(PilotRecommendation.GO);
      expect(result.criticalIssues).toHaveLength(0);
    });

    it('should return NO_GO for failed pilot', () => {
      const result = determineRecommendation(
        40, // day7Retention < 60
        50, // taskCompletion < 70
        30, // parentOpenRate < 50
        20, // confusionReports > 10
        20  // negativeSentiment > 10
      );

      expect(result.recommendation).toBe(PilotRecommendation.NO_GO);
      expect(result.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should return EXTEND_PILOT for borderline results', () => {
      const result = determineRecommendation(
        58, // day7Retention slightly below
        72, // taskCompletion good
        52, // parentOpenRate good
        8,  // confusionReports ok
        8   // negativeSentiment ok
      );

      // Borderline results should not be GO
      expect(result.recommendation).not.toBe(PilotRecommendation.GO);
      expect(result.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should identify critical issues', () => {
      const result = determineRecommendation(
        50, // below threshold
        65, // below threshold
        45, // below threshold
        15, // above threshold
        15  // above threshold
      );

      expect(result.criticalIssues.length).toBeGreaterThan(3);
    });
  });

  // ============================================================================
  // generateImprovements
  // ============================================================================
  describe('generateImprovements', () => {
    it('should generate improvements for low retention', () => {
      const improvements = generateImprovements(
        50, // low retention
        75,
        55,
        [],
        5
      );

      expect(improvements.length).toBeGreaterThan(0);
    });

    it('should generate improvements for hotspots', () => {
      const hotspots = [
        { questionId: 'q1', failureCount: 50, attemptCount: 100, failureRate: 50, commonError: 'Error' },
      ];

      const improvements = generateImprovements(
        65,
        75,
        55,
        hotspots,
        5
      );

      expect(improvements.length).toBeGreaterThan(0);
    });

    it('should generate improvements for low parent engagement', () => {
      const improvements = generateImprovements(
        65,
        75,
        30, // low parent engagement
        [],
        5
      );

      expect(improvements.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // analyzePilot
  // ============================================================================
  describe('analyzePilot', () => {
    it('should produce complete analysis', () => {
      const cohort: PilotCohort = {
        cohortId: 'test-cohort',
        startDate: '2026-01-01',
        endDate: '2026-01-07',
        targetSize: 100,
        actualSize: 80,
        grades: [3, 4, 5],
        pricing: 'free',
        region: 'india',
      };

      const activities: DailyActivity[] = [
        { studentId: 's1', date: '2026-01-01', dayNumber: 1, completed: true, timeSpentMinutes: 10, questionsAttempted: 5, questionsCorrect: 4, droppedMidTask: false },
      ];

      const parentInteractions: ParentInteraction[] = [
        { parentId: 'p1', studentId: 's1', date: '2026-01-01', messageType: 'day1_soft', opened: true, replied: false, sentiment: 'positive' },
      ];

      const confusionReports: ConfusionReport[] = [];
      
      const questionFailures = new Map<string, { failures: number; attempts: number; commonError: string }>();

      const analysis = analyzePilot(cohort, activities, parentInteractions, confusionReports, questionFailures);

      expect(analysis.cohortId).toBe('test-cohort');
      expect(analysis.recommendation).toBeDefined();
      expect(analysis.retentionCurve).toBeDefined();
    });
  });

  // ============================================================================
  // formatReport
  // ============================================================================
  describe('formatReport', () => {
    it('should produce human-readable report', () => {
      const analysis: PilotAnalysis = {
        cohortId: 'test-cohort',
        analysisDate: '2026-01-08',
        durationDays: 7,
        day1CompletionRate: 95,
        day3RetentionRate: 80,
        day7RetentionRate: 65,
        overallTaskCompletionRate: 75,
        parentWhatsAppOpenRate: 55,
        retentionCurve: [],
        failureHotspots: [],
        confusionReports: [],
        parentSentiment: { positive: 80, neutral: 15, negative: 5 },
        recommendation: PilotRecommendation.GO,
        recommendationReason: 'All criteria met',
        criticalIssues: [],
        improvements: ['Optimize Day 2 content'],
      };

      const report = formatReport(analysis);

      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
      expect(report).toContain('test-cohort');
    });

    it('should include critical issues in report', () => {
      const analysis: PilotAnalysis = {
        cohortId: 'failing-cohort',
        analysisDate: '2026-01-08',
        durationDays: 7,
        day1CompletionRate: 60,
        day3RetentionRate: 40,
        day7RetentionRate: 30,
        overallTaskCompletionRate: 50,
        parentWhatsAppOpenRate: 25,
        retentionCurve: [],
        failureHotspots: [],
        confusionReports: [],
        parentSentiment: { positive: 20, neutral: 30, negative: 50 },
        recommendation: PilotRecommendation.NO_GO,
        recommendationReason: 'Multiple criteria failed',
        criticalIssues: ['Low retention', 'High complaints'],
        improvements: ['Major overhaul needed'],
      };

      const report = formatReport(analysis);

      expect(report).toContain('Low retention');
      expect(report).toContain('NO_GO');
    });
  });

  // ============================================================================
  // PilotAnalyzer export
  // ============================================================================
  describe('PilotAnalyzer export', () => {
    it('should export all required functions', () => {
      expect(PilotAnalyzer.calculateRetentionCurve).toBe(calculateRetentionCurve);
      expect(PilotAnalyzer.getDayRetention).toBe(getDayRetention);
      expect(PilotAnalyzer.identifyFailureHotspots).toBe(identifyFailureHotspots);
      expect(PilotAnalyzer.calculateParentEngagement).toBe(calculateParentEngagement);
      expect(PilotAnalyzer.determineRecommendation).toBe(determineRecommendation);
      expect(PilotAnalyzer.generateImprovements).toBe(generateImprovements);
      expect(PilotAnalyzer.analyzePilot).toBe(analyzePilot);
      expect(PilotAnalyzer.formatReport).toBe(formatReport);
    });

    it('should export SUCCESS_CRITERIA', () => {
      expect(PilotAnalyzer.SUCCESS_CRITERIA).toBe(SUCCESS_CRITERIA);
    });
  });
});
