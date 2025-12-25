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
