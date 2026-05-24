/**
 * FILE OBJECTIVE:
 * - Small helper prompt template to instruct assembly/versioning of pieces into a stable JSON content record.
 *
 * LINKED UNIT TEST:
 * - tests/unit/prompts/assemble.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-02-18T00:00:00Z | copilot-agent | created
 */

export type AssembleParams = {
  topicName: string
  grade: number
  version?: string
}

export function assemblePrompt(_params: AssembleParams): string {
  return `Role: You are an assembler that merges validated content pieces into a final, versioned content record.

Task: Produce a single JSON object with stable fields for storage.

Input pieces will be injected by the caller; do NOT assume external state.

Output Schema (RETURN ONLY valid JSON):
{
  "topic": string,
  "grade": number,
  "version": string,
  "content": object, // validated content object provided by caller
  "metadata": {
    "createdBy": string | null,
    "createdAt": string // ISO 8601
  }
}

Constraints:
- Do not invent fields beyond the schema.
- Keep metadata minimal and deterministic.
- Return ONLY valid JSON matching the schema.

Strict Output Instruction: Return ONLY the single JSON object described above with no extra commentary.`
}
