/**
 * FILE OBJECTIVE:
 * - Prompt rewriting utilities for multilingual support.
 * - Token optimization strategies per language.
 * - Language detection and auto-selection.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/ai/language/promptRewriter.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created multilingual prompt rewriter
 */

import type { Grade } from '@/lib/ai/prompts/schemas';
import { type LanguageMode, getCompleteSystemPrompt } from './systemPrompts';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Prompt rewriting result
 */
export interface RewrittenPrompt {
  /** Rewritten system prompt */
  readonly systemPrompt: string;
  /** Rewritten user prompt */
  readonly userPrompt: string;
  /** Detected input language */
  readonly detectedLanguage: LanguageMode;
  /** Output language to use */
  readonly outputLanguage: LanguageMode;
  /** Token budget adjustment */
  readonly tokenBudget: TokenBudget;
  /** Language-specific instructions added */
  readonly addedInstructions: string[];
}

/**
 * Token budget by language
 */
export interface TokenBudget {
  /** Maximum input tokens */
  readonly maxInputTokens: number;
  /** Maximum output tokens */
  readonly maxOutputTokens: number;
  /** Estimated cost multiplier (1.0 = English baseline) */
  readonly costMultiplier: number;
}

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/**
 * Detect language from text.
 * Simple heuristic-based detection.
 */
