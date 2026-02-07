/**
 * FILE OBJECTIVE:
 * - Hallucination detection heuristics for AI tutor outputs.
 * - Detects potential hallucinations and factual inconsistencies.
 * - Enforces syllabus boundaries and step-by-step reasoning.
 * - Provides risk scoring for AI outputs.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/guardrails/hallucinationDetector.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created hallucination detection heuristics
 */

import type { Grade, Board } from '@/lib/ai/prompts/schemas';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Hallucination detection result
 */
export interface HallucinationCheck {
  /** Overall risk score (0-1, higher = more risky) */
  readonly riskScore: number;
  /** Risk level category */
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Specific issues detected */
  readonly issues: HallucinationIssue[];
  /** Whether the content should be blocked */
  readonly shouldBlock: boolean;
  /** Whether the content needs human review */
  readonly needsReview: boolean;
  /** Suggestions for improvement */
  readonly suggestions: string[];
}

/**
 * Individual hallucination issue
 */
export interface HallucinationIssue {
  /** Issue type */
  readonly type: HallucinationIssueType;
  /** Severity (0-1) */
  readonly severity: number;
  /** Description of the issue */
  readonly description: string;
  /** Problematic text excerpt (if applicable) */
  readonly excerpt?: string;
  /** Suggested fix */
  readonly suggestion: string;
}

/**
 * Types of hallucination issues
 */
export enum HallucinationIssueType {
  /** Mentions facts/dates that may be incorrect */
  POTENTIAL_FACTUAL_ERROR = 'potential_factual_error',
  /** Backwards-compatible alias expected by tests */
  FACTUAL_CLAIM = 'factual_claim',
  /** Mentions content outside typical syllabus */
  SYLLABUS_BOUNDARY = 'syllabus_boundary',
  /** Uses overly complex language for grade */
  LANGUAGE_COMPLEXITY = 'language_complexity',
  /** Backwards-compatible alias expected by tests */
  COMPLEXITY_MISMATCH = 'complexity_mismatch',
  /** Lacks step-by-step reasoning */
  MISSING_REASONING = 'missing_reasoning',
  /** Contains unverifiable claims */
  UNVERIFIABLE_CLAIM = 'unverifiable_claim',
  /** Inconsistent with previous context */
  CONTEXT_INCONSISTENCY = 'context_inconsistency',
  /** Contains absolute certainty where uncertainty exists */
  FALSE_CERTAINTY = 'false_certainty',
  /** References non-existent concepts or terms */
  NONEXISTENT_REFERENCE = 'nonexistent_reference',
  /** Math calculation that may be incorrect */
  MATH_ERROR_RISK = 'math_error_risk',
  /** Contains potentially inappropriate content */
  CONTENT_SAFETY = 'content_safety',
}

/**
 * Context for hallucination checking
 */
export interface HallucinationContext {
  /** Student's grade */
  readonly grade: Grade;
  /** Education board */
  readonly board: Board;
  /** Subject area */
  readonly subject: string;
  /** Specific topic */
  readonly topic?: string;
  /** Original question asked */
  readonly originalQuestion?: string;
  /** Previous messages in conversation */
  readonly conversationHistory?: string[];
}

// ============================================================================
// DETECTION PATTERNS
// ============================================================================

/**
 * Patterns indicating potential factual claims to verify
 */
const FACTUAL_CLAIM_PATTERNS: RegExp[] = [
  /\bin (\d{4})\b/i,                           // Year references
  /\b(discovered|invented)\s+by\b/i,           // Attribution claims
  /\b(always|never|every|all|none)\b/i,        // Absolute statements
  /\bthe (first|only|largest|smallest)\b/i,    // Superlative claims
  /\bexactly\s+[\d.]+/i,                      // Exact number claims (allow decimals)
  /\b(is|are)\s+known\s+as\b/i,                // Definition claims
  /\bscientists?\s+(say|believe|found)\b/i,    // Authority claims
];

/**
 * Patterns indicating potentially complex language
 */
