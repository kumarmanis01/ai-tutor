/**
 * Unit tests for POST /api/student/onboarding/generate-plan
 *
 * Verifies the grade+board filter fix:
 *   - SubjectDef lookup must use student's exact grade + board
 *   - Capitalised slugs ('Mathematics') must be normalised before query
 *   - Response includes diagnosticReady flag based on question availability
 */

// ---------------------------------------------------------------------------
// Mocks -- must come before module imports
// ---------------------------------------------------------------------------

const prismaMock = {
  studentLearningProfile: { upsert: jest.fn(), findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  subjectDef: { findMany: jest.fn() },
  topicDef: { findMany: jest.fn() },
  question: { count: jest.fn() },
  generatedQuestion: { count: jest.fn() },
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

const TOPIC_IDS = ['topic-1', 'topic-2'];

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.studentLearningProfile.upsert.mockResolvedValue({});
  prismaMock.studentLearningProfile.findUnique.mockResolvedValue(null);
  // Default: topics exist and questions are available
  prismaMock.topicDef.findMany.mockResolvedValue(TOPIC_IDS.map((id) => ({ id })));
  prismaMock.question.count.mockResolvedValue(5);
  prismaMock.generatedQuestion.count.mockResolvedValue(0);
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
      { id: 'grade6-english-id', slug: 'english', name: 'English' },
      { id: 'grade6-math-id', slug: 'mathematics', name: 'Mathematics' },
    ]);

    const req = makeRequest({ studyDaysPerWeek: 5 });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.firstSubjectId).toBe('grade6-english-id');
    expect(typeof json.diagnosticReady).toBe('boolean');

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
    const grade6EnglishId = 'subject-cbse-6-english';
    prismaMock.subjectDef.findMany.mockResolvedValueOnce([
      { id: grade6EnglishId, slug: 'english', name: 'English' },
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
      { id: 'sub-math-8', slug: 'mathematics', name: 'Mathematics' },
    ]);

    const req = makeRequest({ studyDaysPerWeek: 5 });
    await POST(req);

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
    // All three fallback attempts return nothing
    prismaMock.subjectDef.findMany.mockResolvedValue([]);

    const req = makeRequest({ studyDaysPerWeek: 5 });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.firstSubjectId).toBeNull();
    // diagnosticReady must be false when no subject was resolved
    expect(json.diagnosticReady).toBe(false);
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

// ---------------------------------------------------------------------------
// diagnosticReady flag tests
// ---------------------------------------------------------------------------

describe('generate-plan -- diagnosticReady flag', () => {
  const SUBJECT = { id: 'sub-math', slug: 'mathematics', name: 'Mathematics' };

  function setupUser() {
    prismaMock.user.findUnique.mockResolvedValue({
      subjects: ['mathematics'],
      grade: '10',
      board: 'cbse',
    });
    prismaMock.subjectDef.findMany.mockResolvedValue([SUBJECT]);
  }

  it('should return diagnosticReady:true when Question table has ACTIVE records for topics', async () => {
    setupUser();
    prismaMock.topicDef.findMany.mockResolvedValue([{ id: 'topic-1' }]);
    prismaMock.question.count.mockResolvedValue(10);

    const json = await POST(makeRequest({ studyDaysPerWeek: 5 })).then((r) => r.json());

    expect(json.diagnosticReady).toBe(true);
    expect(json.firstSubjectId).toBe(SUBJECT.id);
  });

  it('should return diagnosticReady:true when Question table empty but GeneratedQuestion has rows', async () => {
    setupUser();
    prismaMock.topicDef.findMany.mockResolvedValue([{ id: 'topic-1' }]);
    prismaMock.question.count.mockResolvedValue(0);
    prismaMock.generatedQuestion.count.mockResolvedValue(3);

    const json = await POST(makeRequest({ studyDaysPerWeek: 5 })).then((r) => r.json());

    expect(json.diagnosticReady).toBe(true);
  });

  it('should return diagnosticReady:false when both Question and GeneratedQuestion are empty', async () => {
    setupUser();
    prismaMock.topicDef.findMany.mockResolvedValue([{ id: 'topic-1' }]);
    prismaMock.question.count.mockResolvedValue(0);
    prismaMock.generatedQuestion.count.mockResolvedValue(0);

    const json = await POST(makeRequest({ studyDaysPerWeek: 5 })).then((r) => r.json());

    expect(json.diagnosticReady).toBe(false);
  });

  it('should return diagnosticReady:false when no topics exist for the subject', async () => {
    setupUser();
    prismaMock.topicDef.findMany.mockResolvedValue([]);

    const json = await POST(makeRequest({ studyDaysPerWeek: 5 })).then((r) => r.json());

    expect(json.diagnosticReady).toBe(false);
    // question.count should not be called when there are no topics
    expect(prismaMock.question.count).not.toHaveBeenCalled();
  });

  it('should return diagnosticReady:false (not throw) when readiness check errors', async () => {
    setupUser();
    prismaMock.topicDef.findMany.mockRejectedValue(new Error('DB timeout'));

    const res = await POST(makeRequest({ studyDaysPerWeek: 5 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.diagnosticReady).toBe(false);
  });

  it('should not register any Redis notify key -- notification is strictly user-initiated', async () => {
    setupUser();
    prismaMock.topicDef.findMany.mockResolvedValue([]);
    prismaMock.question.count.mockResolvedValue(0);
    prismaMock.generatedQuestion.count.mockResolvedValue(0);

    // No Redis mock needed -- if generate-plan tries to use Redis without a mock
    // the test will throw, confirming the auto-registration was removed.
    const res = await POST(makeRequest({ studyDaysPerWeek: 5 }));
    expect(res.status).toBe(200);
  });
});
