// Temporary Prisma shim to satisfy TypeScript until Prisma client is regenerated
declare module '@prisma/client' {
  export const Prisma: any;

  export class PrismaClient {
    constructor(...args: any[]);
    $disconnect(): Promise<void>;
    $connect(): Promise<void>;
    $transaction<T>(arg: any[] | ((tx: any) => Promise<T>)): Promise<T>;
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
    JOB_RETRY: 'JOB_RETRY';
    JOB_REQUEUE: 'JOB_REQUEUE';
    CONTENT_HYDRATE: 'CONTENT_HYDRATE';
    WORKER_START: 'WORKER_START';
    WORKER_STOP: 'WORKER_STOP';
  };
  export type AdminActionType = typeof AdminActionType[keyof typeof AdminActionType];

  export const ConsentScope: {
    DATA_PROCESSING: 'DATA_PROCESSING';
    AI_INTERACTION: 'AI_INTERACTION';
    PARENT_NOTIFICATION: 'PARENT_NOTIFICATION';
    MARKETING: 'MARKETING';
  };
  export type ConsentScope = typeof ConsentScope[keyof typeof ConsentScope];

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
}
