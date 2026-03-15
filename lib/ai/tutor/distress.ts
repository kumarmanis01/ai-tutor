export interface DistressResult {
  detected: boolean
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  triggerPhrases: string[]
  suggestedResponse: string
}

// ── Keyword categories — checked case-insensitively ──────────────────────────

const CRITICAL_PHRASES = [
  'want to disappear',
  'wish i was dead',
  'end my life',
  'self harm',
  'hurt myself',
]

const HIGH_PHRASES = [
  'worthless',
  'hopeless',
  'nobody cares about me',
  'no point',
  'give up on life',
]

const MEDIUM_PHRASES = [
  'hate myself',
  'i give up',
  "can't do anything right",
  'always failing',
]

const LOW_PHRASES = [
  'so stressed',
  'want to cry',
  'this is too hard',
]

// ── Responses ─────────────────────────────────────────────────────────────────

const CRITICAL_HIGH_RESPONSE =
  "I hear you, and I'm glad you're talking to me. What you're feeling matters. " +
  "Please talk to someone you trust — a parent, teacher, or counsellor — about this. " +
  "You don't have to carry this alone. 💙"

const MEDIUM_LOW_RESPONSE =
  "It sounds like you're having a tough time. That's completely okay — " +
  "learning is hard sometimes. Want to take a short break and come back to this?"

const NO_RESPONSE = ''

// ── Pure detection function ───────────────────────────────────────────────────

/**
 * Detects emotional distress signals in a student message.
 * Pure function — no I/O, never throws.
 * Severity precedence: CRITICAL > HIGH > MEDIUM > LOW.
 */
export function detectDistress(studentMessage: string): DistressResult {
  if (!studentMessage) {
    return { detected: false, severity: 'LOW', triggerPhrases: [], suggestedResponse: NO_RESPONSE }
  }

  const lower = studentMessage.toLowerCase()
  const matched: string[] = []

  // Check each category; stop at the highest severity found
  for (const phrase of CRITICAL_PHRASES) {
    if (lower.includes(phrase)) matched.push(phrase)
  }
  if (matched.length > 0) {
    return {
      detected: true,
      severity: 'CRITICAL',
      triggerPhrases: matched,
      suggestedResponse: CRITICAL_HIGH_RESPONSE,
    }
  }

  for (const phrase of HIGH_PHRASES) {
    if (lower.includes(phrase)) matched.push(phrase)
  }
  if (matched.length > 0) {
    return {
      detected: true,
      severity: 'HIGH',
      triggerPhrases: matched,
      suggestedResponse: CRITICAL_HIGH_RESPONSE,
    }
  }

  for (const phrase of MEDIUM_PHRASES) {
    if (lower.includes(phrase)) matched.push(phrase)
  }
  if (matched.length > 0) {
    return {
      detected: true,
      severity: 'MEDIUM',
      triggerPhrases: matched,
      suggestedResponse: MEDIUM_LOW_RESPONSE,
    }
  }

  for (const phrase of LOW_PHRASES) {
    if (lower.includes(phrase)) matched.push(phrase)
  }
  if (matched.length > 0) {
    return {
      detected: true,
      severity: 'LOW',
      triggerPhrases: matched,
      suggestedResponse: MEDIUM_LOW_RESPONSE,
    }
  }

  return { detected: false, severity: 'LOW', triggerPhrases: [], suggestedResponse: NO_RESPONSE }
}
