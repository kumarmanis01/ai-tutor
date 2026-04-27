/**
 * FILE OBJECTIVE:
 * - Define canonical Zod schemas for student registration payloads used by /api/v1/students/register.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/registrationSchema.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created schema-first validation for registration and parent consent contact
 * - 2026-04-27T12:00:00Z | copilot | enforce required subjects and stricter WhatsApp contact normalization for S0.1/S0.2
 */

import { z } from 'zod';

export const SUPPORTED_BOARDS = [
  'CBSE',
  'ICSE',
  'STATE_MAHARASHTRA',
  'STATE_UTTAR_PRADESH',
  'STATE_OTHER',
] as const;

export const SUPPORTED_MEDIUMS = ['en', 'hi'] as const;

const firstNameSchema = z
  .string()
  .trim()
  .min(1, 'name_required')
  .max(30, 'name_too_long')
  .regex(/^[A-Za-z ]+$/, 'name_invalid_chars');

const gradeSchema = z
  .union([z.string(), z.number()])
  .transform((value) => Number(value))
  .refine((value) => Number.isInteger(value) && value >= 1 && value <= 12, {
    message: 'grade_invalid',
  });

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s\-()]{8,20}$/, 'invalid_phone');

const emailSchema = z.string().trim().email('invalid_email');

export const studentRegistrationSchema = z
  .object({
    name: firstNameSchema,
    dateOfBirth: z.string().trim().min(1, 'dob_required'),
    grade: gradeSchema,
    board: z.enum(SUPPORTED_BOARDS),
    medium: z.enum(SUPPORTED_MEDIUMS),
    subjects: z
      .array(z.string().trim().min(1))
      .min(1, 'subjects_required')
      .max(6, 'subjects_max_six'),
    channel: z.enum(['whatsapp', 'email']).optional(),
    parent_contact: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    const isMinorFlow = value.channel != null || (value.parent_contact?.length ?? 0) > 0;
    if (!isMinorFlow) {
      return;
    }

    if (!value.channel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'channel_required',
        path: ['channel'],
      });
      return;
    }

    if (!value.parent_contact) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'parent_contact_required',
        path: ['parent_contact'],
      });
      return;
    }

    if (value.channel === 'whatsapp') {
      const parsed = phoneSchema.safeParse(value.parent_contact);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'invalid_phone',
          path: ['parent_contact'],
        });
      } else {
        const digits = value.parent_contact.replace(/\D/g, '');
        const normalized = digits.startsWith('91') ? digits.slice(2) : digits;
        if (normalized.length !== 10) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'invalid_phone',
            path: ['parent_contact'],
          });
        }
      }
    }

    if (value.channel === 'email') {
      const parsed = emailSchema.safeParse(value.parent_contact);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'invalid_email',
          path: ['parent_contact'],
        });
      }
    }
  });

export type StudentRegistrationInput = z.infer<typeof studentRegistrationSchema>;