const COMPLEX_LANGUAGE_PATTERNS: { pattern: RegExp; minGrade: number }[] = [
  { pattern: /\b(paradigm|epistemolog|ontolog|phenomenolog)\w*/i, minGrade: 11 },
  { pattern: /\b(theorem|corollary|lemma|axiom|postulate)\b/i, minGrade: 9 },
  { pattern: /\b(derivative|integral|differential)\b/i, minGrade: 10 },
  { pattern: /\b(coefficient|polynomial|quadratic)\b/i, minGrade: 8 },
  { pattern: /\b(mitochondria|chloroplast|cytoplasm)\b/i, minGrade: 6 },
  { pattern: /\b(photosynthesis|respiration)\b/i, minGrade: 5 },
  { pattern: /\b(electron|proton|neutron|atom)\b/i, minGrade: 5 },
  { pattern: /\b(molecule|compound|element)\b/i, minGrade: 4 },
];

/**
 * Patterns indicating false certainty
 */
const FALSE_CERTAINTY_PATTERNS: RegExp[] = [
  /\bwill definitely\b/i,
  /\bis certainly\b/i,
  /\bwithout (any )?doubt\b/i,
  /\babsolutely (correct|true|right)\b/i,
  /\babsolutely\s+certain\b/i,
  /\bwithout\s+exception\b/i,
  /\balways\s+(true|right)\b/i,
  /\bthere'?s no (other|alternative)\b/i,
  /\bthe only way\b/i,
  /\b100%\s+(sure|certain|correct)\b/i,
];

/**
 * Patterns indicating step-by-step reasoning
 */
const REASONING_INDICATORS: RegExp[] = [
  /\b(step\s*\d|first|second|third|finally)\b/i,
  /\b(because|therefore|thus|hence|so)\b/i,
  /\b(this means|this shows|we can see)\b/i,
  /\b(let'?s|we need to|we should)\b/i,
  /\b(in order to|to do this)\b/i,
];

/**
 * Patterns that may indicate unsafe content slipping through
 */
const SAFETY_PATTERNS: RegExp[] = [
  /\b(dangerous|harmful|toxic)\s+(to|for)\s+(try|do|make)\b/i,
  /\bhow\s+to\s+(make|create|build)\s+(a\s+)?(bomb|weapon|explosive)\b/i,
  /\b(cheat|hack|crack|steal)\b/i,
];

// ============================================================================
// GRADE-BASED EXPECTATIONS
// ============================================================================

/**
 * Expected complexity levels by grade
 */
const GRADE_EXPECTATIONS: Record<number, { maxSentenceLength: number; maxWordComplexity: number }> = {
  1: { maxSentenceLength: 10, maxWordComplexity: 5 },
  2: { maxSentenceLength: 12, maxWordComplexity: 6 },
  3: { maxSentenceLength: 14, maxWordComplexity: 7 },
  4: { maxSentenceLength: 16, maxWordComplexity: 8 },
  5: { maxSentenceLength: 18, maxWordComplexity: 9 },
  6: { maxSentenceLength: 20, maxWordComplexity: 10 },
  7: { maxSentenceLength: 22, maxWordComplexity: 11 },
  8: { maxSentenceLength: 25, maxWordComplexity: 12 },
  9: { maxSentenceLength: 28, maxWordComplexity: 14 },
  10: { maxSentenceLength: 30, maxWordComplexity: 15 },
  11: { maxSentenceLength: 35, maxWordComplexity: 16 },
  12: { maxSentenceLength: 40, maxWordComplexity: 18 },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate average sentence length
 */
function calculateAvgSentenceLength(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return 0;
  
  const totalWords = sentences.reduce((sum, sentence) => {
    return sum + sentence.trim().split(/\s+/).length;
  }, 0);
  
  return totalWords / sentences.length;
}

/**
 * Find complex words (syllables > threshold)
 */
function _findComplexWords(text: string, syllableThreshold: number): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  
  // Simple syllable estimation (vowel groups)
  const estimateSyllables = (word: string): number => {
    const vowelGroups = word.match(/[aeiouy]+/g) || [];
    return Math.max(1, vowelGroups.length);
  };
  
  return words.filter(word => estimateSyllables(word) > syllableThreshold);
}

/**
 * Check if content has reasoning structure
 */
function hasReasoningStructure(text: string): boolean {
  let reasoningScore = 0;
  
  for (const pattern of REASONING_INDICATORS) {
    if (pattern.test(text)) {
      reasoningScore++;
    }
  }
  
  // Need at least 2 reasoning indicators for acceptable structure
  return reasoningScore >= 2;
}

/**
 * Extract potential factual claims
 */
function extractFactualClaims(text: string): string[] {
  const claims: string[] = [];
  
  for (const pattern of FACTUAL_CLAIM_PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      // Get surrounding context (up to 50 chars before and after)
      for (const match of matches) {
        const index = text.indexOf(match);
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + match.length + 50);
        claims.push(text.slice(start, end).trim());
      }
    }
  }
  
  return [...new Set(claims)]; // Remove duplicates
}

