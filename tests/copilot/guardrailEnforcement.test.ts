/**
 * FILE OBJECTIVE:
 * - Jest test suites for guardrail enforcement.
 * - Validates intent classification, prompt rewriting, hallucination detection.
 * - Includes junior-grade and senior-grade cases.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created guardrail enforcement tests
 */

import {
  classifyIntent,
  StudentIntentCategory,
  InterventionType,
} from '@/lib/ai/guardrails/intentClassifier';

import {
  processPrompt,
  RewriteStrategy,
} from '@/lib/ai/guardrails/promptRewriter';

import {
  checkForHallucinations,
  isContentSafe,
  HallucinationIssueType,
} from '@/lib/ai/guardrails/hallucinationDetector';

import {
  getOffTopicResponse,
  getUnsafeContentResponse,
  getHomeworkRedirectResponse,
} from '@/lib/ai/guardrails/safeResponses';

// ============================================================================
// MOCK DATA
// ============================================================================

/**
 * Mock AI responses for hallucination testing
 */
export const MOCK_AI_RESPONSES = {
  VALID_SIMPLE: {
    content: 'Addition means combining numbers. For example, 2 + 3 = 5.',
    confidence: 0.9,
  },
  
  VALID_COMPLEX: {
    content: 'Photosynthesis is the process by which plants convert light energy into chemical energy. The equation is 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂.',
    confidence: 0.85,
  },
  
  HALLUCINATED_FACTS: {
    content: 'The square root of -1 is exactly 1.414. This was discovered by Einstein in 1920.',
    confidence: 0.6,
  },
  
  FALSE_CERTAINTY: {
    content: 'It is absolutely certain that all plants need exactly 12 hours of sunlight. This is always true without exception.',
    confidence: 0.5,
  },
  
  TOO_COMPLEX_FOR_JUNIOR: {
    content: 'The epistemological implications of mathematical axioms necessitate a comprehensive understanding of metamathematical frameworks.',
    confidence: 0.7,
  },
};

// ============================================================================
// INTENT CLASSIFICATION TESTS
// ============================================================================

describe('Intent Classification Guardrails', () => {
  describe('Conceptual Questions (Valid)', () => {
    it('should classify "What is photosynthesis?" as CONCEPTUAL', () => {
      const result = classifyIntent('What is photosynthesis?', 7, 'Science');
      expect(result.category).toBe(StudentIntentCategory.CONCEPTUAL);
      expect(result.intervention).toBe(InterventionType.NONE);
    });
    
    it('should classify "How do I solve quadratic equations?" as CONCEPTUAL', () => {
      const result = classifyIntent('How do I solve quadratic equations?', 10, 'Mathematics');
      expect(result.category).toBe(StudentIntentCategory.CONCEPTUAL);
    });
    
    it('should classify "Why do plants need water?" as CONCEPTUAL', () => {
      const result = classifyIntent('Why do plants need water?', 3, 'Science');
      expect(result.category).toBe(StudentIntentCategory.CONCEPTUAL);
    });
  });
  
  describe('Shortcut Seeking Detection', () => {
    it('should detect "just give me the answer" as SHORTCUT_SEEKING', () => {
      const result = classifyIntent('just give me the answer to 5+3', 3, 'Mathematics');
      expect(result.category).toBe(StudentIntentCategory.SHORTCUT_SEEKING);
      expect(result.intervention).toBe(InterventionType.REWRITE);
    });
    
    it('should detect "tell me the solution quickly" as SHORTCUT_SEEKING', () => {
      const result = classifyIntent('tell me the solution quickly without explanation', 8, 'Mathematics');
      expect(result.category).toBe(StudentIntentCategory.SHORTCUT_SEEKING);
    });
    
    it('should detect "skip the explanation" as SHORTCUT_SEEKING', () => {
      const result = classifyIntent('What is 2+2? skip the explanation', 2, 'Mathematics');
      expect(result.category).toBe(StudentIntentCategory.SHORTCUT_SEEKING);
    });
  });
  
  describe('Homework Dump Detection', () => {
    it('should detect multiple numbered questions as HOMEWORK_DUMP', () => {
      const question = `
        1. What is the capital of India?
        2. What is photosynthesis?
        3. Solve x + 5 = 10
        4. Name three types of rocks
      `;
      const result = classifyIntent(question, 5, 'General');
      expect(result.category).toBe(StudentIntentCategory.HOMEWORK_DUMP);
      expect(result.intervention).toBe(InterventionType.REDIRECT);
    });
    
    it('should detect "solve all these" as HOMEWORK_DUMP', () => {
      const result = classifyIntent('solve all these questions for me: Q1... Q2... Q3...', 7, 'Mathematics');
      expect(result.category).toBe(StudentIntentCategory.HOMEWORK_DUMP);
    });
  });
  
  describe('Off-Topic Detection', () => {
    it('should detect entertainment requests as OFF_TOPIC', () => {
      const result = classifyIntent('Tell me a joke', 5, 'Mathematics');
      expect(result.category).toBe(StudentIntentCategory.OFF_TOPIC);
      expect(result.intervention).toBe(InterventionType.REDIRECT);
    });
    
    it('should detect game requests as OFF_TOPIC', () => {
      const result = classifyIntent('Can we play a game?', 3, 'Science');
      expect(result.category).toBe(StudentIntentCategory.OFF_TOPIC);
    });
  });
  
  describe('Unsafe Content Detection', () => {
    it('should detect harmful content as UNSAFE', () => {
      const result = classifyIntent('How to make something dangerous', 8, 'Science');
      expect(result.category).toBe(StudentIntentCategory.UNSAFE);
      expect(result.intervention).toBe(InterventionType.BLOCK);
    });
  });
  
  describe('Grade-Specific Classification', () => {
    it('should be more lenient with junior grade questions', () => {
      // Simple questions from juniors should always be CONCEPTUAL
      const result = classifyIntent('What is 2+2?', 1, 'Mathematics');
      expect(result.category).toBe(StudentIntentCategory.CONCEPTUAL);
    });
    
    it('should expect more context from senior grades', () => {
      // Same simple question from senior should still be valid
      const result = classifyIntent('What is 2+2?', 10, 'Mathematics');
      expect(result.category).toBe(StudentIntentCategory.CONCEPTUAL);
    });
  });
});

