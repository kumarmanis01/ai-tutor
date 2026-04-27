/**
 * FILE OBJECTIVE:
 * - Phase 4 tests: Verify hydrators comply with guardrails (enqueue-only, no LLM calls).
 *
 * LINKED UNIT TEST:
 * - This file tests: hydrators/hydrateNotes.ts, hydrators/hydrateQuestions.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/Hydration_Rules.md
 *
 * EDIT LOG:
 * - 2026-01-22T03:15:00Z | copilot | Phase 4: Created hydrator compliance tests
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Phase 4: Hydrator Compliance', () => {
  /**
   * Verify hydrators DO NOT import callLLM (LLM calls are forbidden in hydrators).
   * Per COPILOT RULES: "Hydrators only enqueue jobs - No AI calls allowed here"
   */
  describe('hydrateNotes.ts compliance', () => {
    let hydrateNotesContent: string;

    beforeAll(() => {
      const filePath = path.join(process.cwd(), 'hydrators', 'hydrateNotes.ts');
      hydrateNotesContent = fs.readFileSync(filePath, 'utf-8');
    });

    test('does NOT import callLLM (violates hydrator rules)', () => {
      // After Phase 4 refactoring, hydrators should NOT import callLLM
      expect(hydrateNotesContent).not.toMatch(/import.*callLLM/);
      expect(hydrateNotesContent).not.toMatch(/from.*["']@\/lib\/callLLM/);
    });

    test('imports enqueueNotesHydration (delegates to proper enqueue)', () => {
      expect(hydrateNotesContent).toMatch(/import.*enqueueNotesHydration/);
    });

    test('is marked as deprecated', () => {
      expect(hydrateNotesContent).toMatch(/@deprecated/);
    });

    test('does NOT call prisma.topicNote.create (worker handles persistence)', () => {
      expect(hydrateNotesContent).not.toMatch(/prisma\.topicNote\.create/);
    });

    test('does NOT call prisma.topicDef.findUnique (worker handles lookup)', () => {
      expect(hydrateNotesContent).not.toMatch(/prisma\.topicDef\.findUnique/);
    });

    test('returns enqueue result not void', () => {
      // Function should return { enqueued, jobId?, reason? }
      expect(hydrateNotesContent).toMatch(/Promise<\{ enqueued: boolean/);
    });
  });

  describe('hydrateQuestions.ts compliance', () => {
    let hydrateQuestionsContent: string;

    beforeAll(() => {
      const filePath = path.join(process.cwd(), 'hydrators', 'hydrateQuestions.ts');
      hydrateQuestionsContent = fs.readFileSync(filePath, 'utf-8');
    });

    test('does NOT import callLLM (violates hydrator rules)', () => {
      // After Phase 4 refactoring, hydrators should NOT import callLLM
      expect(hydrateQuestionsContent).not.toMatch(/import.*callLLM/);
      expect(hydrateQuestionsContent).not.toMatch(/from.*["']@\/lib\/callLLM/);
    });

    test('imports enqueueQuestionsHydration (delegates to proper enqueue)', () => {
      expect(hydrateQuestionsContent).toMatch(/import.*enqueueQuestionsHydration/);
    });

    test('is marked as deprecated', () => {
      expect(hydrateQuestionsContent).toMatch(/@deprecated/);
    });

    test('does NOT call prisma.generatedTest.create (worker handles persistence)', () => {
      expect(hydrateQuestionsContent).not.toMatch(/prisma\.generatedTest\.create/);
    });

    test('does NOT call prisma.generatedQuestion.create (worker handles persistence)', () => {
      expect(hydrateQuestionsContent).not.toMatch(/prisma\.generatedQuestion\.create/);
    });

    test('does NOT call prisma.topicDef.findUnique (worker handles lookup)', () => {
      expect(hydrateQuestionsContent).not.toMatch(/prisma\.topicDef\.findUnique/);
    });

    test('returns enqueue result not void', () => {
      // Function should return { enqueued, jobId?, reason? }
      expect(hydrateQuestionsContent).toMatch(/Promise<\{ enqueued: boolean/);
    });
  });

  /**
   * Verify worker bootstrap uses new handlers (not deprecated hydrators).
   */
  describe('worker/bootstrap.ts compliance', () => {
    let bootstrapContent: string;

    beforeAll(() => {
      const filePath = path.join(process.cwd(), 'worker', 'bootstrap.ts');
      bootstrapContent = fs.readFileSync(filePath, 'utf-8');
    });

    test('imports handleNotesJob from worker services', () => {
      expect(bootstrapContent).toMatch(/import.*handleNotesJob.*from.*["']\.\/services\/notesWorker/);
    });

    test('imports handleQuestionsJob from worker services', () => {
      expect(bootstrapContent).toMatch(/import.*handleQuestionsJob.*from.*["']\.\/services\/questionsWorker/);
    });

    test('imports handleAssembleJob from worker services', () => {
      expect(bootstrapContent).toMatch(/import.*handleAssembleJob.*from.*["']\.\/services\/assembleWorker/);
    });

    test('does NOT import hydrateNotes from hydrators (deprecated)', () => {
      expect(bootstrapContent).not.toMatch(/import.*hydrateNotes.*from.*["']\.\.\/hydrators\/hydrateNotes/);
    });

    test('does NOT import hydrateQuestions from hydrators (deprecated)', () => {
      expect(bootstrapContent).not.toMatch(/import.*hydrateQuestions.*from.*["']\.\.\/hydrators\/hydrateQuestions/);
    });

    test('NOTES case calls handleNotesJob with jobId', () => {
      expect(bootstrapContent).toMatch(/case\s+["']NOTES["']:/);
      expect(bootstrapContent).toMatch(/handleNotesJob\(payload\.jobId\)/);
    });

    test('QUESTIONS case calls handleQuestionsJob with jobId', () => {
      expect(bootstrapContent).toMatch(/case\s+["']QUESTIONS["']:/);
      expect(bootstrapContent).toMatch(/handleQuestionsJob\(payload\.jobId\)/);
    });

    test('ASSEMBLE_TEST case calls handleAssembleJob with jobId', () => {
      expect(bootstrapContent).toMatch(/case\s+["']ASSEMBLE_TEST["']:/);
      expect(bootstrapContent).toMatch(/handleAssembleJob\(payload\.jobId\)/);
    });

    test('all cases validate jobId presence', () => {
      // All job types should validate jobId before calling handler
      expect(bootstrapContent).toMatch(/NOTES job missing jobId/);
      expect(bootstrapContent).toMatch(/QUESTIONS job missing jobId/);
      expect(bootstrapContent).toMatch(/ASSEMBLE_TEST job missing jobId/);
    });
  });

  /**
   * Verify worker services contain LLM calls (correct location).
   */
  describe('worker services contain LLM logic', () => {
    test('notesWorker.ts imports callLLM', () => {
      const filePath = path.join(process.cwd(), 'worker', 'services', 'notesWorker.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/import.*callLLM/);
    });

    test('questionsWorker.ts imports callLLM', () => {
      const filePath = path.join(process.cwd(), 'worker', 'services', 'questionsWorker.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/import.*callLLM/);
    });

    test('assembleWorker.ts does NOT import callLLM (assemble is non-AI)', () => {
      const filePath = path.join(process.cwd(), 'worker', 'services', 'assembleWorker.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).not.toMatch(/import.*callLLM/);
    });
  });
});
