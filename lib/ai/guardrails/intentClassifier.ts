/**
 * FILE OBJECTIVE:
 * - Intent classification engine for student-facing AI tutor.
 * - Rule-based classifier to detect student intent without ML.
 * - Classifies: conceptual, shortcut-seeking, homework-dump, off-topic, unsafe.
 * - Fully auditable and testable.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/guardrails/intentClassifier.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created rule-based intent classifier
 */

// ============================================================================
// TYPES & ENUMS
// ============================================================================

/**
 * Student intent categories
 */
export enum StudentIntentCategory {
  /** Genuine conceptual question seeking understanding */
  CONCEPTUAL = 'conceptual',
  /** Seeking shortcuts or direct answers */
  SHORTCUT_SEEKING = 'shortcut_seeking',
  /** Dumping homework for AI to solve */
  HOMEWORK_DUMP = 'homework_dump',
  /** Off-topic or unrelated to education */
  OFF_TOPIC = 'off_topic',
  /** Unsafe or inappropriate content */
  UNSAFE = 'unsafe',
  /** Asking for examples or demonstrations */
  EXAMPLE_REQUEST = 'example_request',
  /** Seeking clarification or follow-up */
  CLARIFICATION = 'clarification',
  /** Revision or recap request */
  REVISION = 'revision',
}

/**
 * Intent classification result
 */
export interface IntentClassification {
  /** Primary detected intent */
  readonly primaryIntent: StudentIntentCategory;
  /** Backwards-compatible alias for tests: category */
  readonly category: StudentIntentCategory;
  /** Confidence score (0-1) */
  readonly confidence: number;
  /** Secondary intents detected (if any) */
  readonly secondaryIntents: StudentIntentCategory[];
  /** Matched patterns for audit */
  readonly matchedPatterns: string[];
  /** Whether the intent requires intervention */
  readonly requiresIntervention: boolean;
  /** Intervention type if needed */
  readonly interventionType: InterventionType | null;
  /** Backwards-compatible alias for tests: intervention */
  readonly intervention: InterventionType | null;
  /** Risk level for logging */
  readonly riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Types of intervention needed
 */
export enum InterventionType {
  /** Rewrite the prompt silently */
  REWRITE = 'rewrite',
  /** Block and redirect */
  BLOCK = 'block',
  /** Redirect the user to curriculum-focused flow */
  REDIRECT = 'redirect',
  /** Log and monitor */
  MONITOR = 'monitor',
  /** No intervention needed */
  NONE = 'none',
}

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

/**
 * Pattern rule for intent detection
 */
interface PatternRule {
  /** Pattern name for auditing */
  name: string;
  /** Regex patterns to match */
  patterns: RegExp[];
  /** Intent this pattern indicates */
  intent: StudentIntentCategory;
  /** Confidence boost when matched (0-1) */
  confidenceBoost: number;
  /** Requires this pattern for classification */
  required?: boolean;
}

/**
 * Shortcut-seeking patterns
 * These indicate the student wants direct answers without learning
 */
const SHORTCUT_PATTERNS: PatternRule[] = [
  {
    name: 'direct_answer_request',
    patterns: [
      /\b(just\s+)?(give|tell)\s+(me\s+)?(the\s+)?answer\b/i,
      /\bjust\s+tell\s+me\b/i,
      /\bjust\s+tell\s+me\s+what\b/i,
      /\bwhat\s+is\s+the\s+(final\s+)?answer\b/i,
      /\bjust\s+answer\b/i,
      /\bquick(ly)?\s+answer\b/i,
    ],
    intent: StudentIntentCategory.SHORTCUT_SEEKING,
    confidenceBoost: 0.8,
  },
  {
    name: 'skip_explanation',
    patterns: [
      /\b(don'?t|no)\s+(need\s+)?(to\s+)?explain\b/i,
      /\bskip\s+(the\s+)?explanation\b/i,
      /\bwithout\s+explanation\b/i,
      /\bjust\s+the\s+(solution|result)\b/i,
    ],
    intent: StudentIntentCategory.SHORTCUT_SEEKING,
    confidenceBoost: 0.7,
  },
  {
    name: 'solve_for_me',
    patterns: [
      /\bsolve\s+(this|it)\s+for\s+me\b/i,
      /\bdo\s+(this|it)\s+for\s+me\b/i,
      /\bfinish\s+(this|it)\s+for\s+me\b/i,
    ],
    intent: StudentIntentCategory.SHORTCUT_SEEKING,
    confidenceBoost: 0.75,
  },
];

/**
 * Homework dump patterns
 * Indicating bulk homework submission
 */
const HOMEWORK_DUMP_PATTERNS: PatternRule[] = [
  {
    name: 'homework_mention',
    patterns: [
      /\b(my\s+)?homework\b/i,
      /\b(my\s+)?assignment\b/i,
      /\bdue\s+(tomorrow|today|tonight)\b/i,
      /\bsubmit\s+(by|before)\b/i,
    ],
    intent: StudentIntentCategory.HOMEWORK_DUMP,
    confidenceBoost: 0.5,
  },
  {
    name: 'bulk_questions',
    patterns: [
      /\b(all\s+)?(these|those)\s+questions\b/i,
      /\bquestion\s*\d+\s*[-:]\s*/i,
      /\bq\s*\d+\s*[-:.]/i,
      /\b(solve|answer)\s+(all|these|everything)\b/i,
      /\d+\)/, // Matches numbered items like "1)" anywhere
      /solve\s*:/i, // Matches patterns like "Solve: 1) ..."
    ],
    intent: StudentIntentCategory.HOMEWORK_DUMP,
    confidenceBoost: 0.6,
  },
  {
    name: 'copy_paste_indicators',
    patterns: [
      /^\s*\d+[.)]\s+/m, // Numbered list format
      /\b(marks?|points?)\s*[:=]?\s*\d+/i, // Marks mentioned
      /\bexam\s+(paper|question)\b/i,
    ],
    intent: StudentIntentCategory.HOMEWORK_DUMP,
    confidenceBoost: 0.5,
  },
];