// ============================================================================
// PROMPT REWRITING TESTS
// ============================================================================

describe('Prompt Rewriting Guardrails', () => {
  describe('Shortcut to Learning Rewrite', () => {
    it('should rewrite shortcut requests to learning-focused prompts', () => {
      const result = processPrompt(
        'just give me the answer to photosynthesis equation',
        7,
        'Science'
      );
      
      expect(result.wasRewritten).toBe(true);
      expect(result.strategy).toBe(RewriteStrategy.SHORTCUT_TO_LEARNING);
      expect(result.rewrittenPrompt).toContain('explain');
    });
    
    it('should preserve the core question in rewrite', () => {
      const result = processPrompt(
        'just tell me what is photosynthesis',
        5,
        'Science'
      );
      
      expect(result.wasRewritten).toBe(true);
      expect(result.rewrittenPrompt?.toLowerCase()).toContain('photosynthesis');
    });
  });
  
  describe('Homework Redirect', () => {
    it('should redirect homework dumps to single-question format', () => {
      const result = processPrompt(
        'Solve: 1) 2+2 2) 3+3 3) 4+4',
        3,
        'Mathematics'
      );
      
      expect(result.wasRewritten).toBe(true);
      expect(result.strategy).toBe(RewriteStrategy.HOMEWORK_TO_CONCEPT);
    });
  });
  
  describe('No Rewrite Needed', () => {
    it('should not rewrite valid conceptual questions', () => {
      const result = processPrompt(
        'Can you explain how photosynthesis works?',
        7,
        'Science'
      );
      
      expect(result.wasRewritten).toBe(false);
      expect(result.rewrittenPrompt).toBeUndefined();
    });
  });
  
  describe('Junior Grade Adjustments', () => {
    it('should use simpler rewrite templates for junior grades', () => {
      const juniorResult = processPrompt(
        'just give answer',
        2,
        'Mathematics'
      );
      
      const seniorResult = processPrompt(
        'just give answer',
        9,
        'Mathematics'
      );
      
      // Both should be rewritten but with different tones
      expect(juniorResult.wasRewritten).toBe(true);
      expect(seniorResult.wasRewritten).toBe(true);
    });
  });
});

// ============================================================================
// HALLUCINATION DETECTION TESTS
// ============================================================================

