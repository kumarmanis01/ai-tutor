/**
 * FILE OBJECTIVE:
 * - Unit tests for submitJob validation logic and jobType/entityType combinations.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file for lib/execution-pipeline/submitJob.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22T01:35:00Z | copilot | Phase 1: Created validation tests
 */

import {
  validateJobEntityCombination,
  VALID_JOB_ENTITY_COMBINATIONS,
} from '@/lib/execution-pipeline/submitJob';

describe('submitJob validation', () => {
  describe('VALID_JOB_ENTITY_COMBINATIONS', () => {
    it('should define syllabus as SUBJECT-scoped only', () => {
      expect(VALID_JOB_ENTITY_COMBINATIONS.syllabus).toEqual(['SUBJECT']);
    });

    it('should define notes as TOPIC-scoped only', () => {
      expect(VALID_JOB_ENTITY_COMBINATIONS.notes).toEqual(['TOPIC']);
    });

    it('should define questions as TOPIC-scoped only', () => {
      expect(VALID_JOB_ENTITY_COMBINATIONS.questions).toEqual(['TOPIC']);
    });

    it('should define tests as TOPIC-scoped only', () => {
      expect(VALID_JOB_ENTITY_COMBINATIONS.tests).toEqual(['TOPIC']);
    });

    it('should define assemble as TOPIC-scoped only', () => {
      expect(VALID_JOB_ENTITY_COMBINATIONS.assemble).toEqual(['TOPIC']);
    });
  });

  describe('validateJobEntityCombination', () => {
    // ─────────────────────────────────────────────────────────────────────────
    // Valid combinations
    // ─────────────────────────────────────────────────────────────────────────
    describe('valid combinations', () => {
      it('should accept syllabus + SUBJECT', () => {
        const result = validateJobEntityCombination('syllabus', 'SUBJECT');
        expect(result.valid).toBe(true);
      });

      it('should accept notes + TOPIC', () => {
        const result = validateJobEntityCombination('notes', 'TOPIC');
        expect(result.valid).toBe(true);
      });

      it('should accept questions + TOPIC', () => {
        const result = validateJobEntityCombination('questions', 'TOPIC');
        expect(result.valid).toBe(true);
      });

      it('should accept tests + TOPIC', () => {
        const result = validateJobEntityCombination('tests', 'TOPIC');
        expect(result.valid).toBe(true);
      });

      it('should accept assemble + TOPIC', () => {
        const result = validateJobEntityCombination('assemble', 'TOPIC');
        expect(result.valid).toBe(true);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Invalid combinations: syllabus with wrong entityType
    // ─────────────────────────────────────────────────────────────────────────
    describe('invalid syllabus combinations', () => {
      it('should reject syllabus + CHAPTER', () => {
        const result = validateJobEntityCombination('syllabus', 'CHAPTER');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.reason).toContain("jobType 'syllabus' requires entityType [SUBJECT]");
          expect(result.reason).toContain("got 'CHAPTER'");
        }
      });

      it('should reject syllabus + TOPIC', () => {
        const result = validateJobEntityCombination('syllabus', 'TOPIC');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.reason).toContain("jobType 'syllabus' requires entityType [SUBJECT]");
        }
      });

      it('should reject syllabus + BOARD', () => {
        const result = validateJobEntityCombination('syllabus', 'BOARD');
        expect(result.valid).toBe(false);
      });

      it('should reject syllabus + CLASS', () => {
        const result = validateJobEntityCombination('syllabus', 'CLASS');
        expect(result.valid).toBe(false);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Invalid combinations: notes with wrong entityType
    // ─────────────────────────────────────────────────────────────────────────
    describe('invalid notes combinations', () => {
      it('should reject notes + SUBJECT', () => {
        const result = validateJobEntityCombination('notes', 'SUBJECT');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.reason).toContain("jobType 'notes' requires entityType [TOPIC]");
          expect(result.reason).toContain("got 'SUBJECT'");
        }
      });

      it('should reject notes + CHAPTER', () => {
        const result = validateJobEntityCombination('notes', 'CHAPTER');
        expect(result.valid).toBe(false);
      });

      it('should reject notes + BOARD', () => {
        const result = validateJobEntityCombination('notes', 'BOARD');
        expect(result.valid).toBe(false);
      });

      it('should reject notes + CLASS', () => {
        const result = validateJobEntityCombination('notes', 'CLASS');
        expect(result.valid).toBe(false);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Invalid combinations: questions with wrong entityType
    // ─────────────────────────────────────────────────────────────────────────
    describe('invalid questions combinations', () => {
      it('should reject questions + SUBJECT', () => {
        const result = validateJobEntityCombination('questions', 'SUBJECT');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.reason).toContain("jobType 'questions' requires entityType [TOPIC]");
        }
      });

      it('should reject questions + CHAPTER', () => {
        const result = validateJobEntityCombination('questions', 'CHAPTER');
        expect(result.valid).toBe(false);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Invalid combinations: tests with wrong entityType
    // ─────────────────────────────────────────────────────────────────────────
    describe('invalid tests combinations', () => {
      it('should reject tests + SUBJECT', () => {
        const result = validateJobEntityCombination('tests', 'SUBJECT');
        expect(result.valid).toBe(false);
      });

      it('should reject tests + CHAPTER', () => {
        const result = validateJobEntityCombination('tests', 'CHAPTER');
        expect(result.valid).toBe(false);
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Unknown jobType
    // ─────────────────────────────────────────────────────────────────────────
    describe('unknown jobType', () => {
      it('should reject unknown jobType', () => {
        const result = validateJobEntityCombination('unknown_job', 'TOPIC');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.reason).toContain('Unknown jobType: unknown_job');
        }
      });

      it('should reject empty jobType', () => {
        const result = validateJobEntityCombination('', 'TOPIC');
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.reason).toContain('Unknown jobType:');
        }
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Edge cases
    // ─────────────────────────────────────────────────────────────────────────
    describe('edge cases', () => {
      it('should be case-sensitive for jobType', () => {
        // Per Prisma enum, jobType is lowercase
        const result = validateJobEntityCombination('SYLLABUS', 'SUBJECT');
        expect(result.valid).toBe(false);
      });

      it('should be case-sensitive for entityType', () => {
        // entityType is uppercase by convention
        const result = validateJobEntityCombination('syllabus', 'subject');
        expect(result.valid).toBe(false);
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// File existence test (preserved from original)
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';

describe('submitJob file', () => {
  it('file exists: lib/execution-pipeline/submitJob.ts', () => {
    const p = path.join(process.cwd(), 'lib/execution-pipeline/submitJob.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
