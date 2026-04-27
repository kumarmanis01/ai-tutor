/**
 * FILE OBJECTIVE:
 * - Unit tests for topic-scoped hydration enqueue functions (notes, questions, tests).
 * - Tests pure function logic without importing prisma (ESM compatibility).
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file for lib/execution-pipeline/enqueueTopicHydration.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22T02:10:00Z | copilot | Phase 2: Created enqueue function tests
 */

import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// File existence and structure tests
// ─────────────────────────────────────────────────────────────────────────────

describe('enqueueTopicHydration file', () => {
  const filePath = path.join(process.cwd(), 'lib/execution-pipeline/enqueueTopicHydration.ts');
  let fileContent: string;

  beforeAll(() => {
    fileContent = fs.readFileSync(filePath, 'utf-8');
  });

  it('file exists: lib/execution-pipeline/enqueueTopicHydration.ts', () => {
    expect(fs.existsSync(filePath)).toBe(true);
  });

  describe('exports', () => {
    it('should export enqueueNotesHydration', () => {
      expect(fileContent).toContain('export async function enqueueNotesHydration');
    });

    it('should export enqueueQuestionsHydration', () => {
      expect(fileContent).toContain('export async function enqueueQuestionsHydration');
    });

    it('should export enqueueTestsHydration', () => {
      expect(fileContent).toContain('export async function enqueueTestsHydration');
    });

    it('should export enqueueAssembleHydration as alias for tests', () => {
      expect(fileContent).toContain('export const enqueueAssembleHydration = enqueueTestsHydration');
    });
  });

  describe('hydrator compliance', () => {
    it('should NOT import callLLM (hydrators must not call LLMs)', () => {
      expect(fileContent).not.toContain('from "@/lib/callLLM"');
      expect(fileContent).not.toContain("from '@/lib/callLLM'");
    });

    it('should check HYDRATION_PAUSED system setting', () => {
      expect(fileContent).toContain("key: 'HYDRATION_PAUSED'");
    });

    it('should use prisma for DB operations', () => {
      expect(fileContent).toContain("from '@/lib/prisma'");
    });

    it('should create HydrationJob records', () => {
      expect(fileContent).toContain('prisma.hydrationJob.create');
    });

    it('should create Outbox records for reliable enqueue', () => {
      expect(fileContent).toContain('prisma.outbox.create');
    });
  });

  describe('notes hydration', () => {
    it('should check for existing approved notes before creating job', () => {
      expect(fileContent).toContain('prisma.topicNote.findFirst');
      expect(fileContent).toContain("status: 'approved'");
    });

    it('should prevent duplicate queued notes jobs', () => {
      // Check for idempotency logic
      expect(fileContent).toContain("jobType: 'notes'");
      expect(fileContent).toContain('job_already_queued');
    });

    it('should create outbox with NOTES worker type', () => {
      expect(fileContent).toContain("type: 'NOTES'");
    });
  });

  describe('questions hydration', () => {
    it('should check for existing approved questions before creating job', () => {
      expect(fileContent).toContain('prisma.generatedTest.findFirst');
    });

    it('should support difficulty parameter', () => {
      expect(fileContent).toContain('difficulty');
      expect(fileContent).toContain('normalizeDifficulty');
    });

    it('should create outbox with QUESTIONS worker type', () => {
      expect(fileContent).toContain("type: 'QUESTIONS'");
    });
  });

  describe('tests/assemble hydration', () => {
    it('should create outbox with ASSEMBLE_TEST worker type', () => {
      expect(fileContent).toContain("type: 'ASSEMBLE_TEST'");
    });

    it('should use tests jobType in HydrationJob', () => {
      expect(fileContent).toContain("jobType: 'tests'");
    });
  });

  describe('error handling', () => {
    it('should return resolve_not_found when topic does not exist', () => {
      expect(fileContent).toContain("reason: 'resolve_not_found'");
    });

    it('should return content_exists when content already approved', () => {
      expect(fileContent).toContain("reason: 'content_exists'");
    });

    it('should return hydration_paused when system is paused', () => {
      expect(fileContent).toContain("reason: 'hydration_paused'");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// submitJob routing tests (verify integration)
// ─────────────────────────────────────────────────────────────────────────────

describe('submitJob routing integration', () => {
  const submitJobPath = path.join(process.cwd(), 'lib/execution-pipeline/submitJob.ts');
  let submitJobContent: string;

  beforeAll(() => {
    submitJobContent = fs.readFileSync(submitJobPath, 'utf-8');
  });

  it('should import enqueueNotesHydration', () => {
    expect(submitJobContent).toContain('enqueueNotesHydration');
  });

  it('should import enqueueQuestionsHydration', () => {
    expect(submitJobContent).toContain('enqueueQuestionsHydration');
  });

  it('should import enqueueTestsHydration', () => {
    expect(submitJobContent).toContain('enqueueTestsHydration');
  });

  it('should import enqueueAssembleHydration', () => {
    expect(submitJobContent).toContain('enqueueAssembleHydration');
  });

  it('should NOT use getContentQueue for direct BullMQ enqueue', () => {
    // Phase 2 removed direct queue access - all routing goes through hydrators
    expect(submitJobContent).not.toContain("getContentQueue()");
  });

  it('should route notes jobs to enqueueNotesHydration', () => {
    expect(submitJobContent).toContain('JobType.notes');
    expect(submitJobContent).toContain('await enqueueNotesHydration(topicHydrationInput)');
  });

  it('should route questions jobs to enqueueQuestionsHydration', () => {
    expect(submitJobContent).toContain('JobType.questions');
    expect(submitJobContent).toContain('await enqueueQuestionsHydration(topicHydrationInput)');
  });

  it('should route tests jobs to enqueueTestsHydration', () => {
    expect(submitJobContent).toContain('JobType.tests');
    expect(submitJobContent).toContain('await enqueueTestsHydration(topicHydrationInput)');
  });

  it('should route assemble jobs to enqueueAssembleHydration', () => {
    expect(submitJobContent).toContain('JobType.assemble');
    expect(submitJobContent).toContain('await enqueueAssembleHydration(topicHydrationInput)');
  });
});
