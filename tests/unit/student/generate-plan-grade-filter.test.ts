/**
 * Unit tests for POST /api/student/onboarding/generate-plan
 *
 * Verifies the grade+board filter fix:
 *   - SubjectDef lookup must use student's exact grade + board
 *   - Capitalised slugs ('Mathematics') must be normalised before query
 */

// ---------------------------------------------------------------------------
// Mocks -- must come before module imports
// ---------------------------------------------------------------------------

const prismaMock = {
  studentLearningProfile: { upsert: jest.fn(), findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  subjectDef: { findMany: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() },
}));
jest.mock('@/lib/errorResponse', () => ({ formatErrorForResponse: (e: unknown) => String(e) }));
jest.mock('@/lib/ai/learningPlan', () => ({
  generateLearningPlan: jest.fn().mockResolvedValue('plan-id'),
}));

// Auth mock: return a session with userId 'test-student'
jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn().mockResolvedValue({
    user: { id: 'test-student' },
  }),
}));

import { POST } from '@/app/api/student/onboarding/generate-plan/route';
import { NextRequest } from 'next/server';

function makeRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/student/onboarding/generate-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.studentLearningProfile.upsert.mockResolvedValue({});
  prismaMock.studentLearningProfile.findUnique.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Grade filter tests
// ---------------------------------------------------------------------------

describe('generate-plan -- SubjectDef grade+board filter', () => {
  it('should query SubjectDef with student grade and board, not without', async () => {
    // Grade 6 student with CBSE board
    prismaMock.user.findUnique.mockResolvedValueOnce({
      subjects: ['english', 'mathematics'],
      grade: '6',
      board: 'cbse',
    });
    prismaMock.subjectDef.findMany.mockResolvedValueOnce([
      { id: 'grade6-english-id', slug: 'english' },
      { id: 'grade6-math-id', slug: 'mathematics' },
    ]);

    const req = makeRequest({ studyDaysPerWeek: 5 });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.firstSubjectId).toBe('grade6-english-id');

    // The subjectDef query MUST include grade and board filters
    const findManyCall = prismaMock.subjectDef.findMany.mock.calls[0][0];
    expect(findManyCall.where.class).toBeDefined();
    expect(findManyCall.where.class.grade).toBe(6);
    expect(findManyCall.where.class.board.slug.equals).toBe('cbse');
  });

  it('should return Grade 6 SubjectDef ID, not Grade 1, when both exist in DB', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      subjects: ['english'],
      grade: '6',
      board: 'cbse',
    });
    // Mock returns only grade 6 english (grade filter excludes grade 1)
    const grade6EnglishId = 'subject-cbse-6-english';
    prismaMock.subjectDef.findMany.mockResolvedValueOnce([
      { id: grade6EnglishId, slug: 'english' },
    ]);

    const req = makeRequest({ studyDaysPerWeek: 5 });
    const res = await POST(req);
    const json = await res.json();

    expect(json.firstSubjectId).toBe(grade6EnglishId);
    expect(json.firstSubjectId).not.toBe('subject-cbse-1-english');
  });

  it('should normalise capitalised slugs to lowercase before querying', async () => {
    // User has stored 'Mathematics', 'Science' (capitalised -- legacy data)
    prismaMock.user.findUnique.mockResolvedValueOnce({
      subjects: ['Mathematics', 'Science'],
      grade: '8',
      board: 'cbse',
    });
    prismaMock.subjectDef.findMany.mockResolvedValueOnce([
      { id: 'sub-math-8', slug: 'mathematics' },
    ]);

    const req = makeRequest({ studyDaysPerWeek: 5 });
    const postRes = await POST(req);
    const postJson = await postRes.json();

    const findManyCall = prismaMock.subjectDef.findMany.mock.calls[0][0];
    // Query slugs must be lowercase
    expect(findManyCall.where.slug.in).toEqual(['mathematics', 'science']);
  });

  it('should return firstSubjectId null and not throw when no SubjectDef matches', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      subjects: ['english'],
      grade: '6',
      board: 'cbse',
    });
    // No subjects found (e.g. taxonomy not seeded for this grade)
    prismaMock.subjectDef.findMany.mockResolvedValueOnce([]);

    const req = makeRequest({ studyDaysPerWeek: 5 });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.firstSubjectId).toBeNull();
  });

  it('should skip SubjectDef query and return null firstSubjectId when student has no grade', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      subjects: ['english'],
      grade: null,
      board: 'cbse',
    });

    const req = makeRequest({ studyDaysPerWeek: 5 });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.firstSubjectId).toBeNull();
    // findMany must NOT have been called without grade
    expect(prismaMock.subjectDef.findMany).not.toHaveBeenCalled();
  });
});
