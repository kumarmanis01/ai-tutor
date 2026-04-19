/**
 * FILE OBJECTIVE:
 * - Provide a lightweight heuristic detector for copy-pasted or suspiciously
 *   perfect student answers by comparing student text against curriculum RAG
 *   chunks and cached explanations. Intended to trigger a probing follow-up
 *   (AC-09) when high similarity is detected.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/tutor/copyPasteDetector.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | created
 */

/**
 * Minimal result shape for detection.
 */
export interface CopyPasteResult {
  flagged: boolean
  score: number // 0-1 similarity score (best match)
  chunkId?: string | null
  reason?: string | null
}

/**
 * Tokenize a text into lowercased word tokens (naive). Removes short tokens.
 */
function tokenize(text: string): string[] {
  if (!text) return []
  return text
    .toLowerCase()
    .replace(/["'`~<>]/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * Compute a simple overlap ratio between two token arrays.
 * Returns intersection / min(lenA, lenB) which biases toward near-subset matches.
 */
function overlapRatio(aTokens: string[], bTokens: string[]): number {
  if (!aTokens.length || !bTokens.length) return 0
  const bSet = new Set(bTokens)
  let common = 0
  for (const t of aTokens) if (bSet.has(t)) common++
  return common / Math.min(aTokens.length, bTokens.length)
}

/**
 * Heuristic copy/paste detector.
 * - flags when student's answer is nearly identical to a curriculum chunk
 *   or cached explanation (overlapRatio >= 0.9 and token count >= 20),
 *   or exact trimmed match.
 * - returns best-match score and chunk id when available.
 */
export function detectCopyPaste(
  studentText: string,
  chunks: { chunkId: string; content: string }[],
  opts?: { minTokens?: number; threshold?: number },
): CopyPasteResult {
  const minTokens = opts?.minTokens ?? 20
  const threshold = opts?.threshold ?? 0.9

  const s = String(studentText ?? '').trim()
  if (!s) return { flagged: false, score: 0 }

  const sTokens = tokenize(s)
  if (sTokens.length < 6) {
    // too short to meaningfully detect copy/paste
    return { flagged: false, score: 0 }
  }

  let bestScore = 0
  let bestChunkId: string | null = null

  for (const c of chunks || []) {
    const content = String(c.content ?? '').trim()
    if (!content) continue

    if (content === s) {
      return { flagged: true, score: 1, chunkId: c.chunkId, reason: 'exact_match' }
    }

    const cTokens = tokenize(content)
    const score = overlapRatio(sTokens, cTokens)
    if (score > bestScore) {
      bestScore = score
      bestChunkId = c.chunkId
    }
  }

  // Suspiciously perfect: high overlap and sufficiently long answer
  if (bestScore >= threshold && sTokens.length >= minTokens) {
    return { flagged: true, score: bestScore, chunkId: bestChunkId ?? null, reason: 'high_overlap' }
  }

  return { flagged: false, score: bestScore }
}

export default detectCopyPaste