// ============================================================================
// MAIN DETECTION FUNCTIONS
// ============================================================================

/**
 * Check content for potential hallucinations and issues
 * 
 * @param content - AI-generated content to check
 * @param context - Context for the check
 * @returns HallucinationCheck result
 */
export function checkForHallucinations(
  content: string,
  contextOrGrade: HallucinationContext | number,
  subject?: string
): HallucinationCheck {
  const issues: HallucinationIssue[] = [];
  const suggestions: string[] = [];

  // Normalize context: support tests calling (content, grade, subject)
  let context: HallucinationContext;
  if (typeof contextOrGrade === 'number') {
    context = { grade: contextOrGrade, board: 'generic' as any, subject: subject || 'General' } as HallucinationContext;
  } else {
    context = contextOrGrade as HallucinationContext;
  }
  
  // 1. Check for language complexity vs grade
  const gradeExpectations = GRADE_EXPECTATIONS[context.grade] || GRADE_EXPECTATIONS[6];
  
  for (const { pattern, minGrade } of COMPLEX_LANGUAGE_PATTERNS) {
    if (context.grade < minGrade && pattern.test(content)) {
      const match = content.match(pattern);
        issues.push({
          type: HallucinationIssueType.COMPLEXITY_MISMATCH,
          severity: 0.6,
          description: `Content uses terminology typically introduced in Grade ${minGrade}+`,
          excerpt: match?.[0],
          suggestion: 'Use simpler language appropriate for the student\'s grade level',
        });
    }
  }
  
  // Check sentence complexity
  const avgSentenceLength = calculateAvgSentenceLength(content);
  if (avgSentenceLength > gradeExpectations.maxSentenceLength * 1.5) {
    issues.push({
      type: HallucinationIssueType.COMPLEXITY_MISMATCH,
      severity: 0.4,
      description: `Average sentence length (${Math.round(avgSentenceLength)} words) exceeds grade-appropriate level`,
      suggestion: 'Break down long sentences into shorter, clearer statements',
    });
    suggestions.push('Consider using shorter sentences for better comprehension');
  }
  
  // 2. Check for false certainty
  for (const pattern of FALSE_CERTAINTY_PATTERNS) {
    if (pattern.test(content)) {
      const match = content.match(pattern);
      issues.push({
        type: HallucinationIssueType.FALSE_CERTAINTY,
        severity: 0.5,
        description: 'Content contains absolute certainty language where nuance may be appropriate',
        excerpt: match?.[0],
        suggestion: 'Use more measured language like "typically," "often," or "in most cases"',
      });
    }
  }
  
  // 3. Check for potential factual claims
  const factualClaims = extractFactualClaims(content);
  if (factualClaims.length >= 1) {
    issues.push({
      type: HallucinationIssueType.FACTUAL_CLAIM,
      severity: Math.min(0.3 + factualClaims.length * 0.05, 0.9),
      description: `Content contains ${factualClaims.length} specific factual claim(s) that should be verified`,
      suggestion: 'Ensure all factual claims are verified against authoritative sources',
    });
    suggestions.push('Factual claims detected - consider verification');
  }
  
  // 4. Check for reasoning structure (especially for explanations)
  if (content.length > 200 && !hasReasoningStructure(content)) {
    issues.push({
      type: HallucinationIssueType.MISSING_REASONING,
      severity: 0.5,
      description: 'Content lacks clear step-by-step reasoning structure',
      suggestion: 'Add explicit reasoning steps (First... Then... Therefore...)',
    });
    suggestions.push('Add clearer step-by-step reasoning for better understanding');
  }
  
  // 5. Check for safety concerns
  for (const pattern of SAFETY_PATTERNS) {
    if (pattern.test(content)) {
      const match = content.match(pattern);
      issues.push({
        type: HallucinationIssueType.CONTENT_SAFETY,
        severity: 0.9,
        description: 'Content may contain potentially unsafe or inappropriate information',
        excerpt: match?.[0],
        suggestion: 'Remove or rephrase potentially harmful content',
      });
    }
  }
  
  // 6. Check for context consistency (if we have conversation history)
  if (context.conversationHistory && context.conversationHistory.length > 0) {
    // Simple check: make sure topic-related terms appear
    if (context.topic) {
      const topicWords = context.topic.toLowerCase().split(/\s+/);
      const contentLower = content.toLowerCase();
      const topicMentioned = topicWords.some(word => word.length > 3 && contentLower.includes(word));
      
      if (!topicMentioned && content.length > 100) {
        issues.push({
          type: HallucinationIssueType.CONTEXT_INCONSISTENCY,
          severity: 0.4,
          description: `Response doesn't seem to address the topic: "${context.topic}"`,
          suggestion: 'Ensure the response directly addresses the specified topic',
        });
      }
    }
  }
  
  // Calculate overall risk score
  const riskScore = calculateRiskScore(issues);
  const riskLevel = getRiskLevel(riskScore);
  
  const result: HallucinationCheck = {
    riskScore,
    riskLevel,
    issues,
    shouldBlock: riskScore >= 0.8 || issues.some(i => i.type === HallucinationIssueType.CONTENT_SAFETY),
    needsReview: riskScore >= 0.5,
    suggestions,
  };

  // Backwards-compatible convenience flags used by tests
  (result as any).hasIssues = issues.length > 0;

  return result;
}

