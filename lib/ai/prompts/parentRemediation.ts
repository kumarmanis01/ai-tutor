/**
 * FILE OBJECTIVE:
 * - Prompt builder and simple validator for parent-facing readiness remediation
 *   suggestions. Returns a small structured JSON payload (bullets + practice +
 *   callToAction) to keep downstream HTML generation safe and predictable.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompts/parentRemediation.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-15 | copilot | add parent remediation prompt builder + schema
 */

import { z } from 'zod';
import { safeParseLLMJson } from './validators';

// Human-readable JSON schema to include inside prompts so the LLM returns a
// strict structure the validators can parse.
export const PARENT_REMEDIATION_OUTPUT_SCHEMA = `{
  "bullets": ["string - 2-3 short remediation bullets (8-16 words each)"],
  "practice": "string - one brief practice activity (10-30 words)",
  "callToAction": "string - one-line call-to-action (10-20 words)"
}`;

export const ParentRemediationSchema = z.object({
  bullets: z.array(z.string()).min(1).max(5),
  practice: z.string(),
  callToAction: z.string(),
});

export type ParentRemediation = z.infer<typeof ParentRemediationSchema>;

export function buildParentRemediationPrompt(opts: {
  subjectName: string;
  prev: number;
  curr: number;
  daysAgo: number;
}) {
  return `You are a gentle, practical education coach writing for a parent with low technical familiarity.

Context:
- Subject: ${opts.subjectName}
- Seven days ago readiness: ${opts.prev}%
- Now: ${opts.curr}%
- Lookback window (days): ${opts.daysAgo}

Produce a short, constructive remediation plan for the parent that includes:
1) 2-3 short bullets (each 8-16 words) with simple actions the parent can support (e.g., 3x 20-minute focused sessions),
2) one brief practice activity the parent can encourage (10-30 words),
3) a one-line warm call-to-action at the end.

Return ONLY valid JSON matching this exact schema:
${PARENT_REMEDIATION_OUTPUT_SCHEMA}

Do NOT include any other text or explanations. Do NOT wrap in markdown code fences.`;
}

/**
 * Parse raw LLM output into the `ParentRemediation` structure using the
 * project's shared JSON cleanup helper and Zod validation.
 */
export function parseParentRemediation(raw: string): {
  valid: boolean;
  data: ParentRemediation | null;
  errors: string[];
} {
  const parsed = safeParseLLMJson<unknown>(raw);
  if (!parsed.valid || !parsed.data) return { valid: false, data: null, errors: parsed.errors };

  const result = ParentRemediationSchema.safeParse(parsed.data);
  if (!result.success) {
    return {
      valid: false,
      data: null,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }

  return { valid: true, data: result.data, errors: [] };
}

export default buildParentRemediationPrompt;
