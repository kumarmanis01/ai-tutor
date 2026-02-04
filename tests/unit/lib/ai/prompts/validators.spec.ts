/**
 * FILE OBJECTIVE:
 * - Unit tests for JSON validators.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: tests/unit/lib/ai/prompts/validators.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created unit tests for JSON validators
 */

import {
  safeParseLLMJson,
  validateNotesOutput,
  validatePracticeOutput,
  validateDoubtsOutput,
  validateLLMResponse,
} from '@/lib/ai/prompts/validators';

describe('JSON Validators', () => {
  describe('safeParseLLMJson', () => {
    it('parses valid JSON', () => {
      const result = safeParseLLMJson('{"key": "value"}');
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
    });

    it('handles JSON with markdown fences', () => {
      const result = safeParseLLMJson('```json\n{"key": "value"}\n```');
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
    });

    it('handles JSON with leading text', () => {
      const result = safeParseLLMJson('Here is the response: {"key": "value"}');
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
    });

    it('handles JSON with trailing text', () => {
      const result = safeParseLLMJson('{"key": "value"} That is my answer.');
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
    });

    it('returns error for invalid JSON', () => {
      const result = safeParseLLMJson('not json at all');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns error for malformed JSON', () => {
      const result = safeParseLLMJson('{"key": }');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('parse error');
    });
  });

  describe('validateNotesOutput', () => {
    const validNotes = {
      title: 'Test Title',
      learningObjectives: ['Objective 1', 'Objective 2'],
      coreExplanation: [
        { heading: 'Section 1', content: 'Content 1' },
      ],
      workedExamples: [
        { question: 'Q1', explanation: 'E1' },
      ],
      keyTakeaways: ['Takeaway 1'],
      commonMistakes: ['Mistake 1'],
    };

    it('validates correct notes structure', () => {
      const result = validateNotesOutput(validNotes);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(validNotes);
    });

    it('rejects missing title', () => {
      const { title, ...invalid } = validNotes;
      const result = validateNotesOutput(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('title: must be a non-empty string');
    });

    it('rejects empty learningObjectives', () => {
      const result = validateNotesOutput({ ...validNotes, learningObjectives: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('learningObjectives');
    });

    it('rejects invalid coreExplanation structure', () => {
      const result = validateNotesOutput({
        ...validNotes,
        coreExplanation: [{ heading: '', content: 'test' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('heading');
    });

    it('rejects non-object input', () => {
      const result = validateNotesOutput('not an object');
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePracticeOutput', () => {
    const validPractice = {
      questions: [
        {
          id: 'q1',
          type: 'mcq',
          question: 'What is 2+2?',
          options: ['2', '3', '4', '5'],
          correctAnswer: '4',
          explanation: 'Adding 2 and 2 gives 4',
          difficulty: 'easy',
          conceptTested: 'Basic addition',
        },
      ],
    };

    it('validates correct practice structure', () => {
      const result = validatePracticeOutput(validPractice);
      expect(result.valid).toBe(true);
    });

    it('rejects MCQ without 4 options', () => {
      const result = validatePracticeOutput({
        questions: [{
          ...validPractice.questions[0],
          options: ['A', 'B', 'C'], // Only 3 options
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('4 options');
    });

    it('rejects MCQ with correctAnswer not in options', () => {
      const result = validatePracticeOutput({
        questions: [{
          ...validPractice.questions[0],
          correctAnswer: '10', // Not in options
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must match one of the options');
    });

    it('rejects invalid question type', () => {
      const result = validatePracticeOutput({
        questions: [{
          ...validPractice.questions[0],
          type: 'essay', // Invalid type
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('type');
    });

    it('rejects invalid difficulty', () => {
      const result = validatePracticeOutput({
        questions: [{
          ...validPractice.questions[0],
          difficulty: 'extreme', // Invalid
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('difficulty');
    });

    it('validates short_answer questions', () => {
      const result = validatePracticeOutput({
        questions: [{
          id: 'q1',
          type: 'short_answer',
          question: 'What is the capital of India?',
          options: null,
          correctAnswer: 'New Delhi',
          explanation: 'New Delhi is the capital',
          difficulty: 'easy',
          conceptTested: 'Indian geography',
        }],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateDoubtsOutput', () => {
    const validDoubts = {
      response: 'Great question! Here is the explanation...',
      followUpQuestion: 'Does this make sense?',
      confidenceLevel: 'high',
    };

    it('validates correct doubts structure', () => {
      const result = validateDoubtsOutput(validDoubts);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(validDoubts);
    });

    it('rejects empty response', () => {
      const result = validateDoubtsOutput({ ...validDoubts, response: '' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('response');
    });

    it('rejects empty followUpQuestion', () => {
      const result = validateDoubtsOutput({ ...validDoubts, followUpQuestion: '' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('followUpQuestion');
    });

    it('rejects invalid confidenceLevel', () => {
      const result = validateDoubtsOutput({ ...validDoubts, confidenceLevel: 'very_high' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('confidenceLevel');
    });

    it('accepts all valid confidence levels', () => {
      for (const level of ['high', 'medium', 'low']) {
        const result = validateDoubtsOutput({ ...validDoubts, confidenceLevel: level });
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('validateLLMResponse', () => {
    it('parses and validates notes response', () => {
      const rawResponse = JSON.stringify({
        title: 'Test',
        learningObjectives: ['Learn'],
        coreExplanation: [{ heading: 'H', content: 'C' }],
        workedExamples: [],
        keyTakeaways: [],
        commonMistakes: [],
      });

      const result = validateLLMResponse(rawResponse, 'notes');
      expect(result.valid).toBe(true);
    });

    it('parses and validates practice response', () => {
      const rawResponse = JSON.stringify({
        questions: [{
          id: 'q1',
          type: 'short_answer',
          question: 'Q',
          options: null,
          correctAnswer: 'A',
          explanation: 'E',
          difficulty: 'easy',
          conceptTested: 'C',
        }],
      });

      const result = validateLLMResponse(rawResponse, 'practice');
      expect(result.valid).toBe(true);
    });

    it('parses and validates doubts response', () => {
      const rawResponse = JSON.stringify({
        response: 'R',
        followUpQuestion: 'F',
        confidenceLevel: 'high',
      });

      const result = validateLLMResponse(rawResponse, 'doubts');
      expect(result.valid).toBe(true);
    });

    it('returns parse error for invalid JSON', () => {
      const result = validateLLMResponse('not json', 'notes');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('JSON');
    });
  });
});
