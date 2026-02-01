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
  outbox: mockModel(),
  executionJob: mockModel(),
  jobExecutionLog: mockModel(),
  jobLock: mockModel(),
  board: mockModel(),
  classLevel: mockModel(),
  subjectDef: mockModel(),
  chapterDef: mockModel(),
  topicDef: mockModel(),
  topicNote: mockModel(),
  generatedTest: mockModel(),
  generatedQuestion: mockModel(),
  auditLog: mockModel(),
  user: mockModel(),
  systemSetting: mockModel(),
  syllabus: mockModel(),
  $transaction: jest.fn().mockName('$transaction'),
  $executeRaw: jest.fn().mockName('$executeRaw'),
};

/** Reset all mock functions in prismaMock (call in beforeEach) */
export function resetPrismaMock(): void {
  for (const value of Object.values(prismaMock)) {
    if (typeof value === 'function' && 'mockReset' in value) {
      (value as jest.Mock).mockReset();
    } else if (typeof value === 'object' && value !== null) {
      for (const fn of Object.values(value)) {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          (fn as jest.Mock).mockReset();
        }
      }
    }
  }
}
