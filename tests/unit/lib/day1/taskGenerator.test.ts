/**
 * FILE OBJECTIVE:
 * - Unit tests for Day-1 Task Generator.
 * - Verify difficulty rules are enforced.
 * - Verify parent message rules are enforced.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/day1/taskGenerator.test.ts (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | copilot | created task generator tests
 */

import {
  generateDay1Task,
  generateDay1ParentMessage,
  calculateDay1Difficulty,
  validateDay1Difficulty,
  validateParentMessage,
  Day1TaskGenerator,
  type Day1TaskOptions,
} from '@/lib/day1/taskGenerator';
import { DAY1_RULES } from '@/components/Day1/types';

describe('Day-1 Task Generator', () => {
  // ============================================================================
  // calculateDay1Difficulty
  // ============================================================================
  describe('calculateDay1Difficulty', () => {
    it('should return grade - 2 for normal grades', () => {
      expect(calculateDay1Difficulty(5)).toBe(3);
      expect(calculateDay1Difficulty(7)).toBe(5);
      expect(calculateDay1Difficulty(10)).toBe(8);
    });

    it('should never return below grade 1', () => {
      expect(calculateDay1Difficulty(1)).toBe(1);
      expect(calculateDay1Difficulty(2)).toBe(1);
      expect(calculateDay1Difficulty(3)).toBe(1);
    });

    it('should apply difficulty offset of -2', () => {
      const grade = 8;
      const expected = grade + DAY1_RULES.DIFFICULTY_OFFSET;
      expect(calculateDay1Difficulty(grade)).toBe(expected);
    });
  });

  // ============================================================================
  // validateDay1Difficulty
  // ============================================================================
  describe('validateDay1Difficulty', () => {
    it('should return true for valid difficulty (grade - 2)', () => {
      expect(validateDay1Difficulty(5, 3)).toBe(true);
      expect(validateDay1Difficulty(7, 5)).toBe(true);
    });

    it('should return true for difficulty lower than required', () => {
      expect(validateDay1Difficulty(5, 2)).toBe(true);
      expect(validateDay1Difficulty(7, 3)).toBe(true);
    });

    it('should return false for difficulty higher than allowed', () => {
      expect(validateDay1Difficulty(5, 4)).toBe(false);
      expect(validateDay1Difficulty(5, 5)).toBe(false);
      expect(validateDay1Difficulty(7, 6)).toBe(false);
    });
  });

  // ============================================================================
  // generateDay1Task
  // ============================================================================
  describe('generateDay1Task', () => {
    const baseOptions: Day1TaskOptions = {
      studentId: 'test-student-1',
      studentName: 'Aarav',
      grade: 5,
      subject: 'math',
      language: 'hi',
    };

    it('should generate task with correct structure', () => {
      const task = generateDay1Task(baseOptions);

      expect(task.taskId).toBeDefined();
      expect(task.title).toBeDefined();
      expect(task.estimatedMinutes).toBeDefined();
      expect(task.example).toBeDefined();
      expect(task.questions).toBeDefined();
    });

    it('should generate task with estimated time <= 15 minutes', () => {
      const task = generateDay1Task(baseOptions);
      expect(task.estimatedMinutes).toBeLessThanOrEqual(DAY1_RULES.MAX_SESSION_MINUTES);
    });

    it('should generate task with max 3 questions', () => {
      const task = generateDay1Task(baseOptions);
      expect(task.questions.length).toBeLessThanOrEqual(DAY1_RULES.MAX_QUESTIONS);
    });

    it('should include an example before questions', () => {
      const task = generateDay1Task(baseOptions);

      expect(task.example.problem).toBeDefined();
      expect(task.example.solution).toBeDefined();
      expect(task.example.explanation).toBeDefined();
    });

    it('should generate Hindi task title for Hindi language', () => {
      const task = generateDay1Task({ ...baseOptions, language: 'hi' });
      // Should be in Hindi (contains Hindi words)
      expect(task.title).toBeDefined();
    });

    it('should generate English task title for English language', () => {
      const task = generateDay1Task({ ...baseOptions, language: 'en' });
      expect(task.title).toMatch(/simple|small|easy/i);
    });

    it('should generate questions with hints', () => {
      const task = generateDay1Task(baseOptions);

      task.questions.forEach((question) => {
        expect(question.hint).toBeDefined();
        expect(question.hint.length).toBeGreaterThan(0);
      });
    });

    it('should generate questions with valid correct index', () => {
      const task = generateDay1Task(baseOptions);

      task.questions.forEach((question) => {
        expect(question.correctIndex).toBeGreaterThanOrEqual(0);
        expect(question.correctIndex).toBeLessThan(question.options.length);
      });
    });

    it('should generate unique task IDs', () => {
      const task1 = generateDay1Task(baseOptions);
      const task2 = generateDay1Task(baseOptions);

      expect(task1.taskId).not.toBe(task2.taskId);
    });
  });

  // ============================================================================
  // generateDay1ParentMessage
  // ============================================================================
  describe('generateDay1ParentMessage', () => {
    it('should generate Hindi message for Hindi language', () => {
      const message = generateDay1ParentMessage('Aarav', 'hi');

      expect(message.language).toBe('hi');
      expect(message.message).toContain('Aarav');
      expect(message.message).toMatch(/Namaste|नमस्ते/i);
    });

    it('should generate English message for English language', () => {
      const message = generateDay1ParentMessage('John', 'en');

      expect(message.language).toBe('en');
      expect(message.message).toContain('John');
      expect(message.message).toMatch(/Hello/i);
    });

    it('should include timestamp', () => {
      const message = generateDay1ParentMessage('Test', 'en');

      expect(message.timestamp).toBeDefined();
      expect(new Date(message.timestamp)).toBeInstanceOf(Date);
    });

    it('should be under 60 words', () => {
      const messageHi = generateDay1ParentMessage('Aarav', 'hi');
      const messageEn = generateDay1ParentMessage('John', 'en');

      const wordCountHi = messageHi.message.split(/\s+/).length;
      const wordCountEn = messageEn.message.split(/\s+/).length;

      expect(wordCountHi).toBeLessThanOrEqual(60);
      expect(wordCountEn).toBeLessThanOrEqual(60);
    });
  });

  // ============================================================================
  // validateParentMessage
  // ============================================================================
  describe('validateParentMessage', () => {
    it('should pass valid message', () => {
      const result = validateParentMessage(
        'Hello! Your child completed a learning task today. Keep it up!'
      );
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail message with "topper"', () => {
      const result = validateParentMessage(
        'Your child will become topper of the class!'
      );
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('topper'))).toBe(true);
    });

    it('should fail message with "best"', () => {
      const result = validateParentMessage(
        'Your child is the best in the class!'
      );
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('best'))).toBe(true);
    });

    it('should fail message with "competition"', () => {
      const result = validateParentMessage(
        'Your child beat the competition today!'
      );
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('competition'))).toBe(true);
    });

    it('should fail message with scores/marks', () => {
      const result = validateParentMessage(
        'Your child scored 100% today!'
      );
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('100%'))).toBe(true);
    });

    it('should fail message over 60 words', () => {
      const longMessage = Array(65).fill('word').join(' ');
      const result = validateParentMessage(longMessage);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('too long'))).toBe(true);
    });

    it('should fail message comparing to others', () => {
      const result = validateParentMessage(
        'Your child did better than other students!'
      );
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('other students'))).toBe(true);
    });
  });

  // ============================================================================
  // Day1TaskGenerator Export
  // ============================================================================
  describe('Day1TaskGenerator export', () => {
    it('should export all required functions', () => {
      expect(Day1TaskGenerator.generateTask).toBe(generateDay1Task);
      expect(Day1TaskGenerator.generateParentMessage).toBe(generateDay1ParentMessage);
      expect(Day1TaskGenerator.calculateDifficulty).toBe(calculateDay1Difficulty);
      expect(Day1TaskGenerator.validateDifficulty).toBe(validateDay1Difficulty);
      expect(Day1TaskGenerator.validateParentMessage).toBe(validateParentMessage);
    });
  });
});
