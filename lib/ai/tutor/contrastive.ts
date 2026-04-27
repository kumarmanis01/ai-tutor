/**
 * FILE OBJECTIVE:
 * - Generate a deterministic, curriculum-safe contrastive explanation artifact
 *   for a matched misconception. This is template-driven (no LLM calls) so
 *   it remains auditable and non-hallucinating.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/tutor/contrastive.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | created deterministic contrastive generator
 */

export type LoadedMisconception = {
  id: string
  name: string
  triggerPatterns: string[]
  correction: string
  description?: string
}

export type ContrastiveArtifact = {
  misconceptionId: string
  name: string
  description?: string
  correction: string
  whyWrong: string
  whyCorrect: string
  applyTip: string
  suggestedPractice: string
}

/**
 * Build a deterministic contrastive explanation artifact from a library entry.
 * Avoids LLMs -- uses only stored fields so output is auditable.
 */
export function generateContrastiveExplanation(m: LoadedMisconception): ContrastiveArtifact {
  const safeName = String(m.name ?? '').trim()
  const safeDescription = String(m.description ?? '').trim()
  const safeCorrection = String(m.correction ?? '').trim()

  const whyWrong = safeDescription || `This is a common incorrect mental model related to ${safeName}.`;
  const whyCorrect = safeCorrection || `Use the correct principle related to ${safeName}.`;

  // applyTip: short actionable step a student can follow
  const applyTip = `When you see problems like this, first check whether ${safeCorrection.replace(/\.$/, '')}. Then re-evaluate your steps.`;

  const suggestedPractice = `Practice: Re-solve a similar problem but explicitly apply the corrected idea: ${safeCorrection}. If unsure, write out the steps and check which assumption changed.`;

  return {
    misconceptionId: m.id,
    name: safeName,
    description: safeDescription || undefined,
    correction: safeCorrection,
    whyWrong,
    whyCorrect,
    applyTip,
    suggestedPractice,
  }
}

export default generateContrastiveExplanation