export function detectLanguage(text: string): LanguageMode {
  // Count character types
  const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length;
  const englishCount = (text.match(/[a-zA-Z]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  
  if (totalChars === 0) return 'EN';
  
  const devanagariRatio = devanagariCount / totalChars;
  const englishRatio = englishCount / totalChars;
  
  // Pure Hindi (Devanagari script)
  if (devanagariRatio > 0.5) {
    return 'HI';
  }
  
  // Mixed content (Hinglish)
  if (devanagariRatio > 0.1 && englishRatio > 0.3) {
    return 'HINGLISH';
  }
  
  // Check for romanized Hindi patterns
  const hinglishPatterns = [
    /\b(kya|kaise|kyun|hai|hain|nahi|aur|mein|ko|se|ka|ki|ke)\b/gi,
    /\b(samjhao|batao|padho|likho|karo|dekho)\b/gi,
    /\b(accha|theek|haan|na|bhi)\b/gi,
  ];
  
  let hinglishMatchCount = 0;
  for (const pattern of hinglishPatterns) {
    hinglishMatchCount += (text.match(pattern) || []).length;
  }
  
  if (hinglishMatchCount > 2) {
    return 'HINGLISH';
  }
  
  return 'EN';
}

// ============================================================================
// TOKEN BUDGETS
// ============================================================================

/**
 * Token budgets by language and grade.
 * 
 * TOKEN COST ANALYSIS:
 * - English: Most efficient (1 word ≈ 1.3 tokens avg)
 * - Hinglish: Moderate (1 word ≈ 1.5 tokens avg)
 * - Hindi: Least efficient (1 word ≈ 2.0 tokens avg in Devanagari)
 * 
 * COST OPTIMIZATION STRATEGY:
 * - Shorter responses for Hindi to control cost
 * - Prefer Hinglish over pure Hindi when acceptable
 * - Junior grades need fewer tokens anyway
 */
export function getTokenBudget(language: LanguageMode, grade: Grade): TokenBudget {
  const baseBudgets: Record<LanguageMode, TokenBudget> = {
    EN: {
      maxInputTokens: 1000,
      maxOutputTokens: 1500,
      costMultiplier: 1.0,
    },
    HINGLISH: {
      maxInputTokens: 800,  // Slightly reduced
      maxOutputTokens: 1200,
      costMultiplier: 1.15,
    },
    HI: {
      maxInputTokens: 600,  // Significantly reduced
      maxOutputTokens: 1000,
      costMultiplier: 1.5,
    },
  };
  
  const base = baseBudgets[language];
  
  // Grade adjustments
  let gradeMultiplier = 1.0;
  if (grade <= 3) {
    gradeMultiplier = 0.6; // Junior needs less content
  } else if (grade <= 7) {
    gradeMultiplier = 0.8;
  }
  
  return {
    maxInputTokens: Math.round(base.maxInputTokens * gradeMultiplier),
    maxOutputTokens: Math.round(base.maxOutputTokens * gradeMultiplier),
    costMultiplier: base.costMultiplier,
  };
}

// ============================================================================
// PROMPT REWRITING
// ============================================================================

/**
 * Rewrite prompts for optimal multilingual output.
 */
export function rewritePromptForLanguage(
  userPrompt: string,
  outputLanguage: LanguageMode,
  grade: Grade,
  contentType: 'NOTES' | 'PRACTICE' | 'DOUBT'
): RewrittenPrompt {
  const detectedLanguage = detectLanguage(userPrompt);
  const tokenBudget = getTokenBudget(outputLanguage, grade);
  
  // Get base system prompt for language
  const baseSystemPrompt = getCompleteSystemPrompt(outputLanguage, grade);
  
  // Add output language instruction
  const languageInstruction = getOutputLanguageInstruction(outputLanguage, contentType);
  
  // Simplify user prompt if needed for token optimization
  const optimizedUserPrompt = optimizeUserPrompt(userPrompt, outputLanguage, grade);
  
  // Combine system prompt with language instruction
  const systemPrompt = `${baseSystemPrompt}

OUTPUT LANGUAGE: ${languageInstruction}`;
  
  return {
    systemPrompt,
    userPrompt: optimizedUserPrompt,
    detectedLanguage,
    outputLanguage,
    tokenBudget,
    addedInstructions: [languageInstruction],
  };
}

/**
 * Get specific output language instruction
 */
function getOutputLanguageInstruction(
  language: LanguageMode,
  contentType: 'NOTES' | 'PRACTICE' | 'DOUBT'
): string {
  const instructions: Record<LanguageMode, Record<string, string>> = {
    EN: {
      NOTES: 'Respond in clear English. Use simple sentences for younger students.',
      PRACTICE: 'Write questions and options in English. Keep language grade-appropriate.',
      DOUBT: 'Answer in English. Be conversational but educational.',
    },
    HI: {
      NOTES: 'हिंदी में जवाब दें। देवनागरी लिपि का उपयोग करें। सरल वाक्य बनाएं।',
      PRACTICE: 'प्रश्न और विकल्प हिंदी में लिखें। तकनीकी शब्द अंग्रेजी में रख सकते हैं।',
      DOUBT: 'हिंदी में जवाब दें। दोस्ताना लहजे में समझाएं।',
    },
    HINGLISH: {
      NOTES: 'Hinglish mein jawab do. Hindi-English mix naturally use karo. Technical terms English mein rakho.',
      PRACTICE: 'Questions Hinglish mein likho. Options clear rakho. Formulas English mein.',
      DOUBT: 'Hinglish mein samjhao. Friendly tone rakho. Student comfortable feel kare.',
    },
  };
  
  return instructions[language][contentType];
}

/**
 * Optimize user prompt for token efficiency
 */
function optimizeUserPrompt(
  prompt: string,
  language: LanguageMode,
  grade: Grade
): string {
  let optimized = prompt.trim();
  
  // Remove excessive whitespace
  optimized = optimized.replace(/\s+/g, ' ');
  
  // For Hindi, the prompt is usually shorter anyway
  // For English and Hinglish, we can be more aggressive
  
  // Remove common filler words for token savings
  if (language !== 'HI') {
    const fillerPatterns = [
      /\b(please|kindly|could you|would you|I want to know|tell me about)\b/gi,
      /\b(basically|actually|literally|really)\b/gi,
    ];
    
    for (const pattern of fillerPatterns) {
      optimized = optimized.replace(pattern, '');
    }
  }
  
  // Limit prompt length based on grade
  const maxLength = grade <= 3 ? 200 : grade <= 7 ? 400 : 600;
  if (optimized.length > maxLength) {
    optimized = optimized.substring(0, maxLength) + '...';
  }
  
  return optimized.trim();
}

// ============================================================================
// RESPONSE POST-PROCESSING
// ============================================================================

/**
 * Post-process AI response for language consistency
 */
export function postProcessResponse(
  response: string,
  targetLanguage: LanguageMode
): string {
  let processed = response;
  
  // Clean up any language mixing issues
  if (targetLanguage === 'HI') {
    // Remove any English sentences that slipped in (except technical terms)
    // This is a heuristic - in production, use more sophisticated NLP
    processed = processed.replace(/[a-zA-Z]{10,}/g, (match) => {
      // Keep technical terms, formulas, etc.
      if (match.match(/^(formula|equation|theorem|definition|example|note|tip)/i)) {
        return match;
      }
      return match; // In production, translate or flag
    });
  }
  
  if (targetLanguage === 'HINGLISH') {
    // Ensure Hinglish formatting is consistent
    // Add Hindi conjunctions where needed
    processed = processed
      .replace(/\band\b/gi, 'aur')
      .replace(/\bbut\b/gi, 'lekin')
      .replace(/\bso\b/gi, 'toh')
      .replace(/\bbecause\b/gi, 'kyunki');
  }
  
  return processed;
}

/**
 * Validate response matches target language
 */
export function validateLanguageOutput(
  response: string,
  targetLanguage: LanguageMode
): { isValid: boolean; detectedLanguage: LanguageMode; mixRatio: number } {
  const detected = detectLanguage(response);
  
  // Calculate language mix ratio
  const devanagariCount = (response.match(/[\u0900-\u097F]/g) || []).length;
  const englishCount = (response.match(/[a-zA-Z]/g) || []).length;
  const total = devanagariCount + englishCount;
  
  const mixRatio = total > 0 ? devanagariCount / total : 0;
  
  // Validation rules
  let isValid = true;
  
  if (targetLanguage === 'HI' && mixRatio < 0.5) {
    isValid = false; // Hindi response should be mostly Devanagari
  }
  
  if (targetLanguage === 'EN' && mixRatio > 0.1) {
    isValid = false; // English response should have minimal Hindi
  }
  
  if (targetLanguage === 'HINGLISH' && (mixRatio < 0.05 || mixRatio > 0.5)) {
    isValid = false; // Hinglish should be a mix
  }
  
  return { isValid, detectedLanguage: detected, mixRatio };
}