/**
 * Off-topic patterns
 * Not related to educational content
 */
const OFF_TOPIC_PATTERNS: PatternRule[] = [
  {
    name: 'personal_questions',
    patterns: [
      /\b(are\s+you|what\s+are\s+you)\s+(real|human|ai|robot|alive)\b/i,
      /\b(who|what)\s+(made|created)\s+you\b/i,
      /\byour\s+(name|age|feelings)\b/i,
      /\bdo\s+you\s+(like|love|hate|feel)\b/i,
    ],
    intent: StudentIntentCategory.OFF_TOPIC,
    confidenceBoost: 0.7,
  },
  {
    name: 'entertainment',
    patterns: [
      /\btell\s+(me\s+)?(a\s+)?joke\b/i,
      /\btell\s+(me\s+)?(a\s+)?story\b/i,
      /\bplay\s+(a\s+)?game\b/i,
      /\bsing\s+(a\s+)?song\b/i,
      /\bfavorite\s+(movie|song|game|food)\b/i,
    ],
    intent: StudentIntentCategory.OFF_TOPIC,
    confidenceBoost: 0.8,
  },
  {
    name: 'unrelated_topics',
    patterns: [
      /\b(weather|sports|politics|news|celebrity)\b/i,
      /\b(girlfriend|boyfriend|dating|relationship)\b/i,
      /\b(money|bitcoin|crypto|stocks|invest)\b/i,
    ],
    intent: StudentIntentCategory.OFF_TOPIC,
    confidenceBoost: 0.75,
  },
];

/**
 * Unsafe content patterns
 * Potentially harmful or inappropriate
 */
const UNSAFE_PATTERNS: PatternRule[] = [
  {
    name: 'violence',
    patterns: [
      /\b(kill|murder|hurt|harm|attack|fight|weapon)\b/i,
      /\b(bomb|explosive|gun|knife)\b/i,
      /\b(dangerous)\b/i, // standalone "dangerous" indicates unsafe intent
    ],
    intent: StudentIntentCategory.UNSAFE,
    confidenceBoost: 0.9,
  },
  {
    name: 'inappropriate',
    patterns: [
      /\b(sex|porn|nude|naked|drug|alcohol|smoke|vape)\b/i,
      /\b(suicide|self-?harm|cut\s+myself)\b/i,
    ],
    intent: StudentIntentCategory.UNSAFE,
    confidenceBoost: 0.95,
  },
  {
    name: 'hate_speech',
    patterns: [
      /\b(hate|stupid|dumb|idiot|loser)\s+(you|people|everyone)\b/i,
      /\b(racist|sexist)\b/i,
    ],
    intent: StudentIntentCategory.UNSAFE,
    confidenceBoost: 0.85,
  },
  {
    name: 'personal_info_fishing',
    patterns: [
      /\b(password|credit\s*card|bank\s*account|social\s*security)\b/i,
      /\b(phone\s*number|address|email)\s+(is|of)\b/i,
    ],
    intent: StudentIntentCategory.UNSAFE,
    confidenceBoost: 0.9,
  },
];

