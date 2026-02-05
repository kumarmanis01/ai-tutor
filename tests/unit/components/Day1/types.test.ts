/**
 * FILE OBJECTIVE:
 * - Unit tests for Day-1 types and constants.
 * - Verify hard rules are enforced.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Day1/types.test.ts (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | copilot | created type tests
 */

import {
  Day1Screen,
  DAY1_RULES,
  DAY1_BANNED_FEATURES,
  WELCOME_COPY_HI,
  WELCOME_COPY_EN,
  TODAYS_TASK_COPY_HI,
  TODAYS_TASK_COPY_EN,
  COMPLETION_COPY_HI,
  COMPLETION_COPY_EN,
  CELEBRATION_COPY_HI,
  CELEBRATION_COPY_EN,
  PARENT_MESSAGE_TEMPLATE_HI,
  PARENT_MESSAGE_TEMPLATE_EN,
} from '@/components/Day1/types';

describe('Day-1 Types', () => {
  // ============================================================================
  // Day1Screen Enum
  // ============================================================================
  describe('Day1Screen', () => {
    it('should have EXACTLY 4 screens', () => {
      const screens = Object.values(Day1Screen);
      expect(screens).toHaveLength(4);
    });

    it('should have correct screen identifiers', () => {
      expect(Day1Screen.WELCOME).toBe('welcome');
      expect(Day1Screen.TODAYS_TASK).toBe('todays_task');
      expect(Day1Screen.TASK_COMPLETION).toBe('task_completion');
      expect(Day1Screen.CELEBRATION).toBe('celebration');
    });
  });

  // ============================================================================
  // DAY1_RULES Constants
  // ============================================================================
  describe('DAY1_RULES', () => {
    it('should have max session time of 15 minutes', () => {
      expect(DAY1_RULES.MAX_SESSION_MINUTES).toBe(15);
    });

    it('should have min session time of 8 minutes', () => {
      expect(DAY1_RULES.MIN_SESSION_MINUTES).toBe(8);
    });

    it('should have difficulty offset of -2', () => {
      expect(DAY1_RULES.DIFFICULTY_OFFSET).toBe(-2);
    });

    it('should allow max 3 questions', () => {
      expect(DAY1_RULES.MAX_QUESTIONS).toBe(3);
    });

    it('should have celebration animation under 2 seconds', () => {
      expect(DAY1_RULES.CELEBRATION_ANIMATION_MS).toBeLessThanOrEqual(2000);
    });

    it('should have exactly 4 total screens', () => {
      expect(DAY1_RULES.TOTAL_SCREENS).toBe(4);
    });
  });

  // ============================================================================
  // DAY1_BANNED_FEATURES
  // ============================================================================
  describe('DAY1_BANNED_FEATURES', () => {
    it('should ban syllabus view', () => {
      expect(DAY1_BANNED_FEATURES).toContain('syllabus_view');
    });

    it('should ban dashboard', () => {
      expect(DAY1_BANNED_FEATURES).toContain('dashboard');
    });

    it('should ban difficulty labels', () => {
      expect(DAY1_BANNED_FEATURES).toContain('difficulty_labels');
    });

    it('should ban leaderboards', () => {
      expect(DAY1_BANNED_FEATURES).toContain('leaderboards');
    });

    it('should ban streak pressure', () => {
      expect(DAY1_BANNED_FEATURES).toContain('streak_pressure');
    });

    it('should ban assessment language', () => {
      expect(DAY1_BANNED_FEATURES).toContain('assessment_language');
    });

    it('should ban percentage scores', () => {
      expect(DAY1_BANNED_FEATURES).toContain('percentage_scores');
    });

    it('should ban correct/incorrect count', () => {
      expect(DAY1_BANNED_FEATURES).toContain('correct_incorrect_count');
    });

    it('should ban comparison with others', () => {
      expect(DAY1_BANNED_FEATURES).toContain('comparison_with_others');
    });
  });

  // ============================================================================
  // Welcome Copy
  // ============================================================================
  describe('WELCOME_COPY', () => {
    it('should have greeting function in Hindi', () => {
      expect(typeof WELCOME_COPY_HI.greeting).toBe('function');
      expect(WELCOME_COPY_HI.greeting('Aarav')).toContain('Aarav');
    });

    it('should have greeting function in English', () => {
      expect(typeof WELCOME_COPY_EN.greeting).toBe('function');
      expect(WELCOME_COPY_EN.greeting('John')).toContain('John');
    });

    it('should mention time limit in Hindi copy', () => {
      expect(WELCOME_COPY_HI.body).toMatch(/10.*15|15.*10/);
    });

    it('should mention time limit in English copy', () => {
      expect(WELCOME_COPY_EN.body).toMatch(/10.*15|15.*10/);
    });

    it('should mention mistakes are okay in Hindi', () => {
      expect(WELCOME_COPY_HI.body.toLowerCase()).toMatch(/galti|problem nahi/i);
    });

    it('should mention mistakes are okay in English', () => {
      expect(WELCOME_COPY_EN.body.toLowerCase()).toMatch(/mistake|okay/i);
    });

    it('should have exactly one CTA in Hindi', () => {
      expect(WELCOME_COPY_HI.cta).toBeDefined();
      expect(typeof WELCOME_COPY_HI.cta).toBe('string');
    });

    it('should have exactly one CTA in English', () => {
      expect(WELCOME_COPY_EN.cta).toBeDefined();
      expect(typeof WELCOME_COPY_EN.cta).toBe('string');
    });
  });

  // ============================================================================
  // Today's Task Copy
  // ============================================================================
  describe('TODAYS_TASK_COPY', () => {
    it('should NOT mention difficulty in Hindi', () => {
      const fullCopy = `${TODAYS_TASK_COPY_HI.title} ${TODAYS_TASK_COPY_HI.subtitle}`;
      expect(fullCopy.toLowerCase()).not.toMatch(/hard|easy|difficult|mushkil|aasan level/);
    });

    it('should NOT mention difficulty in English', () => {
      const fullCopy = `${TODAYS_TASK_COPY_EN.title} ${TODAYS_TASK_COPY_EN.subtitle}`;
      expect(fullCopy.toLowerCase()).not.toMatch(/hard|easy level|difficult|beginner/);
    });

    it('should mention time estimate', () => {
      expect(TODAYS_TASK_COPY_HI.subtitle).toMatch(/minute/i);
      expect(TODAYS_TASK_COPY_EN.subtitle).toMatch(/minute/i);
    });
  });

  // ============================================================================
  // Completion Copy
  // ============================================================================
  describe('COMPLETION_COPY', () => {
    it('should NOT mention scores in Hindi', () => {
      const fullCopy = `${COMPLETION_COPY_HI.header} ${COMPLETION_COPY_HI.message}`;
      expect(fullCopy.toLowerCase()).not.toMatch(/score|marks|%|percent/);
    });

    it('should NOT mention scores in English', () => {
      const fullCopy = `${COMPLETION_COPY_EN.header} ${COMPLETION_COPY_EN.message}`;
      expect(fullCopy.toLowerCase()).not.toMatch(/score|marks|%|percent/);
    });

    it('should NOT mention correct/incorrect count in Hindi', () => {
      const fullCopy = `${COMPLETION_COPY_HI.header} ${COMPLETION_COPY_HI.message}`;
      expect(fullCopy.toLowerCase()).not.toMatch(/correct|galat|wrong|sahi/);
    });

    it('should NOT mention correct/incorrect count in English', () => {
      const fullCopy = `${COMPLETION_COPY_EN.header} ${COMPLETION_COPY_EN.message}`;
      expect(fullCopy.toLowerCase()).not.toMatch(/correct|incorrect|wrong|right answer/);
    });

    it('should mention tomorrow lightly in Hindi', () => {
      expect(COMPLETION_COPY_HI.secondary).toMatch(/kal/i);
    });

    it('should mention tomorrow lightly in English', () => {
      expect(COMPLETION_COPY_EN.secondary).toMatch(/tomorrow/i);
    });
  });

  // ============================================================================
  // Celebration Copy
  // ============================================================================
  describe('CELEBRATION_COPY', () => {
    it('should NOT have streak pressure in Hindi', () => {
      const fullCopy = `${CELEBRATION_COPY_HI.title} ${CELEBRATION_COPY_HI.subtitle}`;
      expect(fullCopy.toLowerCase()).not.toMatch(/streak|consecutive|days in a row/);
    });

    it('should NOT have streak pressure in English', () => {
      const fullCopy = `${CELEBRATION_COPY_EN.title} ${CELEBRATION_COPY_EN.subtitle}`;
      expect(fullCopy.toLowerCase()).not.toMatch(/streak|consecutive|days in a row/);
    });

    it('should NOT have competitive language in Hindi', () => {
      const fullCopy = `${CELEBRATION_COPY_HI.title} ${CELEBRATION_COPY_HI.subtitle}`;
      expect(fullCopy.toLowerCase()).not.toMatch(/best|top|winner|beat|competition/);
    });

    it('should NOT have competitive language in English', () => {
      const fullCopy = `${CELEBRATION_COPY_EN.title} ${CELEBRATION_COPY_EN.subtitle}`;
      expect(fullCopy.toLowerCase()).not.toMatch(/best|top|winner|beat|competition/);
    });
  });

  // ============================================================================
  // Parent Message Template
  // ============================================================================
  describe('PARENT_MESSAGE_TEMPLATE', () => {
    it('should NOT promise results in Hindi', () => {
      const message = PARENT_MESSAGE_TEMPLATE_HI('TestChild');
      expect(message.toLowerCase()).not.toMatch(/guarantee|promise|definitely|topper/);
    });

    it('should NOT promise results in English', () => {
      const message = PARENT_MESSAGE_TEMPLATE_EN('TestChild');
      expect(message.toLowerCase()).not.toMatch(/guarantee|promise|definitely|topper/);
    });

    it('should NOT compare with others in Hindi', () => {
      const message = PARENT_MESSAGE_TEMPLATE_HI('TestChild');
      expect(message.toLowerCase()).not.toMatch(/other students|doosron se|compare/);
    });

    it('should NOT compare with others in English', () => {
      const message = PARENT_MESSAGE_TEMPLATE_EN('TestChild');
      expect(message.toLowerCase()).not.toMatch(/other students|compare|competition/);
    });

    it('should be under 60 words in Hindi', () => {
      const message = PARENT_MESSAGE_TEMPLATE_HI('TestChild');
      const wordCount = message.split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(60);
    });

    it('should be under 60 words in English', () => {
      const message = PARENT_MESSAGE_TEMPLATE_EN('TestChild');
      const wordCount = message.split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(60);
    });

    it('should include child name in Hindi', () => {
      const message = PARENT_MESSAGE_TEMPLATE_HI('Aarav');
      expect(message).toContain('Aarav');
    });

    it('should include child name in English', () => {
      const message = PARENT_MESSAGE_TEMPLATE_EN('John');
      expect(message).toContain('John');
    });
  });
});
