/**
 * FILE OBJECTIVE:
 * - Prompt variable validation with Zod schemas for each prompt type (PR-1.3).
 * - Validates variables before LLM calls to prevent runtime errors.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompts/validator.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T14:30:00Z | staff-engineer | created prompt variable validator (PR-1.3)
 */

import { z } from 'zod';
import { PromptType } from '@prisma/client';
import { logger } from '@/lib/logger';

/**
 * PR-1.3: ValidationResult -- result of variable validation
 */
export interface ValidationResult {
  valid: boolean;
  errors?: Record<string, string[]>;
  message?: string;
}

/**
 * PR-1.3: Zod schemas for all 9 prompt types
 * Each schema defines required variables and their types
 */
const PROMPT_VARIABLE_SCHEMAS: Record<PromptType, z.ZodType<any>> = {
  LESSON_GENERATION: z.object({
    topic: z.string().min(1, 'Topic is required'),
    subject: z.string().min(1, 'Subject is required'),
    grade: z.number().int().min(1).max(12),
    board: z.enum(['CBSE', 'ICSE', 'STATE']),
    language: z.enum(['en', 'hi']).default('en'),
    studentLevel: z.enum(['foundation', 'standard', 'advanced']).default('standard'),
  }),

  CONTENT_ENHANCEMENT: z.object({
    content: z.string().min(50, 'Content must be at least 50 characters'),
    subject: z.string().min(1),
    grade: z.number().int().min(1).max(12),
    board: z.enum(['CBSE', 'ICSE', 'STATE']),
  }),

  DOUBT_SOLVING: z.object({
    studentQuestion: z.string().min(1, 'Question is required'),
    subject: z.string().min(1),
    grade: z.number().int().min(1).max(12),
    board: z.enum(['CBSE', 'ICSE', 'STATE']),
    studentLevel: z.enum(['foundation', 'standard', 'advanced']).default('standard'),
    preferredLanguage: z.enum(['en', 'hi']).default('en'),
    conversationHistory: z.string().optional(),
  }),

  SIMPLE_EXPLANATION: z.object({
    concept: z.string().min(1, 'Concept is required'),
    grade: z.number().int().min(1).max(12),
    subject: z.string().min(1),
  }),

  PRACTICE_QUESTIONS: z.object({
    topic: z.string().min(1),
    count: z.number().int().min(1).max(20).default(5),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    subject: z.string().min(1),
    grade: z.number().int().min(1).max(12),
    board: z.enum(['CBSE', 'ICSE', 'STATE']),
  }),

  DIAGNOSTIC_QUIZ: z.object({
    grade: z.number().int().min(1).max(12),
    board: z.enum(['CBSE', 'ICSE', 'STATE']),
    subject: z.string().min(1),
  }),

  PROGRESSIVE_HINTS: z.object({
    problem: z.string().min(10, 'Problem statement required'),
    studentLevel: z.enum(['foundation', 'standard', 'advanced']).default('standard'),
  }),

  CONTENT_TAGGING: z.object({
    content: z.string().min(50),
    subject: z.string().min(1),
    board: z.enum(['CBSE', 'ICSE', 'STATE']),
  }),

  WEEKLY_REPORT: z.object({
    studentName: z.string().min(1),
    weekData: z.record(z.any()),
  }),
};

/**
 * PR-1.3: PromptVariableValidator -- validates variables before LLM calls
 */
export class PromptVariableValidator {
  /**
   * Validate variables against the schema for a prompt type
   * Returns ValidationResult with detailed errors if invalid
   */
  static validatePromptVariables(
    type: PromptType,
    variables: Record<string, any>
  ): ValidationResult {
    try {
      const schema = PROMPT_VARIABLE_SCHEMAS[type];

      if (!schema) {
        return {
          valid: false,
          message: `No validation schema found for prompt type: ${type}`,
        };
      }

      const result = schema.safeParse(variables);

      if (!result.success) {
        const errors: Record<string, string[]> = {};

        for (const issue of result.error.issues) {
          const path = issue.path.join('.');
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(issue.message);
        }

        logger.warn('Prompt variable validation failed', {
          promptType: type,
          errors,
        });

        return {
          valid: false,
          errors,
          message: `Validation failed for ${type}: ${Object.entries(errors)
            .map(([k, v]) => `${k}: ${v.join(', ')}`)
            .join('; ')}`,
        };
      }

      return { valid: true };
    } catch (error) {
      logger.error('Prompt variable validation error', {
        promptType: type,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        valid: false,
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get the validation schema for a prompt type
   * Useful for admin UI to dynamically generate forms
   */
  static getSchema(type: PromptType): z.ZodType<any> | null {
    return PROMPT_VARIABLE_SCHEMAS[type] || null;
  }

  /**
   * Get all available schemas
   */
  static getAllSchemas(): Record<PromptType, z.ZodType<any>> {
    return PROMPT_VARIABLE_SCHEMAS;
  }

  /**
   * Validate at compile-time that variable names in template match schema
   * Used when creating/updating prompts in admin UI
   */
  static validateTemplateVariables(
    type: PromptType,
    template: string
  ): { valid: boolean; missingVars?: string[]; unknownVars?: string[] } {
    const schema = PROMPT_VARIABLE_SCHEMAS[type];
    if (!schema) {
      return { valid: false };
    }

    // Extract {{variable}} placeholders from template
    const templateVars = new Set<string>();
    const regex = /\{\{(\w+)\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      templateVars.add(match[1]);
    }

    // Get required variables from schema
    const schemaVars = new Set<string>();
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      if (shape) {
        Object.keys(shape).forEach((key) => {
          schemaVars.add(key);
        });
      }
    }

    // Check for missing and unknown variables
    const missingVars = Array.from(schemaVars).filter((v) => !templateVars.has(v));
    const unknownVars = Array.from(templateVars).filter((v) => !schemaVars.has(v));

    return {
      valid: missingVars.length === 0 && unknownVars.length === 0,
      missingVars: missingVars.length > 0 ? missingVars : undefined,
      unknownVars: unknownVars.length > 0 ? unknownVars : undefined,
    };
  }
}
