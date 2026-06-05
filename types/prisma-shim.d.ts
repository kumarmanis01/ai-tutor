// Temporary Prisma shim to satisfy TypeScript until Prisma client is regenerated
declare module '@prisma/client' {
  export const Prisma: any;

  export class PrismaClient {
    constructor(...args: any[]);
    $disconnect(): Promise<void>;
    $connect(): Promise<void>;
    $transaction<T>(fn: (tx: any) => Promise<T>, options?: { timeout?: number; maxWait?: number; isolationLevel?: string }): Promise<T>;
    $transaction<T>(queries: any[]): Promise<T>;
    [key: string]: any;
  }

  // export enums/consts as values and types
  export const LanguageCode: { en: 'en'; hi: 'hi'; [k: string]: string };
  export type LanguageCode = typeof LanguageCode[keyof typeof LanguageCode];

  export const JobType: { syllabus: string; tests: string; notes: string; questions: string; assemble: string; [k: string]: string };
  export type JobType = typeof JobType[keyof typeof JobType];

  export const DifficultyLevel: { easy: string; medium: string; hard: string; [k: string]: string };
  export type DifficultyLevel = typeof DifficultyLevel[keyof typeof DifficultyLevel];

  export const UserRole: { admin: string; user: string; [k: string]: string };
  export type UserRole = typeof UserRole[keyof typeof UserRole];

  export type Syllabus = any;
  export type SyllabusStatus = any;
  export type Question = any;
  export type TestResult = any;

  export type InputJsonValue = any;
  export type JsonValue = any;

  export const sql: any;
  export const empty: any;
  export const JsonNull: any;

  export const AdminActionType: {
    GRADE_CHANGE: 'GRADE_CHANGE';
    DIAGNOSTIC_RESET: 'DIAGNOSTIC_RESET';
    ACCOUNT_SUSPEND: 'ACCOUNT_SUSPEND';
    ACCOUNT_REACTIVATE: 'ACCOUNT_REACTIVATE';
    ACCOUNT_DEACTIVATE: 'ACCOUNT_DEACTIVATE';
    ACCOUNT_RESTORE: 'ACCOUNT_RESTORE';
    SUBSCRIPTION_EXTEND: 'SUBSCRIPTION_EXTEND';
    SUBSCRIPTION_REFUND: 'SUBSCRIPTION_REFUND';
    QUESTION_QUARANTINE: 'QUESTION_QUARANTINE';
    QUESTION_APPROVE: 'QUESTION_APPROVE';
    QUESTION_REJECT: 'QUESTION_REJECT';
    FEATURE_FLAG_CHANGE: 'FEATURE_FLAG_CHANGE';
    ERASURE_REQUEST: 'ERASURE_REQUEST';
    ERASURE_PSEUDONYMISE: 'ERASURE_PSEUDONYMISE';
    ERASURE_PURGE: 'ERASURE_PURGE';
    CONTENT_APPROVE: 'CONTENT_APPROVE';
    DOUBT_RESOLVE: 'DOUBT_RESOLVE';
    CONTENT_REJECT: 'CONTENT_REJECT';
    JOB_CANCEL: 'JOB_CANCEL';
    JOB_PAUSE: 'JOB_PAUSE';
    JOB_RESUME: 'JOB_RESUME';
    JOB_RETRY: 'JOB_RETRY';
    JOB_REQUEUE: 'JOB_REQUEUE';
    REGEN_JOB_CREATED: 'REGEN_JOB_CREATED';
    REGEN_JOB_TRIGGERED: 'REGEN_JOB_TRIGGERED';
    REGEN_JOB_STARTED: 'REGEN_JOB_STARTED';
    REGEN_JOB_COMPLETED: 'REGEN_JOB_COMPLETED';
    REGEN_JOB_FAILED: 'REGEN_JOB_FAILED';
    REGEN_JOB_LOCKED: 'REGEN_JOB_LOCKED';
    CONTENT_HYDRATE: 'CONTENT_HYDRATE';
    WORKER_START: 'WORKER_START';
    WORKER_STOP: 'WORKER_STOP';
    CONCEPT_SUSPEND: 'CONCEPT_SUSPEND';
    CONCEPT_UNSUSPEND: 'CONCEPT_UNSUSPEND';
    PROMOTION_CANDIDATE_CREATED: 'PROMOTION_CANDIDATE_CREATED';
    RETRY_INTENT_EXECUTED: 'RETRY_INTENT_EXECUTED';
    RETRY_INTENT_CREATED: 'RETRY_INTENT_CREATED';
  };
  export type AdminActionType = typeof AdminActionType[keyof typeof AdminActionType];

  export const QuestionStatus: {
    ACTIVE: 'ACTIVE';
    QUARANTINED: 'QUARANTINED';
    REJECTED: 'REJECTED';
    PENDING_REVIEW: 'PENDING_REVIEW';
  };
  export type QuestionStatus = typeof QuestionStatus[keyof typeof QuestionStatus];

  export const QualityFlag: {
    HALLUCINATION: 'HALLUCINATION';
    INCORRECT_EXPLANATION: 'INCORRECT_EXPLANATION';
    POOR_PEDAGOGY: 'POOR_PEDAGOGY';
    OFF_TOPIC: 'OFF_TOPIC';
    DIRECT_ANSWER_GIVEN: 'DIRECT_ANSWER_GIVEN';
    SAFETY_CONCERN: 'SAFETY_CONCERN';
  };
  export type QualityFlag = typeof QualityFlag[keyof typeof QualityFlag];

  export const FlagReason: {
    WRONG_ANSWER: 'WRONG_ANSWER';
    AMBIGUOUS: 'AMBIGUOUS';
    TYPO: 'TYPO';
    OFF_TOPIC: 'OFF_TOPIC';
    TOO_EASY: 'TOO_EASY';
    TOO_HARD: 'TOO_HARD';
  };
  export type FlagReason = typeof FlagReason[keyof typeof FlagReason];

  export const ConsentScope: {
    DATA_PROCESSING: 'DATA_PROCESSING';
    AI_INTERACTION: 'AI_INTERACTION';
    PARENT_NOTIFICATION: 'PARENT_NOTIFICATION';
    MARKETING: 'MARKETING';
  };
  export type ConsentScope = typeof ConsentScope[keyof typeof ConsentScope];

  export const SoftDeleteStatus: { active: 'active'; archived: 'archived'; deleted: 'deleted'; [k: string]: string };
  export type SoftDeleteStatus = typeof SoftDeleteStatus[keyof typeof SoftDeleteStatus];

  export const CurriculumBookParseStatus: { pending: 'pending'; processing: 'processing'; done: 'done'; failed: 'failed'; [k: string]: string };
  export type CurriculumBookParseStatus = typeof CurriculumBookParseStatus[keyof typeof CurriculumBookParseStatus];

  export const JobStatus: { pending: 'pending'; queued: 'queued'; running: 'running'; done: 'done'; failed: 'failed'; cancelled: 'cancelled'; [k: string]: string };
  export type JobStatus = typeof JobStatus[keyof typeof JobStatus];

  const _default: any;
  export default _default;
}

declare namespace Prisma {
  type InputJsonValue = any;
  type JsonValue = any;
  const sql: any;
  const empty: any;
  const JsonNull: any;
  type TransactionClient = any;
  type BoardInclude = Record<string, unknown>;
  type UserCreateInput = Record<string, unknown>;
  type UserUpdateInput = Record<string, unknown>;
  function sql(strings: TemplateStringsArray, ...values: any[]): any;
}
