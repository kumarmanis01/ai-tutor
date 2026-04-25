/**
 * FILE OBJECTIVE:
 * - Provide a minimal, fast mock implementation of `@prisma/client` for unit
 *   tests that run when the generated Prisma client is not present in
 *   `node_modules/.prisma/client`.
 *
 * LINKED UNIT TEST:
 * - tests/unit/mocks/prismaClientMock.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-18T00:00:00Z | copilot | added lightweight prisma client mock for tests
 */

export class PrismaClient {
  constructor() {}
  async $executeRawUnsafe(_sql: string) {
    return null;
  }
  async $disconnect() {
    return null;
  }
}

export const Prisma = {
  ClientKnownRequestError: class {},
};

export const UserRole = {
  user: 'user',
  parent: 'parent',
  admin: 'admin',
  moderator: 'moderator',
  support: 'support',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export default { PrismaClient, Prisma, UserRole };

// Minimal enum-like exports used in tests. These mirror the generated
// @prisma/client enums so unit tests that import them from
// `@prisma/client` receive predictable values.
export const LanguageCode = {
  en: 'en',
  hi: 'hi',
} as const;
export type LanguageCode = (typeof LanguageCode)[keyof typeof LanguageCode];

export const DifficultyLevel = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
} as const;
export type DifficultyLevel = (typeof DifficultyLevel)[keyof typeof DifficultyLevel];

export const AdminActionType = {
  SUBSCRIPTION_EXTEND: 'SUBSCRIPTION_EXTEND',
  SUBSCRIPTION_REFUND: 'SUBSCRIPTION_REFUND',
  CONCEPT_SUSPEND: 'CONCEPT_SUSPEND',
  CONCEPT_UNSUSPEND: 'CONCEPT_UNSUSPEND',
  ERASURE_REQUEST: 'ERASURE_REQUEST',
  ERASURE_PSEUDONYMISE: 'ERASURE_PSEUDONYMISE',
  ERASURE_PURGE: 'ERASURE_PURGE',
  QUESTION_QUARANTINE: 'QUESTION_QUARANTINE',
  GRADE_CHANGE: 'GRADE_CHANGE',
  ACCOUNT_SUSPEND: 'ACCOUNT_SUSPEND',
  DIAGNOSTIC_RESET: 'DIAGNOSTIC_RESET',
  FEATURE_FLAG_CHANGE: 'FEATURE_FLAG_CHANGE',
  CONTENT_APPROVE: 'CONTENT_APPROVE',
  QUESTION_APPROVE: 'QUESTION_APPROVE',
  QUESTION_REJECT: 'QUESTION_REJECT',
  DOUBT_RESOLVE: 'DOUBT_RESOLVE',
} as const;
export type AdminActionType = (typeof AdminActionType)[keyof typeof AdminActionType];

// Consent scopes used by the consent APIs and tests
export const ConsentScope = {
  AI_INTERACTION: 'AI_INTERACTION',
  DATA_PROCESSING: 'DATA_PROCESSING',
  MARKETING: 'MARKETING',
} as const;
export type ConsentScope = (typeof ConsentScope)[keyof typeof ConsentScope];

export const JobType = {
  syllabus: 'syllabus',
  notes: 'notes',
  questions: 'questions',
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];

export const JobStatus = {
  pending: 'pending',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
