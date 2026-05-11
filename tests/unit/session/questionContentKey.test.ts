/**
 * Unit tests for lib/session/questionContentKey.ts
 *
 * Verifies that buildQuestionContentKey() produces identical keys for
 * semantically-duplicate questions regardless of which field-name shape
 * (Question vs GeneratedQuestion) or minor whitespace variation is used.
 */

import { buildQuestionContentKey } from '../../../lib/session/questionContentKey';

describe('buildQuestionContentKey()', () => {
  it('should produce the same key for Question-shape and GeneratedQuestion-shape with identical content', () => {
    const questionShape = buildQuestionContentKey({
      prompt: 'What is photosynthesis?',
      choices: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
    });
    const genQuestionShape = buildQuestionContentKey({
      question: 'What is photosynthesis?',
      options: ['A', 'B', 'C', 'D'],
      answer: 'A',
    });
    expect(questionShape).toBe(genQuestionShape);
  });

  it('should normalize whitespace and case differences to the same key', () => {
    const key1 = buildQuestionContentKey({ prompt: 'What  is   photosynthesis?', choices: ['A'], correctAnswer: 'A' });
    const key2 = buildQuestionContentKey({ prompt: 'WHAT IS PHOTOSYNTHESIS?', choices: ['A'], correctAnswer: 'A' });
    expect(key1).toBe(key2);
  });

  it('should produce different keys for different question text', () => {
    const key1 = buildQuestionContentKey({ prompt: 'Question A', choices: ['X'], correctAnswer: 'X' });
    const key2 = buildQuestionContentKey({ prompt: 'Question B', choices: ['X'], correctAnswer: 'X' });
    expect(key1).not.toBe(key2);
  });

  it('should produce different keys for different options', () => {
    const key1 = buildQuestionContentKey({ prompt: 'Same prompt', choices: ['A', 'B'], correctAnswer: 'A' });
    const key2 = buildQuestionContentKey({ prompt: 'Same prompt', choices: ['C', 'D'], correctAnswer: 'A' });
    expect(key1).not.toBe(key2);
  });

  it('should produce different keys for different answers', () => {
    const key1 = buildQuestionContentKey({ prompt: 'Same', choices: ['A', 'B'], correctAnswer: 'A' });
    const key2 = buildQuestionContentKey({ prompt: 'Same', choices: ['A', 'B'], correctAnswer: 'B' });
    expect(key1).not.toBe(key2);
  });

  it('should handle null/undefined fields gracefully', () => {
    const key = buildQuestionContentKey({ prompt: null, choices: null, correctAnswer: null });
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  it('should produce the same key when prompt is provided via either field name', () => {
    const withPrompt = buildQuestionContentKey({ prompt: 'My question', options: ['A'], answer: 'A' });
    const withQuestion = buildQuestionContentKey({ question: 'My question', options: ['A'], answer: 'A' });
    expect(withPrompt).toBe(withQuestion);
  });
});
