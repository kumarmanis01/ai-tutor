/**
 * FILE OBJECTIVE:
 * - Regression tests for the questions worker source, focusing on the
 *   soft-sync promotion rules that keep rejected generated content hidden.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/questionsWorker.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | add source-level regression coverage for rejection-aware GeneratedQuestion promotion
 * - 2026-05-10T00:00:00Z | copilot | add source-level regression coverage for worker dedupe helpers and deduped persistence path
 */

import fs from 'fs';
import path from 'path';

describe('worker/services/questionsWorker.ts', () => {
  it('keeps rejected generated tests out of the promotion query', () => {
    const filePath = path.join(process.cwd(), 'worker', 'services', 'questionsWorker.ts');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('status: { not: ApprovalStatus.Rejected }');
    expect(source).toContain('promote GeneratedQuestion rows to Question table after job completion');
  });

  it('deduplicates generated questions before persistence and promotion', () => {
    const filePath = path.join(process.cwd(), 'worker', 'services', 'questionsWorker.ts');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('function dedupeQuestionsForPersistence');
    expect(source).toContain('parsed.questions = dedupeQuestionsForPersistence(parsed.questions);');
    expect(source).toContain('const existingContentKeys = new Set<string>(');
    expect(source).toContain('const promotedContentKeys = new Set<string>();');
  });
});
