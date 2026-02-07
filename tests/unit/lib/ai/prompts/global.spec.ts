/**
 * FILE OBJECTIVE:
 * - Unit tests for global system prompt builder.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: tests/unit/lib/ai/prompts/global.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created unit tests for global system prompt
 */

import {
  GLOBAL_SYSTEM_PROMPT,
  buildSystemPrompt,
  getGradeLanguageGuidance,
  getLanguageInstructions,
} from '@/lib/ai/prompts/global';

describe('Global System Prompt', () => {
  describe('GLOBAL_SYSTEM_PROMPT', () => {
    it('identifies as K-12 tutor', () => {
      expect(GLOBAL_SYSTEM_PROMPT).toContain('K–12 students');
    });

    it('includes explanation-first rule', () => {
      expect(GLOBAL_SYSTEM_PROMPT).toContain('EXPLANATION FIRST');
      expect(GLOBAL_SYSTEM_PROMPT).toContain('step by step');
    });

    it('includes curriculum alignment rule', () => {
      expect(GLOBAL_SYSTEM_PROMPT).toContain('CURRICULUM ALIGNMENT');
      expect(GLOBAL_SYSTEM_PROMPT).toContain('CBSE');
    });

    it('includes child-safe communication rule', () => {
      expect(GLOBAL_SYSTEM_PROMPT).toContain('CHILD-SAFE COMMUNICATION');
      expect(GLOBAL_SYSTEM_PROMPT).toContain('Never shame');
    });

    it('includes identity constraints', () => {
      expect(GLOBAL_SYSTEM_PROMPT).toContain('IDENTITY CONSTRAINTS');
      expect(GLOBAL_SYSTEM_PROMPT).toContain('Do NOT mention AI');
    });

    it('includes JSON output format rule', () => {
      expect(GLOBAL_SYSTEM_PROMPT).toContain('OUTPUT FORMAT');
      expect(GLOBAL_SYSTEM_PROMPT).toContain('JSON');
    });

    it('includes safety boundaries', () => {
      expect(GLOBAL_SYSTEM_PROMPT).toContain('SAFETY BOUNDARIES');
      expect(GLOBAL_SYSTEM_PROMPT).toContain('harmful to minors');
    });
  });

  describe('getGradeLanguageGuidance', () => {
    it('provides simple language for grades 1-3', () => {
      const guidance = getGradeLanguageGuidance(1);
      expect(guidance).toContain('very simple');
      expect(guidance).toContain('6-8 year old');
    });

    it('provides simple language for grades 4-5', () => {
      const guidance = getGradeLanguageGuidance(5);
      expect(guidance).toContain('simple vocabulary');
      expect(guidance).toContain('9-11 year old');
    });

    it('provides middle school language for grades 6-8', () => {
      const guidance = getGradeLanguageGuidance(7);
      expect(guidance).toContain('middle school');
    });

    it('provides high school language for grades 9-10', () => {
      const guidance = getGradeLanguageGuidance(10);
      expect(guidance).toContain('high school');
    });

    it('provides mature language for grades 11-12', () => {
      const guidance = getGradeLanguageGuidance(12);
      expect(guidance).toContain('mature academic');
    });
  });

  describe('getLanguageInstructions', () => {
    it('provides Hindi instructions', () => {
      const instructions = getLanguageInstructions('Hindi');
      expect(instructions).toContain('Hindi');
      expect(instructions).toContain('Devanagari');
    });

    it('provides Hinglish instructions', () => {
      const instructions = getLanguageInstructions('Hinglish');
      expect(instructions).toContain('Hinglish');
      expect(instructions).toContain('Hindi-English mix');
    });

    it('provides English instructions', () => {
      const instructions = getLanguageInstructions('English');
      expect(instructions).toContain('English');
      expect(instructions).toContain('simple');
    });
  });

  describe('buildSystemPrompt', () => {
    it('combines global prompt with grade guidance', () => {
      const prompt = buildSystemPrompt(5, 'English');
      
      expect(prompt).toContain('K–12 students');
      expect(prompt).toContain('GRADE-SPECIFIC GUIDANCE');
    });

    it('includes language instructions', () => {
      const prompt = buildSystemPrompt(8, 'Hindi');
      
      expect(prompt).toContain('LANGUAGE INSTRUCTIONS');
      expect(prompt).toContain('Devanagari');
    });

    it('adapts to different grade levels', () => {
      const grade3Prompt = buildSystemPrompt(3, 'English');
      const grade10Prompt = buildSystemPrompt(10, 'English');
      
      expect(grade3Prompt).toContain('6-8 year old');
      expect(grade10Prompt).toContain('high school');
    });
  });
});
