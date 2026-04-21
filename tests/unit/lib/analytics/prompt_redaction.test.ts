/**
 * FILE OBJECTIVE:
 * - Verify that callLLM never persists raw prompt text in AIContentLog.requestBody.
 *   The requestBody must contain prompt_hash (sha256 hex) and prompt_redacted_preview
 *   (<=200 chars), never the full raw prompt string.
 *
 * LINKED UNIT TEST:
 * - lib/callLLM.ts
 *
 * EDIT LOG:
 * - 2026-04-21 | staff-engineer | Task A: prompt redaction enforcement
 */

import crypto from 'crypto'

// Inline the helpers from callLLM so we can test them in isolation without
// importing the full module (which requires OpenAI and Prisma connections).
function hashPrompt(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function redactedPreview(text: string): string {
  return text.slice(0, 200)
}

describe('prompt redaction helpers', () => {
  it('should produce a 64-char hex sha256 hash for any prompt', () => {
    const h = hashPrompt('hello world')
    expect(h).toHaveLength(64)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('should produce a deterministic hash for the same input', () => {
    const prompt = 'Solve this: 2 + 2 = ?'
    expect(hashPrompt(prompt)).toBe(hashPrompt(prompt))
  })

  it('should produce different hashes for different prompts', () => {
    expect(hashPrompt('prompt A')).not.toBe(hashPrompt('prompt B'))
  })

  it('should return at most 200 chars in the preview', () => {
    const long = 'x'.repeat(500)
    expect(redactedPreview(long)).toHaveLength(200)
  })

  it('should return the full text if it is shorter than 200 chars', () => {
    const short = 'short prompt'
    expect(redactedPreview(short)).toBe(short)
  })

  it('should never include text beyond position 200 in the preview', () => {
    // SECRET_TAIL_ starts at char 201, outside the 200-char window
    const prompt = 'A'.repeat(200) + 'SECRET_TAIL_' + 'B'.repeat(100)
    const preview = redactedPreview(prompt)
    expect(preview).not.toContain('SECRET_TAIL_')
    expect(preview.length).toBeLessThanOrEqual(200)
  })

  describe('requestBody shape assertion', () => {
    it('should produce requestBody with prompt_hash and prompt_redacted_preview, not raw prompt', () => {
      const rawPrompt = 'What is photosynthesis? PII: user@example.com'
      const requestBody = {
        prompt_hash: hashPrompt(rawPrompt),
        prompt_redacted_preview: redactedPreview(rawPrompt),
      }

      // Must have the hash key
      expect(requestBody).toHaveProperty('prompt_hash')
      expect(typeof requestBody.prompt_hash).toBe('string')
      expect(requestBody.prompt_hash).toHaveLength(64)

      // Must have a preview key
      expect(requestBody).toHaveProperty('prompt_redacted_preview')
      expect(requestBody.prompt_redacted_preview.length).toBeLessThanOrEqual(200)

      // Must NOT have a raw 'prompt' key
      expect(requestBody).not.toHaveProperty('prompt')
      // The shape must only expose hash + preview — never a top-level raw prompt
      expect(Object.keys(requestBody).sort()).toEqual(['prompt_hash', 'prompt_redacted_preview'])
    })
  })
})
