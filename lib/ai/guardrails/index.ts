/**
 * FILE OBJECTIVE:
 * - Barrel export for AI guardrails module.
 * - Single entry point for all guardrail-related imports.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/guardrails/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created barrel export for guardrails
 */

// ============================================================================
// INTENT CLASSIFIER
// ============================================================================
export {
  StudentIntentCategory,
  InterventionType,
  type IntentClassification,
  classifyIntent,
  isSafeInput,
  getMatchedPatternsForIntent,
} from './intentClassifier';

// ============================================================================
// PROMPT REWRITER
// ============================================================================
export {
  RewriteStrategy,
  type RewriteContext,
  type RewriteResult,
  processPrompt,
  needsRewrite,
  getRewriteStrategy,
} from './promptRewriter';

// ============================================================================
// HALLUCINATION DETECTOR
// ============================================================================
export {
  HallucinationIssueType,
  type HallucinationCheck,
  type HallucinationIssue,
  type HallucinationContext,
  checkForHallucinations,
  isContentSafe,
  isOnTopic,
  estimateConfidence,
} from './hallucinationDetector';

// ============================================================================
// SAFE RESPONSES
// ============================================================================
export {
  SafeResponseCategory,
  type SafeResponse,
  getOffTopicResponse,
  getUnsafeContentResponse,
  getHomeworkRedirectResponse,
  getTechnicalErrorResponse,
  getUncertaintyResponse,
  getEncouragementResponse,
  getSafeResponseForIntent,
  formatResponseForStudent,
  formatResponseWithSuggestions,
} from './safeResponses';
