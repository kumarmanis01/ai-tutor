/**
 * FILE OBJECTIVE:
 * - Unit tests for prompt schema contracts and utility functions.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: tests/unit/lib/ai/prompts/schemas.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created unit tests for prompt schemas
 */

import {
  shouldRewriteIntent,
  getEffectiveIntent,
  DIFFICULTY_CALIBRATION,
  INTENT_REWRITES,
  type StudentIntent,
} from '@/lib/ai/prompts/schemas';

describe('Prompt Schemas', () => {
  describe('DIFFICULTY_CALIBRATION', () => {
    it('has calibration for all difficulty levels', () => {
      expect(DIFFICULTY_CALIBRATION.easy).toBeDefined();
      expect(DIFFICULTY_CALIBRATION.medium).toBeDefined();
      expect(DIFFICULTY_CALIBRATION.hard).toBeDefined();
    });

    it('calibration strings are descriptive', () => {
      expect(DIFFICULTY_CALIBRATION.easy).toContain('Definition');
      expect(DIFFICULTY_CALIBRATION.medium).toContain('Reasoning');
      expect(DIFFICULTY_CALIBRATION.hard).toContain('Application');
    });
  });

  describe('INTENT_REWRITES', () => {
    it('rewrites give_final_answer to conceptual_clarity', () => {
      expect(INTENT_REWRITES.give_final_answer).toBe('conceptual_clarity');
    });

    it('rewrites solve_homework to step_by_step', () => {
      expect(INTENT_REWRITES.solve_homework).toBe('step_by_step');
    });

    it('rewrites copy_paste to conceptual_clarity', () => {
      expect(INTENT_REWRITES.copy_paste).toBe('conceptual_clarity');
    });
  });

  describe('shouldRewriteIntent', () => {
    it('returns true for problematic intents', () => {
      expect(shouldRewriteIntent('give_final_answer')).toBe(true);
      expect(shouldRewriteIntent('solve_homework')).toBe(true);
      expect(shouldRewriteIntent('copy_paste')).toBe(true);
    });

    it('returns false for legitimate intents', () => {
      expect(shouldRewriteIntent('conceptual_clarity')).toBe(false);
      expect(shouldRewriteIntent('example_needed')).toBe(false);
      expect(shouldRewriteIntent('step_by_step')).toBe(false);
      expect(shouldRewriteIntent('comparison')).toBe(false);
      expect(shouldRewriteIntent('real_world_application')).toBe(false);
      expect(shouldRewriteIntent('revision')).toBe(false);
    });
  });

  describe('getEffectiveIntent', () => {
    it('rewrites problematic intents', () => {
      expect(getEffectiveIntent('give_final_answer')).toBe('conceptual_clarity');
      expect(getEffectiveIntent('solve_homework')).toBe('step_by_step');
      expect(getEffectiveIntent('copy_paste')).toBe('conceptual_clarity');
    });

    it('passes through legitimate intents unchanged', () => {
      const legitimateIntents: StudentIntent[] = [
        'conceptual_clarity',
        'example_needed',
        'step_by_step',
        'comparison',
        'real_world_application',
        'revision',
      ];

      for (const intent of legitimateIntents) {
        expect(getEffectiveIntent(intent)).toBe(intent);
      }
    });
  });
});
