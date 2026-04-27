/**
 * FILE OBJECTIVE:
 * - Unit tests for first week orchestrator module.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/onboarding/firstWeekOrchestrator.spec.ts (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-05T00:00:00Z | copilot | created test suite
 */

import {
  FirstWeekOrchestrator,
  DAY_CONFIGS,
  PARENT_MESSAGES,
  MAX_DAILY_MINUTES,
  createFirstWeekPlan,
  getDailyTask,
  calculateEffectiveDifficulty,
  shouldSendParentMessage,
  formatParentMessage,
  validateDaySuccess,
  calculateImprovement,
  isReadyForCelebration,
  getAIRulesForDay,
  shouldAIIntervene,
  DayTaskType,
  type FirstWeekDay,
  type DailyProgress,
} from '@/lib/onboarding/firstWeekOrchestrator';

describe('FirstWeekOrchestrator', () => {
  // ============================================================================
  // CONSTANTS
  // ============================================================================
  describe('MAX_DAILY_MINUTES', () => {
    it('should be 15 minutes', () => {
      expect(MAX_DAILY_MINUTES).toBe(15);
    });
  });

  // ============================================================================
  // DAY_CONFIGS
  // ============================================================================
  describe('DAY_CONFIGS', () => {
    it('should have configurations for all 7 days', () => {
      expect(Object.keys(DAY_CONFIGS)).toHaveLength(7);
      for (let i = 1; i <= 7; i++) {
        expect(DAY_CONFIGS[i as FirstWeekDay]).toBeDefined();
      }
    });

    it('should have all required properties for each day', () => {
      for (let i = 1; i <= 7; i++) {
        const config = DAY_CONFIGS[i as FirstWeekDay];
        expect(config.taskType).toBeDefined();
        expect(config.targetEmotion).toBeDefined();
        expect(config.difficultyLevel).toBeDefined();
        expect(config.maxTimeMinutes).toBeGreaterThan(0);
        expect(config.maxQuestions).toBeGreaterThan(0);
        expect(config.maxWrongAllowed).toBeGreaterThanOrEqual(0);
        expect(typeof config.hintsEnabled).toBe('boolean');
        expect(config.focusArea).toBeDefined();
        expect(Array.isArray(config.aiRules)).toBe(true);
        expect(config.successCriteria).toBeDefined();
      }
    });

    it('should have day 1 configured for confidence building (difficulty -2)', () => {
      expect(DAY_CONFIGS[1].difficultyLevel).toBe(-2);
      expect(DAY_CONFIGS[1].taskType).toBe(DayTaskType.CONFIDENCE_WIN);
    });

    it('should have day 7 as celebration day', () => {
      expect(DAY_CONFIGS[7].taskType).toBe(DayTaskType.CELEBRATION);
    });

    it('should not allow wrong answers on day 1 (100% completion)', () => {
      expect(DAY_CONFIGS[1].maxWrongAllowed).toBe(0);
    });

    it('should have hints enabled for all days', () => {
      for (let i = 1; i <= 7; i++) {
        expect(DAY_CONFIGS[i as FirstWeekDay].hintsEnabled).toBe(true);
      }
    });
  });

  // ============================================================================
  // PARENT_MESSAGES
  // ============================================================================
  describe('PARENT_MESSAGES', () => {
    it('should have messages for days 1, 4, and 7', () => {
      const messageDays = PARENT_MESSAGES.map(m => m.day);
      expect(messageDays).toContain(1);
      expect(messageDays).toContain(4);
      expect(messageDays).toContain(7);
    });

    it('should have both Hindi and English templates', () => {
      for (const message of PARENT_MESSAGES) {
        expect(message.templateHi).toBeDefined();
        expect(message.templateEn).toBeDefined();
        expect(message.templateHi.length).toBeGreaterThan(0);
        expect(message.templateEn.length).toBeGreaterThan(0);
      }
    });

    it('should contain placeholders for personalization', () => {
      const day1 = PARENT_MESSAGES.find(m => m.day === 1);
      expect(day1?.templateHi).toContain('{studentName}');
      expect(day1?.templateEn).toContain('{studentName}');
    });

    it('should mark day 4 and 7 as mandatory', () => {
      const day4 = PARENT_MESSAGES.find(m => m.day === 4);
      const day7 = PARENT_MESSAGES.find(m => m.day === 7);
      expect(day4?.mandatory).toBe(true);
      expect(day7?.mandatory).toBe(true);
    });
  });

  // ============================================================================
  // createFirstWeekPlan
  // ============================================================================
  describe('createFirstWeekPlan', () => {
    it('should create a plan with all 7 daily tasks', () => {
      const plan = createFirstWeekPlan('test-student', 5, 'Mathematics');

      expect(plan.studentId).toBe('test-student');
      expect(plan.grade).toBe(5);
      expect(plan.subject).toBe('Mathematics');
      expect(plan.dailyTasks).toHaveLength(7);
    });

    it('should include parent messages', () => {
      const plan = createFirstWeekPlan('test-student', 5, 'Mathematics');
      expect(plan.parentMessages).toBeDefined();
      expect(plan.parentMessages.length).toBeGreaterThan(0);
    });

    it('should have createdAt timestamp', () => {
      const plan = createFirstWeekPlan('test-student', 5, 'Mathematics');
      expect(plan.createdAt).toBeDefined();
      expect(new Date(plan.createdAt).getTime()).not.toBeNaN();
    });
  });

  // ============================================================================
  // getDailyTask
  // ============================================================================
  describe('getDailyTask', () => {
    it('should return correct task for valid day', () => {
      const plan = createFirstWeekPlan('test-student', 5, 'Mathematics');
      const task = getDailyTask(plan, 3);
      
      expect(task).toBeDefined();
      expect(task.day).toBe(3);
      expect(task.taskType).toBe(DayTaskType.PATTERN_RECOGNITION);
    });

    it('should throw for invalid day', () => {
      const plan = createFirstWeekPlan('test-student', 5, 'Mathematics');
      expect(() => getDailyTask(plan, 8 as FirstWeekDay)).toThrow();
    });
  });

  // ============================================================================
  // calculateEffectiveDifficulty
  // ============================================================================
  describe('calculateEffectiveDifficulty', () => {
    it('should calculate correct difficulty for day 1 (grade - 2)', () => {
      const plan = createFirstWeekPlan('test-student', 5, 'Mathematics');
      const task = getDailyTask(plan, 1);
      const difficulty = calculateEffectiveDifficulty(5, task);

      // Day 1: grade 5 + (-2) = difficulty 3
      expect(difficulty).toBe(3);
    });

    it('should not allow difficulty below 1', () => {
      const plan = createFirstWeekPlan('test-student', 1, 'Mathematics');
      const task = getDailyTask(plan, 1);
      const difficulty = calculateEffectiveDifficulty(1, task);

      // Grade 1 + (-2) would be -1, but should cap at 1
      expect(difficulty).toBeGreaterThanOrEqual(1);
    });

    it('should return grade level difficulty for day 4 (offset 0)', () => {
      const plan = createFirstWeekPlan('test-student', 5, 'Mathematics');
      const task = getDailyTask(plan, 4);
      const difficulty = calculateEffectiveDifficulty(5, task);

      // Day 4: grade 5 + 0 = difficulty 5
      expect(difficulty).toBe(5);
    });
  });

  // ============================================================================
  // shouldSendParentMessage
  // ============================================================================
  describe('shouldSendParentMessage', () => {
    it('should return message for day 1', () => {
      const message = shouldSendParentMessage(1);
      expect(message).not.toBeNull();
      expect(message?.day).toBe(1);
    });

    it('should return null for non-message days', () => {
      expect(shouldSendParentMessage(2)).toBeNull();
      expect(shouldSendParentMessage(3)).toBeNull();
      expect(shouldSendParentMessage(5)).toBeNull();
      expect(shouldSendParentMessage(6)).toBeNull();
    });

    it('should return messages for days 1, 4, and 7 only', () => {
      expect(shouldSendParentMessage(1)).not.toBeNull();
      expect(shouldSendParentMessage(4)).not.toBeNull();
      expect(shouldSendParentMessage(7)).not.toBeNull();
    });
  });

  // ============================================================================
  // formatParentMessage
  // ============================================================================
  describe('formatParentMessage', () => {
    it('should format Hindi message with student name', () => {
      const message = PARENT_MESSAGES.find(m => m.day === 1)!;
      const formatted = formatParentMessage(message, { studentName: 'Rahul' }, 'hi');
      
      expect(formatted).toContain('Rahul');
      expect(formatted).not.toContain('{studentName}');
    });

    it('should format English message with student name', () => {
      const message = PARENT_MESSAGES.find(m => m.day === 1)!;
      const formatted = formatParentMessage(message, { studentName: 'Rahul' }, 'en');
      
      expect(formatted).toContain('Rahul');
      expect(formatted).not.toContain('{studentName}');
    });

    it('should format day 4 message with completion rate', () => {
      const message = PARENT_MESSAGES.find(m => m.day === 4)!;
      const formatted = formatParentMessage(
        message,
        { studentName: 'Rahul', completionRate: 85 },
        'en'
      );
      
      expect(formatted).toContain('85');
    });

    it('should format day 7 message with streak and improvement', () => {
      const message = PARENT_MESSAGES.find(m => m.day === 7)!;
      const formatted = formatParentMessage(
        message,
        { studentName: 'Rahul', streakDays: 7, improvementPercent: 25 },
        'en'
      );
      
      expect(formatted).toContain('7');
      expect(formatted).toContain('25');
    });
  });

  // ============================================================================
  // validateDaySuccess
  // ============================================================================
  describe('validateDaySuccess', () => {
    it('should validate completed day progress', () => {
      const progress: DailyProgress = {
        day: 1,
        completed: true,
        timeSpent: 10,
        questionsAttempted: 5,
        questionsCorrect: 5,
        hintsUsed: 2,
        showedStruggle: false,
        endedWithSuccess: true,
      };

      const result = validateDaySuccess(1, progress);
      expect(result.success).toBe(true);
    });

    it('should fail if day did not end with success', () => {
      const progress: DailyProgress = {
        day: 1,
        completed: true,
        timeSpent: 10,
        questionsAttempted: 5,
        questionsCorrect: 3,
        hintsUsed: 2,
        showedStruggle: true,
        endedWithSuccess: false,
      };

      const result = validateDaySuccess(1, progress);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('success');
    });

    it('should still succeed with extra mistakes if completed', () => {
      const progress: DailyProgress = {
        day: 1,
        completed: true,
        timeSpent: 10,
        questionsAttempted: 5,
        questionsCorrect: 2, // Too many wrong
        hintsUsed: 3,
        showedStruggle: true,
        endedWithSuccess: true,
      };

      const result = validateDaySuccess(1, progress);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // calculateImprovement
  // ============================================================================
  describe('calculateImprovement', () => {
    it('should calculate positive improvement', () => {
      const day2Progress: DailyProgress = {
        day: 2,
        completed: true,
        timeSpent: 12,
        questionsAttempted: 6,
        questionsCorrect: 4,
        hintsUsed: 2,
        showedStruggle: false,
        endedWithSuccess: true,
      };

      const day5Progress: DailyProgress = {
        day: 5,
        completed: true,
        timeSpent: 10, // Faster
        questionsAttempted: 6,
        questionsCorrect: 5, // More accurate
        hintsUsed: 1,
        showedStruggle: false,
        endedWithSuccess: true,
      };

      const improvement = calculateImprovement(day2Progress, day5Progress);
      expect(improvement).toBeGreaterThan(0);
    });

    it('should calculate negative improvement for regression', () => {
      const day2Progress: DailyProgress = {
        day: 2,
        completed: true,
        timeSpent: 10,
        questionsAttempted: 6,
        questionsCorrect: 5,
        hintsUsed: 1,
        showedStruggle: false,
        endedWithSuccess: true,
      };

      const day5Progress: DailyProgress = {
        day: 5,
        completed: true,
        timeSpent: 15, // Slower
        questionsAttempted: 6,
        questionsCorrect: 3, // Less accurate
        hintsUsed: 3,
        showedStruggle: true,
        endedWithSuccess: true,
      };

      const improvement = calculateImprovement(day2Progress, day5Progress);
      expect(improvement).toBeLessThan(0);
    });
  });

  // ============================================================================
  // isReadyForCelebration
  // ============================================================================
  describe('isReadyForCelebration', () => {
    it('should be ready with all 6 days completed', () => {
      const history: DailyProgress[] = Array.from({ length: 6 }, (_, i) => ({
        day: (i + 1) as FirstWeekDay,
        completed: true,
        timeSpent: 10,
        questionsAttempted: 5,
        questionsCorrect: 4,
        hintsUsed: 1,
        showedStruggle: false,
        endedWithSuccess: true,
      }));

      const result = isReadyForCelebration(history);
      expect(result.ready).toBe(true);
      expect(result.streakDays).toBe(6);
      expect(result.completionRate).toBe(100);
    });

    it('should be ready with 5 of 6 days completed', () => {
      const history: DailyProgress[] = Array.from({ length: 6 }, (_, i) => ({
        day: (i + 1) as FirstWeekDay,
        completed: i !== 2, // Day 3 not completed
        timeSpent: 10,
        questionsAttempted: 5,
        questionsCorrect: 4,
        hintsUsed: 1,
        showedStruggle: false,
        endedWithSuccess: i !== 2,
      }));

      const result = isReadyForCelebration(history);
      expect(result.ready).toBe(true);
      expect(result.completionRate).toBeGreaterThanOrEqual(80);
    });

    it('should not be ready with less than 5 days completed', () => {
      const history: DailyProgress[] = Array.from({ length: 6 }, (_, i) => ({
        day: (i + 1) as FirstWeekDay,
        completed: i < 4, // Only 4 days completed
        timeSpent: 10,
        questionsAttempted: 5,
        questionsCorrect: 4,
        hintsUsed: 1,
        showedStruggle: false,
        endedWithSuccess: i < 4,
      }));

      const result = isReadyForCelebration(history);
      expect(result.ready).toBe(false);
    });
  });

  // ============================================================================
  // getAIRulesForDay
  // ============================================================================
  describe('getAIRulesForDay', () => {
    it('should return base rules for all days', () => {
      for (let i = 1; i <= 7; i++) {
        const rules = getAIRulesForDay(i as FirstWeekDay);
        expect(rules.some(r => r.includes('syllabus'))).toBe(true);
        expect(rules.some(r => r.includes('grades') || r.includes('ranks'))).toBe(true);
        expect(rules.some(r => r.includes('pressure'))).toBe(true);
        expect(rules.some(r => r.includes('success'))).toBe(true);
      }
    });

    it('should include max time rule', () => {
      const rules = getAIRulesForDay(1);
      expect(rules.some(r => r.includes(String(MAX_DAILY_MINUTES)))).toBe(true);
    });

    it('should include day-specific rules', () => {
      const day1Rules = getAIRulesForDay(1);
      expect(day1Rules.some(r => r.toLowerCase().includes('easy'))).toBe(true);

      const day7Rules = getAIRulesForDay(7);
      expect(day7Rules.some(r => r.toLowerCase().includes('recap') || r.toLowerCase().includes('celebration'))).toBe(true);
    });
  });

  // ============================================================================
  // shouldAIIntervene
  // ============================================================================
  describe('shouldAIIntervene', () => {
    it('should intervene after 2 consecutive wrong answers', () => {
      const result = shouldAIIntervene(2, 30, 60);
      expect(result.shouldIntervene).toBe(true);
      expect(result.reason).toBe('consecutive_failures');
      expect(result.action).toBe('reduce_difficulty');
    });

    it('should intervene when taking 2x average time', () => {
      const result = shouldAIIntervene(0, 120, 50); // 120s when average is 50s
      expect(result.shouldIntervene).toBe(true);
      expect(result.reason).toBe('time_struggle');
      expect(result.action).toBe('show_hint');
    });

    it('should not intervene for normal progress', () => {
      const result = shouldAIIntervene(1, 30, 60);
      expect(result.shouldIntervene).toBe(false);
      expect(result.reason).toBe('none');
      expect(result.action).toBe('continue');
    });
  });

  // ============================================================================
  // FirstWeekOrchestrator export
  // ============================================================================
  describe('FirstWeekOrchestrator export', () => {
    it('should export all required functions', () => {
      expect(FirstWeekOrchestrator.createFirstWeekPlan).toBe(createFirstWeekPlan);
      expect(FirstWeekOrchestrator.getDailyTask).toBe(getDailyTask);
      expect(FirstWeekOrchestrator.calculateEffectiveDifficulty).toBe(calculateEffectiveDifficulty);
      expect(FirstWeekOrchestrator.shouldSendParentMessage).toBe(shouldSendParentMessage);
      expect(FirstWeekOrchestrator.formatParentMessage).toBe(formatParentMessage);
      expect(FirstWeekOrchestrator.validateDaySuccess).toBe(validateDaySuccess);
      expect(FirstWeekOrchestrator.calculateImprovement).toBe(calculateImprovement);
      expect(FirstWeekOrchestrator.isReadyForCelebration).toBe(isReadyForCelebration);
      expect(FirstWeekOrchestrator.getAIRulesForDay).toBe(getAIRulesForDay);
      expect(FirstWeekOrchestrator.shouldAIIntervene).toBe(shouldAIIntervene);
    });

    it('should export constants', () => {
      expect(FirstWeekOrchestrator.DAY_CONFIGS).toBe(DAY_CONFIGS);
      expect(FirstWeekOrchestrator.PARENT_MESSAGES).toBe(PARENT_MESSAGES);
      expect(FirstWeekOrchestrator.MAX_DAILY_MINUTES).toBe(MAX_DAILY_MINUTES);
    });
  });
});
