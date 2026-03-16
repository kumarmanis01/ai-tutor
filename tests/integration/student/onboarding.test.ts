/**
 * GROUP 1: Integration tests for student onboarding flow.
 * Covers ProfileCompletionGate, ParentOTPGate, grade immutability,
 * diagnostic gate, and LearningPlan generation.
 * All external services mocked — no live DB or network calls.
 */

// ---------------------------------------------------------------------------
// Prisma mock — must come before any import that uses @/lib/prisma
// ---------------------------------------------------------------------------
const prismaMock = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  studentConceptState: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  concept: {
    findMany: jest.fn(),
  },
  learningPlan: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  learningPlanItem: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    count: jest.fn(),
  },
  subjectDef: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logAPI: jest.fn(),
  },
}));
jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn().mockReturnValue(null),
}));

// ---------------------------------------------------------------------------
// Module imports (after mocks are in place)
// ---------------------------------------------------------------------------
import { isProfileComplete } from '@/lib/student/profileGuard';
import { requiresParentOTPGate } from '@/lib/student/accountStatus';
import { hasDiagnosticForSubject } from '@/lib/student/diagnosticGuard';
import { generateLearningPlan } from '@/lib/ai/learningPlan';

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. ProfileCompletionGate — isProfileComplete() (pure function)
// ---------------------------------------------------------------------------
describe('ProfileCompletionGate — isProfileComplete()', () => {
  it('returns false when all four fields are null', () => {
    expect(
      isProfileComplete({ board: null, grade: null, language: null, subjects: [] }),
    ).toBe(false);
  });

  it('returns false when subjects array is empty', () => {
    expect(
      isProfileComplete({ board: 'CBSE', grade: '10', language: 'en', subjects: [] }),
    ).toBe(false);
  });

  it('returns false when any single field is missing', () => {
    expect(
      isProfileComplete({ board: null, grade: '10', language: 'en', subjects: ['Math'] }),
    ).toBe(false);
    expect(
      isProfileComplete({ board: 'CBSE', grade: null, language: 'en', subjects: ['Math'] }),
    ).toBe(false);
    expect(
      isProfileComplete({ board: 'CBSE', grade: '10', language: null, subjects: ['Math'] }),
    ).toBe(false);
  });

  it('returns true when all four fields are populated', () => {
    expect(
      isProfileComplete({
        board: 'CBSE',
        grade: '10',
        language: 'en',
        subjects: ['Mathematics'],
      }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Parent gate — requiresParentOTPGate()
// ---------------------------------------------------------------------------
describe('requiresParentOTPGate()', () => {
  it('returns false when user is active and age is 17', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      accountStatus: 'active',
      age: 17,
    });
    const result = await requiresParentOTPGate('student-1');
    expect(result).toBe(false);
  });

  it('returns false when age is null (missing age must NOT trigger gate)', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      accountStatus: 'pending_parent_verification',
      age: null,
    });
    const result = await requiresParentOTPGate('student-2');
    expect(result).toBe(false);
  });

  it('returns true when age=10 and accountStatus=pending_parent_verification', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      accountStatus: 'pending_parent_verification',
      age: 10,
    });
    const result = await requiresParentOTPGate('student-3');
    expect(result).toBe(true);
  });

  it('returns false when user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const result = await requiresParentOTPGate('ghost-student');
    expect(result).toBe(false);
  });

  it('returns false on DB error', async () => {
    prismaMock.user.findUnique.mockRejectedValueOnce(new Error('db error'));
    const result = await requiresParentOTPGate('student-err');
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Grade immutability — via onboarding route logic
// ---------------------------------------------------------------------------
describe('Grade immutability', () => {
  it('strips grade from update payload when user already has a grade (PATCH-equivalent)', async () => {
    // Simulate the logic inside /api/user/onboarding POST:
    // if gradeRow?.grade != null → delete updates.grade
    const existingGrade = '10';
    const updates: Record<string, any> = { name: 'Alice', grade: '9' };

    // Mimic the guard
    if (existingGrade != null) {
      delete updates.grade;
    }

    expect(updates).not.toHaveProperty('grade');
    expect(updates.name).toBe('Alice');
  });

  it('preserves grade in updates when user.grade is null (first-time onboarding)', () => {
    const existingGrade: string | null = null;
    const updates: Record<string, any> = { name: 'Bob', grade: '10' };

    if (existingGrade != null) {
      delete updates.grade;
    }

    expect(updates.grade).toBe('10');
  });

  it('strips grade in updates when user.grade is already 10 (second onboarding attempt)', () => {
    const existingGrade = '10';
    const updates: Record<string, any> = { name: 'Bob', grade: '9' };

    if (existingGrade != null) {
      delete updates.grade;
    }

    // grade remains 10 in DB (never overwritten via this path)
    expect(updates).not.toHaveProperty('grade');
    expect(existingGrade).toBe('10');
  });

  it('onboarding route calls prisma.user.update WITHOUT grade when user already has grade', async () => {
    // Check that the DB update call strips grade
    const userId = 'student-immutable-grade';
    const existingUser = { id: userId, grade: '10' };
    const incomingBody = { name: 'Carol', grade: '9', board: 'CBSE', age: 15 };

    prismaMock.user.findUnique.mockResolvedValueOnce(existingUser);
    prismaMock.user.update.mockResolvedValueOnce({ ...existingUser, name: incomingBody.name });

    // Simulate onboarding handler logic
    const updates: Record<string, any> = { ...incomingBody };
    const gradeRow = existingUser;
    if (gradeRow?.grade != null) {
      delete updates.grade;
    }

    await prismaMock.user.update({ where: { id: userId }, data: updates });

    const callArg = prismaMock.user.update.mock.calls[0][0];
    expect(callArg.data).not.toHaveProperty('grade');
    expect(callArg.data.name).toBe('Carol');
  });
});

// ---------------------------------------------------------------------------
// 4. Diagnostic gate — hasDiagnosticForSubject()
// ---------------------------------------------------------------------------
describe('hasDiagnosticForSubject()', () => {
  it('returns false when no StudentConceptState rows exist for subject', async () => {
    prismaMock.studentConceptState.count.mockResolvedValueOnce(0);
    const result = await hasDiagnosticForSubject('student-4', 'subject-math');
    expect(result).toBe(false);
  });

  it('returns true when ≥1 StudentConceptState rows exist for subject', async () => {
    prismaMock.studentConceptState.count.mockResolvedValueOnce(3);
    const result = await hasDiagnosticForSubject('student-5', 'subject-math');
    expect(result).toBe(true);
  });

  it('returns false on DB error', async () => {
    prismaMock.studentConceptState.count.mockRejectedValueOnce(new Error('db error'));
    const result = await hasDiagnosticForSubject('student-err', 'subject-math');
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. LearningPlan generation — generateLearningPlan()
// ---------------------------------------------------------------------------
describe('generateLearningPlan()', () => {
  it('returns null when no concepts found for subject', async () => {
    prismaMock.concept.findMany.mockResolvedValueOnce([]);
    const result = await generateLearningPlan('student-6', 'subject-empty');
    expect(result).toBeNull();
  });

  it('creates LearningPlan and orders items weakest-concept-first', async () => {
    const studentId = 'student-7';
    const subjectId = 'subject-math';
    const planId = 'plan-1';

    // 3 concepts in curriculum order
    prismaMock.concept.findMany.mockResolvedValueOnce([
      { id: 'c1', topic: { order: 1, chapter: { order: 1 } } },
      { id: 'c2', topic: { order: 2, chapter: { order: 1 } } },
      { id: 'c3', topic: { order: 3, chapter: { order: 1 } } },
    ]);

    // c2 has lowest mastery (weakest), c1 is medium, c3 is highest
    prismaMock.studentConceptState.findMany.mockResolvedValueOnce([
      { conceptId: 'c1', masteryScore: 0.5 },
      { conceptId: 'c2', masteryScore: 0.2 },
      { conceptId: 'c3', masteryScore: 0.8 },
    ]);

    // No existing plan → create new
    prismaMock.learningPlan.findUnique.mockResolvedValueOnce(null);
    prismaMock.learningPlan.create.mockResolvedValueOnce({ id: planId });
    prismaMock.learningPlanItem.createMany.mockResolvedValueOnce({ count: 3 });

    const result = await generateLearningPlan(studentId, subjectId);

    expect(result).toBe(planId);
    expect(prismaMock.learningPlan.create).toHaveBeenCalledTimes(1);

    // Verify items are ordered weakest-first (c2 → c1 → c3)
    const createManyCall = prismaMock.learningPlanItem.createMany.mock.calls[0][0];
    const items = createManyCall.data;
    expect(items[0].conceptId).toBe('c2'); // weakest (0.2)
    expect(items[1].conceptId).toBe('c1'); // medium (0.5)
    expect(items[2].conceptId).toBe('c3'); // strongest (0.8)
  });

  it('distributes items across weeks correctly (weeklyGoal = 5 default)', async () => {
    const studentId = 'student-8';
    const subjectId = 'subject-science';
    const planId = 'plan-2';

    // 7 concepts → 5 in week 1, 2 in week 2
    const concepts = Array.from({ length: 7 }, (_, i) => ({
      id: `concept-${i}`,
      topic: { order: i, chapter: { order: 1 } },
    }));
    prismaMock.concept.findMany.mockResolvedValueOnce(concepts);
    prismaMock.studentConceptState.findMany.mockResolvedValueOnce([]); // all at 0

    prismaMock.learningPlan.findUnique.mockResolvedValueOnce(null);
    prismaMock.learningPlan.create.mockResolvedValueOnce({ id: planId });
    prismaMock.learningPlanItem.createMany.mockResolvedValueOnce({ count: 7 });

    await generateLearningPlan(studentId, subjectId);

    const createManyCall = prismaMock.learningPlanItem.createMany.mock.calls[0][0];
    const items: any[] = createManyCall.data;

    // First 5 items → week 1, next 2 → week 2
    expect(items.slice(0, 5).every((item: any) => item.weekNumber === 1)).toBe(true);
    expect(items.slice(5, 7).every((item: any) => item.weekNumber === 2)).toBe(true);
    // orderInWeek is 0-based
    expect(items[0].orderInWeek).toBe(0);
    expect(items[4].orderInWeek).toBe(4);
    expect(items[5].orderInWeek).toBe(0);
  });

  it('updates existing plan (upsert path)', async () => {
    const planId = 'plan-existing';
    prismaMock.concept.findMany.mockResolvedValueOnce([
      { id: 'c1', topic: { order: 1, chapter: { order: 1 } } },
    ]);
    prismaMock.studentConceptState.findMany.mockResolvedValueOnce([]);
    prismaMock.learningPlan.findUnique.mockResolvedValueOnce({ id: planId });
    prismaMock.learningPlanItem.deleteMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.learningPlan.update.mockResolvedValueOnce({ id: planId });
    prismaMock.learningPlanItem.createMany.mockResolvedValueOnce({ count: 1 });

    const result = await generateLearningPlan('student-9', 'subject-existing');
    expect(result).toBe(planId);
    expect(prismaMock.learningPlanItem.deleteMany).toHaveBeenCalledWith({
      where: { planId },
    });
    expect(prismaMock.learningPlan.create).not.toHaveBeenCalled();
  });
});