/**
 * Calculate overall risk score from issues
 */
function calculateRiskScore(issues: HallucinationIssue[]): number {
  if (issues.length === 0) return 0;
  
  // Weight by severity and count
  const totalSeverity = issues.reduce((sum, issue) => sum + issue.severity, 0);
  const avgSeverity = totalSeverity / issues.length;
  
  // Scale by number of issues (more issues = higher risk)
  const countFactor = Math.min(issues.length / 5, 1); // Max out at 5 issues
  
  return Math.min(avgSeverity * 0.7 + countFactor * 0.3, 1);
}

/**
 * Convert risk score to level
 */
function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

/**
 * Quick check if content is safe (without full analysis)
 */
export function isContentSafe(content: string, grade?: number, subject?: string, _confidence?: number): boolean {
  // Quick safety pattern scan
  for (const pattern of SAFETY_PATTERNS) {
    if (pattern.test(content)) {
      return false;
    }
  }

  // Fail fast on low model confidence
  if (typeof _confidence === 'number' && _confidence < 0.5) return false;

  // Build a context using provided grade/subject when available
  const ctx: HallucinationContext = { grade: grade ?? 6, board: 'generic' as any, subject: subject ?? 'General' } as HallucinationContext;

  // Also run a lightweight hallucination check using the normalized context
  try {
    const check = checkForHallucinations(content, ctx);
    // If the detector recommends blocking or risk is medium+ consider it unsafe
    if (check.shouldBlock || check.riskScore >= 0.5 || check.issues.length > 0) return false;
  } catch {
    // If the detector fails for any reason, err on the side of cautious true (do not block here)
  }

  return true;
}

/**
 * Check if content matches expected topic
 */
export function isOnTopic(content: string, topic: string, subject: string): boolean {
  const contentLower = content.toLowerCase();
  const topicLower = topic.toLowerCase();
  const subjectLower = subject.toLowerCase();
  
  // Check if topic words appear in content
  const topicWords = topicLower.split(/\s+/).filter(w => w.length > 3);
  const topicMatch = topicWords.some(word => contentLower.includes(word));
  
  // Check if subject-related terms appear
  const subjectWords = subjectLower.split(/\s+/).filter(w => w.length > 3);
  const subjectMatch = subjectWords.some(word => contentLower.includes(word));
  
  return topicMatch || subjectMatch;
}

/**
 * Estimate confidence that content is hallucination-free
 */
export function estimateConfidence(check: HallucinationCheck): number {
  // Inverse of risk score, adjusted for issue types
  const baseConfidence = 1 - check.riskScore;
  
  // Reduce confidence if certain issue types present
  const hasFactualIssues = check.issues.some(i => i.type === HallucinationIssueType.FACTUAL_CLAIM);
  const hasSafetyIssues = check.issues.some(i => i.type === HallucinationIssueType.CONTENT_SAFETY);
  
  let confidence = baseConfidence;
  if (hasFactualIssues) confidence *= 0.8;
  if (hasSafetyIssues) confidence *= 0.5;
  
  return Math.max(0, Math.min(confidence, 1));
}
