/**
 * FILE OBJECTIVE:
 * - Unit tests for Phase 3 worker service handlers and contentWorker dispatch.
 * - Tests file existence, exports, and handler dispatch logic.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file for worker/processors/contentWorker.ts and worker/services/*
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22T02:40:00Z | copilot | Phase 3: Created worker handler tests
 */

import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Worker service file existence tests
// ─────────────────────────────────────────────────────────────────────────────

describe('worker service files', () => {
  it('syllabusWorker.ts exists', () => {
    const p = path.join(process.cwd(), 'worker/services/syllabusWorker.ts');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('notesWorker.ts exists', () => {
    const p = path.join(process.cwd(), 'worker/services/notesWorker.ts');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('questionsWorker.ts exists', () => {
    const p = path.join(process.cwd(), 'worker/services/questionsWorker.ts');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('assembleWorker.ts exists', () => {
    const p = path.join(process.cwd(), 'worker/services/assembleWorker.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// contentWorker dispatch tests
// ─────────────────────────────────────────────────────────────────────────────

describe('contentWorker dispatch', () => {
  const contentWorkerPath = path.join(process.cwd(), 'worker/processors/contentWorker.ts');
  let contentWorkerContent: string;

  beforeAll(() => {
    contentWorkerContent = fs.readFileSync(contentWorkerPath, 'utf-8');
  });

  it('contentWorker.ts exists', () => {
    expect(fs.existsSync(contentWorkerPath)).toBe(true);
  });

  describe('imports all worker handlers', () => {
    it('imports handleSyllabusJob', () => {
      expect(contentWorkerContent).toContain('handleSyllabusJob');
    });

    it('imports handleNotesJob', () => {
      expect(contentWorkerContent).toContain('handleNotesJob');
    });

    it('imports handleQuestionsJob', () => {
      expect(contentWorkerContent).toContain('handleQuestionsJob');
    });

    it('imports handleAssembleJob', () => {
      expect(contentWorkerContent).toContain('handleAssembleJob');
    });
  });

  describe('WORKER_HANDLERS mapping', () => {
    it('defines WORKER_HANDLERS constant', () => {
      expect(contentWorkerContent).toContain('const WORKER_HANDLERS');
    });

    it('maps SYLLABUS to handleSyllabusJob', () => {
      expect(contentWorkerContent).toContain('SYLLABUS: handleSyllabusJob');
    });

    it('maps NOTES to handleNotesJob', () => {
      expect(contentWorkerContent).toContain('NOTES: handleNotesJob');
    });

    it('maps QUESTIONS to handleQuestionsJob', () => {
      expect(contentWorkerContent).toContain('QUESTIONS: handleQuestionsJob');
    });

    it('maps ASSEMBLE_TEST to handleAssembleJob', () => {
      expect(contentWorkerContent).toContain('ASSEMBLE_TEST: handleAssembleJob');
    });
  });

  describe('dispatch logic', () => {
    it('reads worker type from job.data.type', () => {
      expect(contentWorkerContent).toContain("job.data?.type");
    });

    it('looks up handler from WORKER_HANDLERS', () => {
      expect(contentWorkerContent).toContain('WORKER_HANDLERS[workerType]');
    });

    it('handles unknown worker type', () => {
      expect(contentWorkerContent).toContain('Unknown worker type');
    });

    it('calls handler with hydrationJobId', () => {
      expect(contentWorkerContent).toContain('await handler(hydrationJobId)');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// notesWorker structure tests
// ─────────────────────────────────────────────────────────────────────────────

describe('notesWorker structure', () => {
  const notesWorkerPath = path.join(process.cwd(), 'worker/services/notesWorker.ts');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(notesWorkerPath, 'utf-8');
  });

  it('exports handleNotesJob function', () => {
    expect(content).toContain('export async function handleNotesJob');
  });

  it('imports callLLM for AI generation', () => {
    expect(content).toContain("from '@/lib/callLLM.js'");
  });

  it('validates notes shape', () => {
    expect(content).toContain('validateNotesShape');
  });

  it('creates TopicNote records', () => {
    expect(content).toContain('topicNote.upsert');
  });

  it('marks HydrationJob completed', () => {
    expect(content).toContain('status: JobStatus.Completed');
  });

  it('marks linked ExecutionJob completed', () => {
    expect(content).toContain("jobExecutionLog.create");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// questionsWorker structure tests
// ─────────────────────────────────────────────────────────────────────────────

describe('questionsWorker structure', () => {
  const questionsWorkerPath = path.join(process.cwd(), 'worker/services/questionsWorker.ts');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(questionsWorkerPath, 'utf-8');
  });

  it('exports handleQuestionsJob function', () => {
    expect(content).toContain('export async function handleQuestionsJob');
  });

  it('imports callLLM for AI generation', () => {
    expect(content).toContain("from '@/lib/callLLM.js'");
  });

  it('validates questions shape', () => {
    expect(content).toContain('validateQuestionsShape');
  });

  it('creates GeneratedTest records', () => {
    expect(content).toContain('generatedTest.upsert');
  });

  it('supports difficulty parameter', () => {
    expect(content).toContain('difficulty');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// assembleWorker structure tests
// ─────────────────────────────────────────────────────────────────────────────

describe('assembleWorker structure', () => {
  const assembleWorkerPath = path.join(process.cwd(), 'worker/services/assembleWorker.ts');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(assembleWorkerPath, 'utf-8');
  });

  it('exports handleAssembleJob function', () => {
    expect(content).toContain('export async function handleAssembleJob');
  });

  it('does NOT import callLLM (assemble does not call LLMs)', () => {
    expect(content).not.toContain('callLLM');
  });

  it('finds draft GeneratedTest records', () => {
    expect(content).toContain('generatedTest.findMany');
  });

  it('approves tests meeting threshold', () => {
    expect(content).toContain("status: 'approved'");
  });

  it('defines MIN_QUESTIONS_FOR_APPROVAL', () => {
    expect(content).toContain('MIN_QUESTIONS_FOR_APPROVAL');
  });
});
