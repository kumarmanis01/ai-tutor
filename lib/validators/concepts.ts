/**
 * FILE OBJECTIVE:
 * - Zod schemas for the admin concept generation and management API routes.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial: GenerateConceptsSchema + DeleteConceptsSchema
 */

import { z } from 'zod';

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'te', 'ta', 'mr', 'bn', 'gu', 'kn', 'ml'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  hi: 'Hindi',
  te: 'Telugu',
  ta: 'Tamil',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
};

export const GenerateConceptsSchema = z.object({
  board: z.string().min(1, 'Board is required'),
  grade: z.string().min(1, 'Grade is required'),
  subject: z.string().min(1, 'Subject is required'),
  language: z.enum(SUPPORTED_LANGUAGES).default('en'),
  topicSlug: z
    .string()
    .min(1, 'Topic slug is required')
    .regex(/^[a-z0-9-]+$/, 'Topic slug must be lowercase letters, numbers, and hyphens only'),
  chapterTitle: z.string().min(1, 'Chapter title is required').max(200),
  count: z.number().int().min(1).max(20).default(12),
});

export type GenerateConceptsInput = z.infer<typeof GenerateConceptsSchema>;

export const DeleteConceptsSchema = z.object({
  board: z.string().min(1),
  grade: z.string().min(1),
  subject: z.string().min(1),
  topicSlug: z.string().min(1),
});

export type DeleteConceptsInput = z.infer<typeof DeleteConceptsSchema>;
