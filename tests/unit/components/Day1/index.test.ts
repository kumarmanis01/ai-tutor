/**
 * FILE OBJECTIVE:
 * - Unit tests for Day-1 component exports.
 * - Verify EXACTLY 4 screens are exported.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Day1/index.test.ts (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | copilot | created index tests
 * - 2026-02-04 | copilot | refactored to test types only (JSX not needed in node env)
 */

// Import only types - JSX components require jsdom environment
import {
  Day1Screen,
  DAY1_RULES,
  DAY1_BANNED_FEATURES,
  Day1WelcomeScreenProps,
  Day1TodaysTaskScreenProps,
  Day1TaskCompletionScreenProps,
  Day1CelebrationScreenProps,
} from '../../../../components/Day1/types';
import * as fs from 'fs';
import * as path from 'path';

describe('Day-1 Component Exports', () => {
  const componentsDir = path.resolve(__dirname, '../../../../components/Day1');

  describe('Screen Component Files', () => {
    it('should have WelcomeScreen.tsx file', () => {
      const filePath = path.join(componentsDir, 'WelcomeScreen.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have TodaysTaskScreen.tsx file', () => {
      const filePath = path.join(componentsDir, 'TodaysTaskScreen.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have TaskCompletionScreen.tsx file', () => {
      const filePath = path.join(componentsDir, 'TaskCompletionScreen.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have CelebrationScreen.tsx file', () => {
      const filePath = path.join(componentsDir, 'CelebrationScreen.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have EXACTLY 4 screen component files', () => {
      const screenFiles = fs.readdirSync(componentsDir)
        .filter(f => f.endsWith('Screen.tsx'));
      expect(screenFiles).toHaveLength(4);
      expect(screenFiles).toHaveLength(DAY1_RULES.TOTAL_SCREENS);
    });

    it('should have barrel export index.ts', () => {
      const filePath = path.join(componentsDir, 'index.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('WelcomeScreen');
      expect(content).toContain('TodaysTaskScreen');
      expect(content).toContain('TaskCompletionScreen');
      expect(content).toContain('CelebrationScreen');
    });
  });

  describe('Props Type Exports', () => {
    it('should export Day1WelcomeScreenProps type with required fields', () => {
      // TypeScript compilation ensures type exists
      const props: Day1WelcomeScreenProps = {
        studentName: 'Test',
        language: 'hi',
        onContinue: () => {},
      };
      expect(props.studentName).toBe('Test');
    });

    it('should export Day1TodaysTaskScreenProps type', () => {
      const props: Day1TodaysTaskScreenProps = {
        task: {
          taskId: 'test-1',
          subject: 'math',
          title: 'Test Task',
          titleHi: 'टेस्ट टास्क',
          estimatedMinutes: 10,
          examplePreview: '2+2=?',
          difficulty: 1,
          questions: [],
        },
        language: 'hi',
        onStart: () => {},
      };
      expect(props.task.taskId).toBe('test-1');
    });

    it('should export Day1TaskCompletionScreenProps type', () => {
      const props: Day1TaskCompletionScreenProps = {
        studentName: 'Test',
        language: 'hi',
        onContinue: () => {},
      };
      expect(props.studentName).toBe('Test');
    });

    it('should export Day1CelebrationScreenProps type', () => {
      const props: Day1CelebrationScreenProps = {
        language: 'hi',
        onClose: () => {},
      };
      expect(props.language).toBe('hi');
    });
  });

  describe('Type Exports', () => {
    it('should export Day1Screen enum', () => {
      expect(Day1Screen).toBeDefined();
      expect(Object.values(Day1Screen)).toHaveLength(4);
    });

    it('should export DAY1_RULES constant', () => {
      expect(DAY1_RULES).toBeDefined();
      expect(DAY1_RULES.DIFFICULTY_OFFSET).toBe(-2);
    });

    it('should export DAY1_BANNED_FEATURES constant', () => {
      expect(DAY1_BANNED_FEATURES).toBeDefined();
      expect(Array.isArray(DAY1_BANNED_FEATURES)).toBe(true);
    });
  });
});
