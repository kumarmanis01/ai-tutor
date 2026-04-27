import type { TutorTag } from '@/lib/ai/tutor/stateMachine'

const VALID_TAGS: readonly TutorTag[] = [
  'QUESTION',
  'VALIDATE',
  'HINT_OFFER',
  'STAGE_ADVANCE',
  'PREREQ_FAIL',
  'STRUGGLE_DETECTED',
  'MASTERY_CONFIRMED',
] as const

const VALID_TAG_SET: ReadonlySet<string> = new Set(VALID_TAGS)

/**
 * Extracts the machine tag from the LAST NON-EMPTY line of an AI response.
 * Tag format: [TAG_NAME] -- must be the entire content of that line.
 * Returns null if last non-empty line contains no valid tag.
 *
 * @param response - Full AI response text (may contain multiple lines).
 * @returns TutorTag when a valid tag is present, otherwise null.
 */
export function parseTutorTag(response: string): TutorTag | null {
  try {
    if (typeof response !== 'string') return null
    if (!response.trim()) return null

    // Normalize line endings to handle both \n and \r\n uniformly.
    const lines = response.split(/\r?\n/)

    // Walk backwards to find the last non-empty (non-whitespace) line.
    let idx = lines.length - 1
    while (idx >= 0 && lines[idx].trim().length === 0) idx -= 1
    if (idx < 0) return null

    const candidate = lines[idx].trim()
    const match = candidate.match(/^\[([A-Z_]+)\]$/)
    if (!match) return null

    const tagName = match[1]
    if (!VALID_TAG_SET.has(tagName)) return null

    return tagName as TutorTag
  } catch {
    return null
  }
}

/**
 * Returns a new string with the tag line removed and trailing whitespace trimmed.
 * If no valid tag present, returns the original string unchanged.
 * Never mutates input.
 *
 * @param response - Full AI response text (may contain a trailing tag line).
 * @returns A new string with the tag line removed and trailing whitespace trimmed,
 *          or the original string when no valid tag is present.
 */
export function stripTag(response: string): string {
  try {
    if (typeof response !== 'string') return ''
    if (!response.trim()) return response.trim()

    const lines = response.split(/\r?\n/)

    // Locate last non-empty line
    let idx = lines.length - 1
    while (idx >= 0 && lines[idx].trim().length === 0) idx -= 1
    if (idx < 0) return response.trim()

    const candidate = lines[idx].trim()
    const match = candidate.match(/^\[([A-Z_]+)\]$/)
    if (!match || !VALID_TAG_SET.has(match[1])) {
      return response
    }

    // Remove the tag line
    const kept = lines.slice(0, idx)

    // Drop trailing empty lines after removing the tag
    while (kept.length > 0 && kept[kept.length - 1].trim().length === 0) {
      kept.pop()
    }

    return kept.join('\n').trimEnd()
  } catch {
    return response
  }
}

