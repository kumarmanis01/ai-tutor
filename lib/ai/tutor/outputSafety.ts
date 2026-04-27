// Type for creating SafetyEvent rows; matches Prisma SafetyEvent model.
export interface SafetyEventCreate {
  triggerType: string
  severity: string
  studentId: string
  sessionId?: string | null
  turnId?: string | null
}

export interface OutputSafetyResult {
  safe: boolean
  text: string
  events: SafetyEventCreate[]
}

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

type CategoryDef = {
  severity: Severity
  patterns: readonly RegExp[]
  replacement: string
}

const SEVERITY_RANK: Record<Severity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
}

// Pre-compiled patterns at module load. Keep specific to reduce false positives.
const SEXUAL_PATTERNS: readonly RegExp[] = [
  /\bporn\b/i,
  /\bpornography\b/i,
  /\bnude\b/i,
  /\bnaked\b/i,
  /\bblowjob\b/i,
  /\bhandjob\b/i,
  /\bintercourse\b/i,
  /\bsex\b/i,
  /\bsext\b/i,
  /\bexplicit\b/i,
]

const SELF_HARM_PATTERNS: readonly RegExp[] = [
  /\bkill\s+myself\b/i,
  /\bsuicide\b/i,
  /\bself[-\s]?harm\b/i,
  /\bhurt\s+myself\b/i,
]

// Violence patterns: focus on graphic/intent terms, not historical "war"/"battle".
const VIOLENCE_PATTERNS: readonly RegExp[] = [
  /\bstab(?:bing)?\b/i,
  /\bbehead(?:ing)?\b/i,
  /\bshoot(?:ing)?\b/i,
  /\bmurder(?:ing)?\b/i,
  /\bgore\b/i,
  /\bdismember(?:ed|ment)?\b/i,
]

// Substance patterns: avoid legitimate chemistry terms like "ethanol" / "alcohols" in organic context.
const SUBSTANCE_PATTERNS: readonly RegExp[] = [
  /\bweed\b/i,
  /\bganja\b/i,
  /\bcannabis\b/i,
  /\bcocaine\b/i,
  /\bheroin\b/i,
  /\bmeth\b/i,
  /\bmdma\b/i,
  /\becstasy\b/i,
  /\bvodka\b/i,
  /\bwhisky\b/i,
  /\bbeer\b/i,
  /\bdrunk\b/i,
  /\bget\s+high\b/i,
]

// Personal advice patterns: relationship + professional advice prompts.
const PERSONAL_ADVICE_PATTERNS: readonly RegExp[] = [
  /\bshould\s+i\s+(break\s+up|date|marry)\b/i,
  /\bmy\s+(boyfriend|girlfriend|crush)\b/i,
  /\bdiagnose\b/i,
  /\bprescribe\b/i,
  /\bdosage\b/i,
  /\blegal\s+advice\b/i,
  /\bshould\s+i\s+sue\b/i,
]

// Category → severity → replacement text
const CATEGORIES: Readonly<Record<string, CategoryDef>> = {
  SEXUAL_CONTENT: {
    severity: 'CRITICAL',
    patterns: SEXUAL_PATTERNS,
    replacement: "I can only help with your studies. Let's get back to the topic.",
  },
  VIOLENCE: {
    severity: 'HIGH',
    patterns: VIOLENCE_PATTERNS,
    replacement: "Let's stay focused on learning. What part of the topic would you like to explore?",
  },
  SELF_HARM: {
    severity: 'CRITICAL',
    patterns: SELF_HARM_PATTERNS,
    replacement: "I'm here to support your learning. If you're feeling overwhelmed, please talk to a trusted adult.",
  },
  SUBSTANCE: {
    severity: 'MEDIUM',
    patterns: SUBSTANCE_PATTERNS,
    replacement: "Let's focus on the topic. What would you like to understand better?",
  },
  PERSONAL_ADVICE: {
    severity: 'LOW',
    patterns: PERSONAL_ADVICE_PATTERNS,
    replacement: "That's outside what I can help with. I'm here for your studies -- what shall we work on?",
  },
} as const

function resetLastIndex(re: RegExp) {
  try {
    re.lastIndex = 0
  } catch {
    // ignore
  }
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  for (const re of patterns) {
    resetLastIndex(re)
    if (re.test(text)) return true
  }
  return false
}

/**
 * Regex-only output safety filter.
 * - If unsafe content is detected, returns a safe replacement and emits SafetyEventCreate(s).
 * - If multiple categories match, uses the highest severity replacement and emits one event per category.
 * - Never throws and never returns or stores the raw unsafe response.
 *
 * @param response - Raw LLM output string.
 * @param context - Identifiers for SafetyEventCreate.
 * @returns OutputSafetyResult with safe text and safety events.
 */
export function checkOutputSafety(
  response: string,
  context: { studentId: string; sessionId: string; turnId: string },
): OutputSafetyResult {
  try {
    const text = typeof response === 'string' ? response : ''
    if (!text) return { safe: true, text: '', events: [] }

    const matched: Array<{ key: string; def: CategoryDef }> = []

    for (const key of Object.keys(CATEGORIES)) {
      const def = CATEGORIES[key]
      if (matchesAny(text, def.patterns)) {
        matched.push({ key, def })
      }
    }

    if (matched.length === 0) {
      return { safe: true, text, events: [] }
    }

    // One event per matched category (no raw text in events).
    const events: SafetyEventCreate[] = matched.map(({ def }) => ({
      triggerType: 'UNSAFE_OUTPUT',
      severity: def.severity,
      studentId: context.studentId,
      sessionId: context.sessionId,
      turnId: context.turnId,
    }))

    // Choose replacement from highest severity category.
    const highest = matched.reduce((best, cur) => {
      const b = SEVERITY_RANK[best.def.severity]
      const c = SEVERITY_RANK[cur.def.severity]
      if (c > b) return cur
      return best
    }, matched[0])

    return {
      safe: false,
      text: highest.def.replacement,
      events,
    }
  } catch {
    // Conservative default: return a safe generic message without exposing raw output.
    return {
      safe: false,
      text: "Let's stay focused on learning. What part of the topic would you like to explore?",
      events: [
        {
          triggerType: 'UNSAFE_OUTPUT',
          severity: 'HIGH',
          studentId: context.studentId,
          sessionId: context.sessionId,
          turnId: context.turnId,
        },
      ],
    }
  }
}