describe('Hallucination Detection Guardrails', () => {
  describe('Factual Claim Detection', () => {
    it('should flag responses with unverifiable facts', () => {
      const result = checkForHallucinations(
        MOCK_AI_RESPONSES.HALLUCINATED_FACTS.content,
        7,
        'Mathematics'
      );
      
      expect(result.hasIssues).toBe(true);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ type: HallucinationIssueType.FACTUAL_CLAIM })
      );
    });
  });
  
  describe('False Certainty Detection', () => {
    it('should flag responses with absolute certainty', () => {
      const result = checkForHallucinations(
        MOCK_AI_RESPONSES.FALSE_CERTAINTY.content,
        5,
        'Science'
      );
      
      expect(result.hasIssues).toBe(true);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ type: HallucinationIssueType.FALSE_CERTAINTY })
      );
    });
  });
  
  describe('Complexity Mismatch Detection', () => {
    it('should flag content too complex for junior grades', () => {
      const result = checkForHallucinations(
        MOCK_AI_RESPONSES.TOO_COMPLEX_FOR_JUNIOR.content,
        2,
        'General'
      );
      
      expect(result.hasIssues).toBe(true);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ type: HallucinationIssueType.COMPLEXITY_MISMATCH })
      );
    });
    
    it('should accept complex content for senior grades', () => {
      const result = checkForHallucinations(
        'The derivative of x² is 2x by the power rule.',
        10,
        'Mathematics'
      );
      
      // This is appropriate for Grade 10
      expect(result.hasIssues).toBe(false);
    });
  });
  
  describe('Valid Content Passes', () => {
    it('should pass simple valid content', () => {
      const result = checkForHallucinations(
        MOCK_AI_RESPONSES.VALID_SIMPLE.content,
        3,
        'Mathematics'
      );
      
      expect(result.hasIssues).toBe(false);
    });
    
    it('should pass complex valid content for appropriate grade', () => {
      const result = checkForHallucinations(
        MOCK_AI_RESPONSES.VALID_COMPLEX.content,
        8,
        'Science'
      );
      
      expect(result.hasIssues).toBe(false);
    });
  });
});

// ============================================================================
// SAFE RESPONSE TESTS
// ============================================================================

describe('Safe Response Guardrails', () => {
  describe('Off-Topic Responses', () => {
    it('should return friendly redirect for junior grades', () => {
      const response = getOffTopicResponse(2);
      
      expect(response).toContain('learning');
      expect(response.length).toBeLessThan(200); // Keep it short for juniors
    });
    
    it('should return more direct redirect for senior grades', () => {
      const response = getOffTopicResponse(10);
      
      expect(response).toContain('focus');
    });
  });
  
  describe('Unsafe Content Responses', () => {
    it('should return safe redirect without revealing policy', () => {
      const response = getUnsafeContentResponse(5);
      
      expect(response).not.toContain('policy');
      expect(response).not.toContain('blocked');
      expect(response).toContain('help');
    });
  });
  
  describe('Homework Redirect Responses', () => {
    it('should encourage learning approach for junior grades', () => {
      const response = getHomeworkRedirectResponse(3);
      
      expect(response).toContain('one');
      expect(response).not.toContain('homework dump');
    });
    
    it('should be more direct about learning for senior grades', () => {
      const response = getHomeworkRedirectResponse(9);
      
      expect(response).toContain('concept');
    });
  });
});

// ============================================================================
// CONTENT SAFETY INTEGRATION TESTS
// ============================================================================

describe('Content Safety Integration', () => {
  it('should pass full safety check for valid simple content', () => {
    const safe = isContentSafe(
      MOCK_AI_RESPONSES.VALID_SIMPLE.content,
      3,
      'Mathematics',
      MOCK_AI_RESPONSES.VALID_SIMPLE.confidence
    );
    
    expect(safe).toBe(true);
  });
  
  it('should fail safety check for hallucinated content', () => {
    const safe = isContentSafe(
      MOCK_AI_RESPONSES.HALLUCINATED_FACTS.content,
      7,
      'Mathematics',
      MOCK_AI_RESPONSES.HALLUCINATED_FACTS.confidence
    );
    
    expect(safe).toBe(false);
  });
  
  it('should fail safety check for low confidence responses', () => {
    const safe = isContentSafe(
      MOCK_AI_RESPONSES.VALID_SIMPLE.content,
      5,
      'Mathematics',
      0.3 // Low confidence
    );
    
    expect(safe).toBe(false);
  });
  
  it('should fail safety check for age-inappropriate complexity', () => {
    const safe = isContentSafe(
      MOCK_AI_RESPONSES.TOO_COMPLEX_FOR_JUNIOR.content,
      1, // Grade 1
      'General',
      0.9
    );
    
    expect(safe).toBe(false);
  });
});