/**
 * Conceptual question patterns
 * Genuine learning intent
 */
const CONCEPTUAL_PATTERNS: PatternRule[] = [
  {
    name: 'understanding_request',
    patterns: [
      /\b(explain|understand|meaning|concept|what\s+is|how\s+does)\b/i,
      /\bwhy\s+(is|does|do|are|did)\b/i,
      /\bhow\s+(to|can|do\s+I)\b/i,
      /\bwhat\s+(happens|is\s+the\s+difference)\b/i,
    ],
    intent: StudentIntentCategory.CONCEPTUAL,
    confidenceBoost: 0.6,
  },
  {
    name: 'learning_language',
    patterns: [
      /\b(help\s+me\s+)?understand\b/i,
      /\b(can\s+you\s+)?teach\b/i,
      /\b(i\s+)?don'?t\s+understand\b/i,
      /\bi'?m\s+(confused|stuck|struggling)\b/i,
    ],
    intent: StudentIntentCategory.CONCEPTUAL,
    confidenceBoost: 0.7,
  },
];

/**
 * Example request patterns
 */
const EXAMPLE_PATTERNS: PatternRule[] = [
  {
    name: 'example_request',
    patterns: [
      /\b(give|show|provide)\s+(me\s+)?(an?\s+)?example\b/i,
      /\bfor\s+example\b/i,
      /\b(like|such\s+as)\s+what\b/i,
      /\breal[\s-]?(life|world)\s+example\b/i,
    ],
    intent: StudentIntentCategory.EXAMPLE_REQUEST,
    confidenceBoost: 0.7,
  },
];

/**
 * Clarification patterns
 */
const CLARIFICATION_PATTERNS: PatternRule[] = [
  {
    name: 'follow_up',
    patterns: [
      /\b(what\s+do\s+you\s+mean|could\s+you\s+clarify)\b/i,
      /\bi\s+(still\s+)?don'?t\s+(get|understand)\b/i,
      /\b(explain|elaborate)\s+(more|further|again)\b/i,
      /\b(can\s+you\s+)?repeat\b/i,
    ],
    intent: StudentIntentCategory.CLARIFICATION,
    confidenceBoost: 0.75,
  },
];

/**
 * Revision patterns
 */
const REVISION_PATTERNS: PatternRule[] = [
  {
    name: 'revision_request',
    patterns: [
      /\b(revise|review|recap|summary|summarize)\b/i,
      /\bkey\s+points\b/i,
      /\bquick\s+revision\b/i,
      /\b(before\s+)?exam\s+(prep|preparation)\b/i,
    ],
    intent: StudentIntentCategory.REVISION,
    confidenceBoost: 0.7,
  },
];

// ============================================================================
// CLASSIFICATION ENGINE
// ============================================================================

/**
 * All pattern rules organized by category
 */
const ALL_PATTERN_RULES: PatternRule[] = [
  ...UNSAFE_PATTERNS,      // Check unsafe first (highest priority)
  ...OFF_TOPIC_PATTERNS,
  ...SHORTCUT_PATTERNS,
  ...HOMEWORK_DUMP_PATTERNS,
  ...CONCEPTUAL_PATTERNS,
  ...EXAMPLE_PATTERNS,
  ...CLARIFICATION_PATTERNS,
  ...REVISION_PATTERNS,
];

/**
 * Classify student input intent
 * 
 * @param input - Raw student input text
 * @param context - Optional context (previous messages, subject, etc.)
 * @returns IntentClassification result
 */
