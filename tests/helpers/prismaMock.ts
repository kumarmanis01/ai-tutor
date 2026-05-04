/**
 * Prisma mock helper for unit tests.
 * Provides a deeply-mocked PrismaClient so tests never hit the database.
 *
 * Usage in test files:
 *   jest.mock('@/lib/prisma.js', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
 *   import { prismaMock } from '../../helpers/prismaMock';
 */

function mockModel() {
  const fn = (name: string) => jest.fn().mockName(name);
  return {
    findUnique: fn('findUnique'),
    findFirst: fn('findFirst'),
    findMany: fn('findMany'),
    create: fn('create'),
    createMany: fn('createMany'),
    update: fn('update'),
    updateMany: fn('updateMany'),
    delete: fn('delete'),
    deleteMany: fn('deleteMany'),
    count: fn('count'),
    groupBy: fn('groupBy'),
    upsert: fn('upsert'),
    aggregate: fn('aggregate'),
  };
}

export const prismaMock = {
  hydrationJob: mockModel(),
  adminConfig: mockModel(),
  outbox: mockModel(),
  executionJob: mockModel(),
  jobExecutionLog: mockModel(),
  jobLock: mockModel(),
  parentInvite: mockModel(),
  parentStudent: mockModel(),
  parentProfile: mockModel(),
  consent: mockModel(),
  deletionRequest: mockModel(),
  parentChildControl: mockModel(),
  freeTierUsage: mockModel(),
  weeklyStudentSummary: mockModel(),
  subjectProgressSummary: mockModel(),
  attentionFlag: mockModel(),
  readinessStatus: mockModel(),
  studentTopicMastery: mockModel(),
  studentStreak: mockModel(),
  invoice: mockModel(),
  learningSession: mockModel(),
  testResult: mockModel(),
  learningPlan: mockModel(),
  board: mockModel(),
  classLevel: mockModel(),
  subjectDef: mockModel(),
  chapterDef: mockModel(),
  topicDef: mockModel(),
  topicNote: mockModel(),
  misconception: mockModel(),
  generatedTest: mockModel(),
  generatedQuestion: mockModel(),
  auditLog: mockModel(),
  answerEvent: mockModel(),
  user: mockModel(),
  subscription: mockModel(),
  paymentCustomer: mockModel(),
  paymentMethod: mockModel(),
  systemSetting: mockModel(),
  syllabus: mockModel(),
  $transaction: jest.fn().mockName('$transaction'),
  $executeRaw: jest.fn().mockName('$executeRaw'),
  $executeRawUnsafe: jest.fn().mockName('$executeRawUnsafe'),
  $queryRaw: jest.fn().mockName('$queryRaw'),
  $queryRawUnsafe: jest.fn().mockName('$queryRawUnsafe'),
  $disconnect: jest.fn().mockName('$disconnect'),
  ingestRunLog: mockModel(),
  structuredSession: mockModel(),
  studentXP: mockModel(),
  diagnosticSession: mockModel(),
  studentConceptState: mockModel(),
  mockExamAttempt: mockModel(),
  studentLearningProfile: mockModel(),
  homeworkAssignment: mockModel(),
};

/** Reset all mock functions in prismaMock (call in beforeEach) */
export function resetPrismaMock(): void {
  for (const [modelName, value] of Object.entries(prismaMock)) {
    // Skip helper functions
    if (modelName === '$transaction' || modelName === '$executeRaw') {
      if (typeof value === 'function' && 'mockReset' in value) {
        (value as jest.Mock).mockReset();
      }
      continue
    }

    if (typeof value === 'object' && value !== null) {
      for (const [fnName, fn] of Object.entries(value)) {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          (fn as jest.Mock).mockReset();

          // Provide safe defaults so tests don't need to stub every single model method
          if (fnName === 'findMany') {
            (fn as jest.Mock).mockResolvedValue([])
          } else if (fnName === 'findUnique' || fnName === 'findFirst') {
            (fn as jest.Mock).mockResolvedValue(null)
          } else if (fnName === 'upsert' || fnName === 'create' || fnName === 'update') {
            (fn as jest.Mock).mockResolvedValue({})
          } else {
            // leave other methods as reset (undefined) unless a test overrides them
          }
        }
      }
    } else if (typeof value === 'function' && 'mockReset' in value) {
      (value as jest.Mock).mockReset();
    }
  }
}
