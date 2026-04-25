// Type for creating SafetyEvent rows; matches Prisma SafetyEvent model.
export interface SafetyEventCreate {
  triggerType: string;
  severity: string;
  studentId: string;
  sessionId?: string | null;
  turnId?: string | null;
}

export interface InputSafetyResult {
  safe: boolean; // false = do NOT call LLM; return safe refusal to student
  redacted: string; // input with PII replaced by placeholders
  events: SafetyEventCreate[]; // caller inserts these; may be empty
}

// Compile PII patterns once at module load.
const MOBILE_RE = /\b[6-9]\d{9}\b/g;
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;

// Jailbreak patterns -- compiled once at module load.
const JAILBREAK_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  // "you are now ..." but explicitly NOT "vidya" or "tutor"/"teacher"
  /you\s+are\s+now\s+(a\s+)?(?!vidya\b|tutor\b|teacher\b)[a-z0-9_]+/i,
  /act\s+as\s+(if\s+you\s+(are|were)\s+)?(?!a\s+(tutor|teacher))/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /pretend\s+you\s+(have\s+no\s+|don.?t\s+have\s+)?restrictions?/i,
  /system\s*prompt/i,
  /reveal\s+(your\s+)?(instructions?|prompt|system)/i,
];

function resetLastIndex(re: RegExp) {
  try {
    re.lastIndex = 0;
  } catch {
    // ignore
  }
}

function redactPII(input: string): { redacted: string; hasPII: boolean } {
  let redacted = input;
  let hasPII = false;

  resetLastIndex(MOBILE_RE);
  if (MOBILE_RE.test(input)) {
    hasPII = true;
  }
  resetLastIndex(EMAIL_RE);
  if (EMAIL_RE.test(input)) {
    hasPII = true;
  }
  resetLastIndex(AADHAAR_RE);
  if (AADHAAR_RE.test(input)) {
    hasPII = true;
  }

  // Apply replacements on the working copy
  resetLastIndex(MOBILE_RE);
  redacted = redacted.replace(MOBILE_RE, '[MOBILE]');
  resetLastIndex(EMAIL_RE);
  redacted = redacted.replace(EMAIL_RE, '[EMAIL]');
  resetLastIndex(AADHAAR_RE);
  redacted = redacted.replace(AADHAAR_RE, '[AADHAAR]');

  return { redacted, hasPII };
}

function detectJailbreak(input: string): boolean {
  // Fast allowlist: explicitly permit "you are now a tutor/teacher" phrases.
  if (/you\s+are\s+now\s+(a\s+)?(tutor|teacher)\b/i.test(input)) {
    return false;
  }

  for (const re of JAILBREAK_PATTERNS) {
    resetLastIndex(re);
    if (re.test(input)) return true;
  }
  return false;
}

/**
 * Run pre-LLM input safety checks:
 * - Redact PII from the input (MOBILE, EMAIL, AADHAAR placeholders).
 * - Detect jailbreak attempts; when detected, mark `safe=false` and emit a HIGH severity JAILBREAK event.
 * - Emit a LOW severity PII event when any PII is detected, but do not block the call.
 *
 * This function never throws and performs no I/O. Same input + context always yield the same result.
 *
 * @param input - Raw student input string.
 * @param context - Identifiers for associating safety events.
 * @returns InputSafetyResult with redacted text, safety flag, and SafetyEventCreate list.
 */
export function checkInputSafety(
  input: string,
  context: { studentId: string; sessionId: string; turnId: string }
): InputSafetyResult {
  try {
    const original = typeof input === 'string' ? input : '';

    const { redacted, hasPII } = redactPII(original);
    const isJailbreak = detectJailbreak(original);

    const events: SafetyEventCreate[] = [];

    if (hasPII) {
      const piiEvent: SafetyEventCreate = {
        triggerType: 'PII',
        severity: 'LOW',
        studentId: context.studentId,
        sessionId: context.sessionId,
        turnId: context.turnId,
        // No raw PII stored; resolution/resolvedAt left null.
      };
      events.push(piiEvent);
    }

    if (isJailbreak) {
      const jbEvent: SafetyEventCreate = {
        triggerType: 'JAILBREAK',
        severity: 'HIGH',
        studentId: context.studentId,
        sessionId: context.sessionId,
        turnId: context.turnId,
      };
      events.push(jbEvent);
    }

    const safe = !isJailbreak;

    return {
      safe,
      redacted,
      events,
    };
  } catch {
    // Defensive fallback: treat as safe but with original text and no events
    return {
      safe: true,
      redacted: typeof input === 'string' ? input : '',
      events: [],
    };
  }
}
