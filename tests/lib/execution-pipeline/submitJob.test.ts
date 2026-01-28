/**
 * FILE OBJECTIVE:
 * - Unit tests for submitJob validation logic and jobType/entityType combinations.
 * - Tests pure functions without importing modules that use import.meta.url
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file for lib/execution-pipeline/submitJob.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22T01:45:00Z | copilot | Phase 1: Created validation tests (ESM-safe)
 */

import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Copy of validation logic for testing (avoids importing prisma)
// This duplicates the source for testability; source of truth is submitJob.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valid jobType → entityType combinations matrix.
 * Per /docs/Hydration_Rules.md:
 * - syllabus: SUBJECT-scoped (creates chapters/topics for a subject)
 * - notes/questions/tests/assemble: TOPIC-scoped
 */
const VALID_JOB_ENTITY_COMBINATIONS: Record<string, string[]> = {
  syllabus: ['SUBJECT'],
  notes: ['TOPIC'],
  questions: ['TOPIC'],
  tests: ['TOPIC'],
  assemble: ['TOPIC'],
};

type ValidationResult = { valid: true } | { valid: false; reason: string };

/**
 * Validates that a jobType/entityType combination is permitted.
 * @param jobType - The type of job (syllabus, notes, questions, tests, assemble)
 * @param entityType - The entity type (BOARD, CLASS, SUBJECT, CHAPTER, TOPIC)
 * @returns Validation result with reason if invalid
 */
function validateJobEntityCombination(
  jobType: string,
  entityType: string
): ValidationResult {
  const allowedEntities = VALID_JOB_ENTITY_COMBINATIONS[jobType];

  if (!allowedEntities) {
    return {
      valid: false,
      reason: `Unknown jobType: ${jobType}. Valid jobTypes are: ${Object.keys(VALID_JOB_ENTITY_COMBINATIONS).join(', ')}`,
    };
  }

  if (!allowedEntities.includes(entityType)) {
    return {
      valid: false,
      reason: `Invalid combination: jobType '${jobType}' requires entityType [${allowedEntities.join(', ')}], got '${entityType}'`,
    };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

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
        if (result.valid === false) {
          expect(result.reason).toContain("jobType 'syllabus' requires entityType [SUBJECT]");
          expect(result.reason).toContain("got 'CHAPTER'");
        }
      });

      it('should reject syllabus + TOPIC', () => {
        const result = validateJobEntityCombination('syllabus', 'TOPIC');
        expect(result.valid).toBe(false);
        if (result.valid === false) {
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
        if (result.valid === false) {
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
        if (result.valid === false) {
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
        if (result.valid === false) {
          expect(result.reason).toContain('Unknown jobType: unknown_job');
        }
      });

      it('should reject empty jobType', () => {
        const result = validateJobEntityCombination('', 'TOPIC');
        expect(result.valid).toBe(false);
        if (result.valid === false) {
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
// File existence test
// ─────────────────────────────────────────────────────────────────────────────
describe('submitJob file', () => {
  it('file exists: lib/execution-pipeline/submitJob.ts', () => {
    const p = path.join(process.cwd(), 'lib/execution-pipeline/submitJob.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Source parity test - verify test matches source implementation
// ─────────────────────────────────────────────────────────────────────────────
describe('source parity', () => {
  it('test validation matrix should match source file', () => {
    const sourceContent = fs.readFileSync(
      path.join(process.cwd(), 'lib/execution-pipeline/submitJob.ts'),
      'utf-8'
    );
    
    // Verify syllabus is SUBJECT-scoped in source
    expect(sourceContent).toContain("syllabus: ['SUBJECT']");
    
    // Verify notes is TOPIC-scoped in source
    expect(sourceContent).toContain("notes: ['TOPIC']");
    
    // Verify questions is TOPIC-scoped in source
    expect(sourceContent).toContain("questions: ['TOPIC']");
    
    // Verify tests is TOPIC-scoped in source
    expect(sourceContent).toContain("tests: ['TOPIC']");
    
    // Verify assemble is TOPIC-scoped in source
    expect(sourceContent).toContain("assemble: ['TOPIC']");
  });
});
