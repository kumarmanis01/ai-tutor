/**
 * FILE OBJECTIVE:
 * - Verify that callLLM never persists raw prompt text in AIContentLog.requestBody.
 *   Tests the real exported helpers (hashPrompt, redactedPreview, buildPromptRequestBody)
 *   from lib/callLLM.ts so any regression in production code is caught immediately.
 *
 * LINKED UNIT TEST:
 * - lib/callLLM.ts
 *
 * EDIT LOG:
 * - 2026-04-21 | staff-engineer | Task A: prompt redaction enforcement
 * - 2026-04-21 | staff-engineer | review fix: import real helpers instead of re-implementing
 */

// Mock heavy dependencies so we can import callLLM without OpenAI or DB connections.
jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/ai/tutor/circuitBreaker', () => ({
  isCircuitOpen: jest.fn().mockResolvedValue(false),
  recordFailure: jest.fn(),
  recordSuccess: jest.fn(),
}));
jest.mock('@/lib/ai/piiRedaction', () => ({
  redactPIIFromText: jest.fn((t: string) => t),
  redactPIIFromMessages: jest.fn((m: unknown) => m),
}));

import { hashPrompt, redactedPreview, buildPromptRequestBody } from '@/lib/callLLM';

describe('prompt redaction helpers (lib/callLLM)', () => {
  describe('hashPrompt', () => {
    it('should produce a 64-char hex sha256 hash for any prompt', () => {
      const h = hashPrompt('hello world');
      expect(h).toHaveLength(64);
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce a deterministic hash for the same input', () => {
      const prompt = 'Solve this: 2 + 2 = ?';
      expect(hashPrompt(prompt)).toBe(hashPrompt(prompt));
    });

    it('should produce different hashes for different prompts', () => {
      expect(hashPrompt('prompt A')).not.toBe(hashPrompt('prompt B'));
    });
  });

  describe('redactedPreview', () => {
    it('should return at most 200 chars in the preview', () => {
      expect(redactedPreview('x'.repeat(500))).toHaveLength(200);
    });

    it('should return the full text when shorter than 200 chars', () => {
      const short = 'short prompt';
      expect(redactedPreview(short)).toBe(short);
    });

    it('should never include text beyond position 200', () => {
      const prompt = 'A'.repeat(200) + 'SECRET_TAIL_' + 'B'.repeat(100);
      const preview = redactedPreview(prompt);
      expect(preview).not.toContain('SECRET_TAIL_');
      expect(preview.length).toBeLessThanOrEqual(200);
    });
  });

  describe('buildPromptRequestBody', () => {
    it('should return an object with prompt_hash and prompt_redacted_preview only', () => {
      const rawPrompt = 'What is photosynthesis?';
      const body = buildPromptRequestBody(rawPrompt);

      expect(Object.keys(body).sort()).toEqual(['prompt_hash', 'prompt_redacted_preview']);
    });

    it('should never include a raw prompt key', () => {
      const body = buildPromptRequestBody('any prompt');
      expect(body).not.toHaveProperty('prompt');
    });

    it('prompt_hash should be the sha256 of the prompt', () => {
      const rawPrompt = 'test prompt';
      const body = buildPromptRequestBody(rawPrompt);
      expect(body.prompt_hash).toBe(hashPrompt(rawPrompt));
      expect(body.prompt_hash).toHaveLength(64);
    });

    it('prompt_redacted_preview should be capped at 200 chars', () => {
      const body = buildPromptRequestBody('x'.repeat(500));
      expect(body.prompt_redacted_preview.length).toBeLessThanOrEqual(200);
    });

    it('should produce consistent output for the same prompt', () => {
      const p = 'consistent prompt';
      expect(buildPromptRequestBody(p)).toEqual(buildPromptRequestBody(p));
    });
  });
});
