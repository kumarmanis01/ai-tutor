/**
 * FILE OBJECTIVE:
 * - Unit tests for doubts prompt builder and anti-abuse guardrails.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: tests/unit/lib/ai/prompts/doubts.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created unit tests for doubts prompt builder
 */

import {
  buildDoubtsPrompt,
  isValidDoubtsResponse,
  isOffTopicQuestion,
  getOffTopicRedirect,
  DOUBTS_OUTPUT_SCHEMA,
} from '@/lib/ai/prompts/doubts';
import type { DoubtsInputContract } from '@/lib/ai/prompts/schemas';

describe('Doubts Prompt Builder', () => {
  const baseInput: DoubtsInputContract = {
    grade: 8,
    board: 'CBSE',
    language: 'English',
    subject: 'Science',
    chapter: 'Force and Pressure',
    topic: 'Contact Forces',
    studentQuestion: 'Why does a magnet attract iron?',
    studentIntent: 'conceptual_clarity',
  };

  describe('buildDoubtsPrompt', () => {
    it('includes student context', () => {
      const prompt = buildDoubtsPrompt(baseInput);
      
      expect(prompt).toContain('Grade: 8');
      expect(prompt).toContain('Board: CBSE');
      expect(prompt).toContain('Subject: Science');
      expect(prompt).toContain('Topic: Contact Forces');
    });

    it('includes student question', () => {
      const prompt = buildDoubtsPrompt(baseInput);
      expect(prompt).toContain('Why does a magnet attract iron?');
    });

    it('includes output schema', () => {
      const prompt = buildDoubtsPrompt(baseInput);
      expect(prompt).toContain('response');
      expect(prompt).toContain('followUpQuestion');
      expect(prompt).toContain('confidenceLevel');
    });

    it('includes encouraging tone guidelines', () => {
      const prompt = buildDoubtsPrompt(baseInput);
      expect(prompt).toContain('ENCOURAGING TONE');
      expect(prompt).toContain('Great question');
    });

    it('rewrites problematic intents silently', () => {
      const inputWithBadIntent: DoubtsInputContract = {
        ...baseInput,
        studentIntent: 'give_final_answer',
      };
      
      const prompt = buildDoubtsPrompt(inputWithBadIntent);
      
      // Should include anti-abuse note
      expect(prompt).toContain('INTERNAL NOTE');
      expect(prompt).toContain('educational value');
    });

    it('includes conversation history when provided', () => {
      const inputWithHistory: DoubtsInputContract = {
        ...baseInput,
        conversationHistory: [
          { role: 'student', content: 'What is force?', timestamp: '2026-02-04T10:00:00Z' },
          { role: 'tutor', content: 'Force is a push or pull...', timestamp: '2026-02-04T10:00:30Z' },
        ],
      };
      
      const prompt = buildDoubtsPrompt(inputWithHistory);
      
      expect(prompt).toContain('RECENT CONVERSATION');
      expect(prompt).toContain('What is force?');
      expect(prompt).toContain('Force is a push or pull');
    });

    it('adapts response approach based on intent', () => {
      const intents: Array<DoubtsInputContract['studentIntent']> = [
        'conceptual_clarity',
        'example_needed',
        'step_by_step',
        'comparison',
        'real_world_application',
        'revision',
      ];

      for (const intent of intents) {
        const prompt = buildDoubtsPrompt({ ...baseInput, studentIntent: intent });
        expect(prompt).toContain('RESPONSE APPROACH');
      }
    });
  });

  describe('isValidDoubtsResponse', () => {
    it('returns true for valid response', () => {
      const valid = {
        response: 'Here is the explanation',
        followUpQuestion: 'Does this help?',
        confidenceLevel: 'high',
      };
      expect(isValidDoubtsResponse(valid)).toBe(true);
    });

    it('returns false for missing response', () => {
      const invalid = {
        followUpQuestion: 'Does this help?',
        confidenceLevel: 'high',
      };
      expect(isValidDoubtsResponse(invalid)).toBe(false);
    });

    it('returns false for invalid confidence level', () => {
      const invalid = {
        response: 'Here is the explanation',
        followUpQuestion: 'Does this help?',
        confidenceLevel: 'very_high',
      };
      expect(isValidDoubtsResponse(invalid)).toBe(false);
    });

    it('returns false for non-object', () => {
      expect(isValidDoubtsResponse('string')).toBe(false);
      expect(isValidDoubtsResponse(null)).toBe(false);
      expect(isValidDoubtsResponse(undefined)).toBe(false);
    });
  });

  describe('isOffTopicQuestion', () => {
    it('detects personal/dating questions', () => {
      expect(isOffTopicQuestion('How do I get a girlfriend?', 'Science')).toBe(true);
      expect(isOffTopicQuestion('I have a crush on someone', 'Math')).toBe(true);
    });

    it('detects political questions', () => {
      expect(isOffTopicQuestion('Who should I vote for?', 'Science')).toBe(true);
      expect(isOffTopicQuestion('What do you think about the government policy?', 'Math')).toBe(true);
    });

    it('detects violence-related questions', () => {
      expect(isOffTopicQuestion('How to fight someone?', 'Science')).toBe(true);
    });

    it('detects cheating requests', () => {
      expect(isOffTopicQuestion('How to hack the exam system?', 'Science')).toBe(true);
      expect(isOffTopicQuestion('Can you help me cheat?', 'Math')).toBe(true);
    });

    it('allows academic questions', () => {
      expect(isOffTopicQuestion('Why does a magnet attract iron?', 'Science')).toBe(false);
      expect(isOffTopicQuestion('What is the formula for area of circle?', 'Math')).toBe(false);
      expect(isOffTopicQuestion('Explain photosynthesis', 'Biology')).toBe(false);
    });
  });

  describe('getOffTopicRedirect', () => {
    it('returns a polite redirect response', () => {
      const redirect = getOffTopicRedirect('Science');
      
      expect(redirect.response).toContain('focus on Science');
      expect(redirect.followUpQuestion).toContain('Science');
      expect(redirect.confidenceLevel).toBe('high');
    });

    it('adapts to different subjects', () => {
      const mathRedirect = getOffTopicRedirect('Mathematics');
      expect(mathRedirect.response).toContain('Mathematics');
      
      const englishRedirect = getOffTopicRedirect('English');
      expect(englishRedirect.response).toContain('English');
    });
  });

  describe('DOUBTS_OUTPUT_SCHEMA', () => {
    it('defines all required fields', () => {
      expect(DOUBTS_OUTPUT_SCHEMA).toContain('response');
      expect(DOUBTS_OUTPUT_SCHEMA).toContain('followUpQuestion');
      expect(DOUBTS_OUTPUT_SCHEMA).toContain('confidenceLevel');
    });
  });
});