export function classifyIntent(
  input: string,
  // Accept either grade number or context object (backwards-compatible with tests)
  _gradeOrContext?: number | { subject?: string; previousIntents?: StudentIntentCategory[] },
  _subjectArg?: string
): IntentClassification {
  const normalizedInput = input.toLowerCase().trim();
  const matchedPatterns: string[] = [];
  const intentScores: Map<StudentIntentCategory, number> = new Map();
  
  // Initialize all intents with base score
  Object.values(StudentIntentCategory).forEach(intent => {
    intentScores.set(intent, 0);
  });

  // Check all pattern rules
  for (const rule of ALL_PATTERN_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalizedInput)) {
        matchedPatterns.push(rule.name);
        const currentScore = intentScores.get(rule.intent) || 0;
        intentScores.set(rule.intent, currentScore + rule.confidenceBoost);
        break; // Only count each rule once
      }
    }
  }

  // Find primary intent (highest score)
  let primaryIntent = StudentIntentCategory.CONCEPTUAL; // Default
  let maxScore = 0;
  
  intentScores.forEach((score, intent) => {
    if (score > maxScore) {
      maxScore = score;
      primaryIntent = intent;
    }
  });

  // Heuristic overrides: give precedence to high-confidence patterns
  const homeworkPatternNames = new Set(HOMEWORK_DUMP_PATTERNS.map(r => r.name));
  const offTopicPatternNames = new Set(OFF_TOPIC_PATTERNS.map(r => r.name));
  const unsafePatternNames = new Set(UNSAFE_PATTERNS.map(r => r.name));

  if (matchedPatterns.some(n => homeworkPatternNames.has(n))) {
    primaryIntent = StudentIntentCategory.HOMEWORK_DUMP;
    maxScore = Math.max(maxScore, 10);
  }

  if (matchedPatterns.some(n => offTopicPatternNames.has(n))) {
    primaryIntent = StudentIntentCategory.OFF_TOPIC;
    maxScore = Math.max(maxScore, 10);
  }

  if (matchedPatterns.some(n => unsafePatternNames.has(n))) {
    primaryIntent = StudentIntentCategory.UNSAFE;
    maxScore = Math.max(maxScore, 10);
  }

  // Find secondary intents (any with significant score)
  const secondaryIntents: StudentIntentCategory[] = [];
  const secondaryThreshold = 0.4;
  
  intentScores.forEach((score, intent) => {
    if (intent !== primaryIntent && score >= secondaryThreshold) {
      secondaryIntents.push(intent);
    }
  });

  // Calculate confidence
  const confidence = Math.min(maxScore / 1.5, 1); // Normalize to 0-1

  // Determine intervention
  const { requiresIntervention, interventionType, riskLevel } = determineIntervention(
    primaryIntent,
    secondaryIntents,
    confidence
  );

  // Provide backwards-compatible aliases expected by tests
  return {
    primaryIntent,
    category: primaryIntent,
    confidence,
    secondaryIntents,
    matchedPatterns,
    requiresIntervention,
    interventionType,
    intervention: interventionType,
    riskLevel,
  };
}

/**
 * Determine if and what intervention is needed
 */
function determineIntervention(
  primaryIntent: StudentIntentCategory,
  secondaryIntents: StudentIntentCategory[],
  _confidence: number
): { requiresIntervention: boolean; interventionType: InterventionType | null; riskLevel: 'low' | 'medium' | 'high' } {
  // Unsafe content always requires blocking
  if (primaryIntent === StudentIntentCategory.UNSAFE) {
    return {
      requiresIntervention: true,
      interventionType: InterventionType.BLOCK,
      riskLevel: 'high',
    };
  }

  // Off-topic requires blocking with redirection
  if (primaryIntent === StudentIntentCategory.OFF_TOPIC) {
    return {
      requiresIntervention: true,
      interventionType: InterventionType.REDIRECT,
      riskLevel: 'medium',
    };
  }

  // Shortcut-seeking requires silent rewrite
  if (primaryIntent === StudentIntentCategory.SHORTCUT_SEEKING) {
    return {
      requiresIntervention: true,
      interventionType: InterventionType.REWRITE,
      riskLevel: 'low',
    };
  }

  // Homework dump requires rewrite to encourage learning
  if (primaryIntent === StudentIntentCategory.HOMEWORK_DUMP) {
    return {
      requiresIntervention: true,
      interventionType: InterventionType.REDIRECT,
      riskLevel: 'low',
    };
  }

  // Check if secondary intents include risky ones
  if (secondaryIntents.includes(StudentIntentCategory.UNSAFE)) {
    return {
      requiresIntervention: true,
      interventionType: InterventionType.MONITOR,
      riskLevel: 'medium',
    };
  }

  // Legitimate intents - no intervention
  return {
    requiresIntervention: false,
    interventionType: InterventionType.NONE,
    riskLevel: 'low',
  };
}

/**
 * Check if input is safe for processing
 * Quick check without full classification
 */
export function isSafeInput(input: string): boolean {
  const normalizedInput = input.toLowerCase();
  
  for (const rule of UNSAFE_PATTERNS) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalizedInput)) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Get patterns that matched for a specific intent
 * Useful for debugging and auditing
 */
export function getMatchedPatternsForIntent(
  input: string,
  intent: StudentIntentCategory
): string[] {
  const normalizedInput = input.toLowerCase();
  const matchedPatterns: string[] = [];
  
  for (const rule of ALL_PATTERN_RULES) {
    if (rule.intent !== intent) continue;
    
    for (const pattern of rule.patterns) {
      if (pattern.test(normalizedInput)) {
        matchedPatterns.push(rule.name);
        break;
      }
    }
  }
  
  return matchedPatterns;
}
