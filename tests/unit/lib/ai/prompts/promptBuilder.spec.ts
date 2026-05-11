/**
 * FILE OBJECTIVE:
 * - Unit tests for promptBuilder integration with callLLM.
 * - Tests mock callLLM to verify prompt construction and response validation.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: tests/unit/lib/ai/prompts/promptBuilder.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created unit tests for promptBuilder integration
 * - 2026-05-11T00:00:00Z | claude | update doubts fixtures to match production DoubtsOutputSchema
 *   (response/followUpQuestions/confidenceLevel); fix intent->studentIntent field name; update
 *   assertions and off-topic/rewrite test expectations to match guardrail behaviour
 */

import {
  generateNotes,
  generatePractice,
  generateDoubtResponse,
  TIMEOUT_CONFIG,
  RETRY_CONFIG,
} from '@/lib/ai/prompts/promptBuilder';
import type {
  NotesInputContract,
  PracticeInputContract,
  DoubtsInputContract,
  NotesOutputSchema,
  PracticeOutputSchema,
  DoubtsOutputSchema,
} from '@/lib/ai/prompts/schemas';

// Mock callLLM module
jest.mock('@/lib/callLLM', () => ({
  callLLM: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { callLLM } from '@/lib/callLLM';

const mockCallLLM = callLLM as jest.MockedFunction<typeof callLLM>;

describe('PromptBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('exports TIMEOUT_CONFIG with correct values', () => {
      expect(TIMEOUT_CONFIG.notes).toBe(30000);
      expect(TIMEOUT_CONFIG.practice).toBe(35000);
      expect(TIMEOUT_CONFIG.doubts).toBe(20000);
    });

    it('exports RETRY_CONFIG with correct values', () => {
      expect(RETRY_CONFIG.maxRetries).toBe(2);
      expect(RETRY_CONFIG.retryDelayMs).toBe(1000);
      expect(RETRY_CONFIG.retryOnValidationFailure).toBe(true);
    });
  });

  describe('generateNotes', () => {
    const validInput: NotesInputContract = {
      grade: 10,
      board: 'CBSE',
      language: 'English',
      subject: 'Mathematics',
      chapter: 'Quadratic Equations',
      topic: 'Solving by Factoring',
      explanationLevel: 'conceptual',
      preferredLength: 'medium',
    };

    const validResponse: NotesOutputSchema = {
      title: 'Solving Quadratic Equations by Factoring',
      learningObjectives: [
        'Understand what factoring means',
        'Apply factoring to solve equations',
      ],
      coreExplanation: [
        {
          heading: 'What is Factoring?',
          content: 'Factoring is the process of...',
        },
      ],
      workedExamples: [
        {
          question: 'Solve x² + 5x + 6 = 0',
          explanation: 'Step 1: Factor as (x+2)(x+3)...',
        },
      ],
      keyTakeaways: ['Always check your factors'],
      commonMistakes: ['Forgetting to set each factor to zero'],
    };

    it('generates notes successfully with valid response', async () => {
      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify(validResponse),
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
        costUsd: 0.001,
        latencyMs: 500,
        model: 'gpt-4o',
      });

      const result = await generateNotes(validInput, 'user123hash', 'session456');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validResponse);
      expect(result.error).toBeNull();
      expect(result.validationErrors).toHaveLength(0);
      expect(result.metadata.promptType).toBe('notes');
      expect(result.costUsd).toBe(0.001);
      expect(result.latencyMs).toBe(500);
      expect(result.model).toBe('gpt-4o');
    });

    it('calls callLLM with correct meta', async () => {
      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify(validResponse),
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
        costUsd: 0.001,
        latencyMs: 500,
        model: 'gpt-4o',
      });

      await generateNotes(validInput, 'user123hash', 'session456');

      expect(mockCallLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            promptType: 'notes',
            board: 'CBSE',
            grade: '10',
            subject: 'Mathematics',
            chapter: 'Quadratic Equations',
            topic: 'Solving by Factoring',
            language: 'English',
            userIdHash: 'user123hash',
            sessionId: 'session456',
          }),
          timeoutMs: TIMEOUT_CONFIG.notes,
        })
      );
    });

    it('handles validation errors and retries', async () => {
      // First call returns invalid JSON
      mockCallLLM.mockResolvedValueOnce({
        content: '{"title": ""}',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        costUsd: 0.0005,
        latencyMs: 300,
        model: 'gpt-4o',
      });

      // Second call returns valid JSON
      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify(validResponse),
        usage: { prompt_tokens: 150, completion_tokens: 200, total_tokens: 350 },
        costUsd: 0.001,
        latencyMs: 500,
        model: 'gpt-4o',
      });

      const result = await generateNotes(validInput, 'user123hash', 'session456');

      expect(result.success).toBe(true);
      expect(mockCallLLM).toHaveBeenCalledTimes(2);
    });

    it('returns failure after max retries', async () => {
      mockCallLLM.mockResolvedValue({
        content: '{"invalid": "response"}',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        costUsd: 0.0005,
        latencyMs: 300,
        model: 'gpt-4o',
      });

      const result = await generateNotes(validInput, 'user123hash', 'session456');

      expect(result.success).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(mockCallLLM).toHaveBeenCalledTimes(RETRY_CONFIG.maxRetries + 1);
    });

    it('handles callLLM errors', async () => {
      mockCallLLM.mockRejectedValueOnce(new Error('LLM timeout'));
      mockCallLLM.mockRejectedValueOnce(new Error('LLM timeout'));
      mockCallLLM.mockRejectedValueOnce(new Error('LLM timeout'));

      const result = await generateNotes(validInput, 'user123hash', 'session456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('LLM timeout');
    });
  });

  describe('generatePractice', () => {
    const validInput: PracticeInputContract = {
      grade: 10,
      board: 'CBSE',
      language: 'English',
      subject: 'Mathematics',
      chapter: 'Quadratic Equations',
      topic: 'Solving by Factoring',
      difficulty: 'medium',
      questionCount: 3,
      questionTypes: ['mcq', 'short_answer'],
    };

    const validResponse: PracticeOutputSchema = {
      questions: [
        {
          id: 'q1',
          type: 'mcq',
          question: 'Solve x² + 5x + 6 = 0',
          options: ['x = -2, -3', 'x = 2, 3', 'x = -2, 3', 'x = 2, -3'],
          correctAnswer: 'x = -2, -3',
          explanation: 'Factoring gives (x+2)(x+3)=0',
          difficulty: 'medium',
          conceptTested: 'Factoring quadratics',
        },
        {
          id: 'q2',
          type: 'mcq',
          question: 'Solve x² - 4 = 0',
          options: ['x = 2', 'x = -2', 'x = ±2', 'x = 4'],
          correctAnswer: 'x = ±2',
          explanation: 'Difference of squares',
          difficulty: 'medium',
          conceptTested: 'Factoring quadratics',
        },
        {
          id: 'q3',
          type: 'short_answer',
          question: 'Factor x² + 7x + 12',
          options: null,
          correctAnswer: '(x+3)(x+4)',
          explanation: 'Find factors of 12 that sum to 7',
          difficulty: 'medium',
          conceptTested: 'Factoring quadratics',
        },
      ],
      summary: {
        totalQuestions: 3,
        difficultyBreakdown: { easy: 0, medium: 3, hard: 0 },
        conceptsCovered: ['Factoring quadratics'],
      },
    };

    it('generates practice questions successfully', async () => {
      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify(validResponse),
        usage: { prompt_tokens: 100, completion_tokens: 300, total_tokens: 400 },
        costUsd: 0.002,
        latencyMs: 800,
        model: 'gpt-4o',
      });

      const result = await generatePractice(validInput, 'user123hash', 'session456');

      expect(result.success).toBe(true);
      expect(result.data?.questions).toHaveLength(3);
      expect(result.metadata.promptType).toBe('practice');
    });

    it('verifies question count and retries if insufficient', async () => {
      const shortResponse = {
        ...validResponse,
        questions: validResponse.questions.slice(0, 1),
        summary: { ...validResponse.summary, totalQuestions: 1 },
      };

      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify(shortResponse),
        usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
        costUsd: 0.001,
        latencyMs: 400,
        model: 'gpt-4o',
      });

      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify(validResponse),
        usage: { prompt_tokens: 150, completion_tokens: 300, total_tokens: 450 },
        costUsd: 0.002,
        latencyMs: 800,
        model: 'gpt-4o',
      });

      const result = await generatePractice(validInput, 'user123hash', 'session456');

      expect(result.success).toBe(true);
      expect(result.data?.questions).toHaveLength(3);
      expect(mockCallLLM).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateDoubtResponse', () => {
    const validInput: DoubtsInputContract = {
      grade: 10,
      board: 'CBSE',
      language: 'English',
      subject: 'Mathematics',
      chapter: 'Quadratic Equations',
      topic: 'Solving by Factoring',
      studentQuestion: 'Why do we set factors equal to zero?',
      studentIntent: 'conceptual_clarity',
      conversationHistory: [],
    };

    const validResponse: DoubtsOutputSchema = {
      response: 'When we factor a quadratic equation, we find values of x that make the expression zero. First, we write the equation in standard form. Then, we find two numbers that multiply to the constant term and add to the coefficient. Therefore, setting each factor to zero gives us the solutions because of the zero-product property.',
      followUpQuestions: [
        'Can you try applying this method to x squared minus 5x plus 6 equals 0?',
        'What would happen if neither factor could equal zero?',
      ],
      confidenceLevel: 'high',
    };

    it('generates doubt response successfully', async () => {
      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify(validResponse),
        usage: { prompt_tokens: 80, completion_tokens: 100, total_tokens: 180 },
        costUsd: 0.0008,
        latencyMs: 400,
        model: 'gpt-4o',
      });

      const result = await generateDoubtResponse(validInput, 'user123hash', 'session456');

      expect(result.success).toBe(true);
      expect(result.data?.response).toBe(validResponse.response);
      expect(result.data?.followUpQuestions).toEqual(validResponse.followUpQuestions);
      expect(result.data?.confidenceLevel).toBe('high');
      expect(result.metadata.promptType).toBe('doubts');
    });

    it('handles off-topic questions with redirect', async () => {
      const offTopicInput: DoubtsInputContract = {
        ...validInput,
        studentQuestion: 'What is the weather like today?',
      };

      const result = await generateDoubtResponse(offTopicInput, 'user123hash', 'session456');

      expect(result.success).toBe(true);
      expect(result.data?.response).toBeDefined();
      expect(result.data?.confidenceLevel).toBe('high');
      expect(mockCallLLM).not.toHaveBeenCalled();
    });

    it('redirects homework-style requests via prompt rewriting and calls LLM', async () => {
      const homeworkInput: DoubtsInputContract = {
        ...validInput,
        studentQuestion: 'Solve this for me: x squared plus 5x plus 6 equals 0',
        studentIntent: 'solve_homework',
      };

      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          ...validResponse,
          response: "I'll guide you through solving this step by step. First, we need to find two numbers that multiply to 6 and add to 5. Then, we factor the expression using these numbers. Therefore, the solutions come from setting each factor equal to zero.",
        }),
        usage: { prompt_tokens: 100, completion_tokens: 150, total_tokens: 250 },
        costUsd: 0.001,
        latencyMs: 500,
        model: 'gpt-4o',
      });

      const result = await generateDoubtResponse(homeworkInput, 'user123hash', 'session456');

      expect(result.success).toBe(true);
      expect(result.data?.response).toBeDefined();
      expect(mockCallLLM).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('handles JSON wrapped in markdown code fences', async () => {
      const validResponse: NotesOutputSchema = {
        title: 'Test',
        learningObjectives: ['Learn'],
        coreExplanation: [{ heading: 'H1', content: 'C1' }],
        workedExamples: [{ question: 'Q1', explanation: 'E1' }],
        keyTakeaways: ['Key'],
        commonMistakes: ['Mistake'],
      };

      mockCallLLM.mockResolvedValueOnce({
        content: '```json\n' + JSON.stringify(validResponse) + '\n```',
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
        costUsd: 0.001,
        latencyMs: 500,
        model: 'gpt-4o',
      });

      const validInput: NotesInputContract = {
        grade: 10,
        board: 'CBSE',
        language: 'English',
        subject: 'Math',
        chapter: 'Ch1',
        topic: 'T1',
        explanationLevel: 'simple',
        preferredLength: 'short',
      };

      const result = await generateNotes(validInput, 'user', 'session');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validResponse);
    });

    it('includes rawResponse in failure results for debugging', async () => {
      mockCallLLM.mockResolvedValue({
        content: 'Not valid JSON at all',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        costUsd: 0.0005,
        latencyMs: 300,
        model: 'gpt-4o',
      });

      const validInput: NotesInputContract = {
        grade: 10,
        board: 'CBSE',
        language: 'English',
        subject: 'Math',
        chapter: 'Ch1',
        topic: 'T1',
        explanationLevel: 'simple',
        preferredLength: 'short',
      };

      const result = await generateNotes(validInput, 'user', 'session');

      expect(result.success).toBe(false);
      expect(result.rawResponse).toBe('Not valid JSON at all');
    });
  });
});
