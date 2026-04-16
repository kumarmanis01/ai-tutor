/**
 * Unit tests for lib/mock/ensureMocks.ts
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

// Controlled counters for mock behaviours
let createdSoFar = 0;
const existingBase = 2;

jest.mock('@/lib/prisma', () => {
  const subjectDefFindMany = jest.fn().mockResolvedValue([
    {
      id: 'sub-1',
      name: 'Mathematics',
      isAvailable: true,
      class: { grade: 10, board: { slug: 'cbse' } },
    },
  ]);

  const mockExamCount = jest.fn().mockImplementation(async () => existingBase + createdSoFar);

  const tx = {
    mockExam: {
      create: jest.fn(async ({ data }) => {
        const exam = { id: `exam-${existingBase + createdSoFar + 1}`, ...data };
        createdSoFar += 1;
        return exam;
      }),
    },
    mockExamSection: {
      create: jest.fn(async ({ data }) => ({ id: `sec-${Math.random().toString(36).slice(2, 7)}`, ...data })),
    },
    mockExamQuestion: {
      createMany: jest.fn(async ({ data }) => ({ count: data.length })),
    },
  };

  const $transaction = jest.fn(async (cb: any) => cb(tx));

  return {
    prisma: {
      subjectDef: { findMany: subjectDefFindMany },
      mockExam: { count: mockExamCount },
      $transaction,
    },
  };
});

jest.mock('@/lib/mock/selectMockQuestions', () => ({
  selectMockQuestions: jest.fn().mockResolvedValue([
    { sectionDef: { title: 'Section A', marksPerQ: 1, instructions: 'A' }, questions: [{ id: 'q-a-1' }, { id: 'q-a-2' }] },
    { sectionDef: { title: 'Section B', marksPerQ: 3, instructions: 'B' }, questions: [{ id: 'q-b-1' }] },
    { sectionDef: { title: 'Section C', marksPerQ: 5, instructions: 'C' }, questions: [{ id: 'q-c-1' }] },
  ]),
  MOCK_TOTAL_MARKS: 80,
  MOCK_DURATION_MIN: 180,
}));

describe('ensureMinimumMocks', () => {
  beforeEach(() => {
    jest.resetModules();
    createdSoFar = 0;
  });

  it('creates missing mocks up to the requested minimum', async () => {
    const { ensureMinimumMocks } = require('@/lib/mock/ensureMocks');
    const res = await ensureMinimumMocks({ minPer: 5 });
    // existingBase = 2, minPer=5 => should create 3
    expect(res.created.length).toBe(3);
    expect(res.minPer).toBe(5);
  });
});
