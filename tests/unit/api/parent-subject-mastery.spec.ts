/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logAPI: jest.fn(),
  },
}));
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock';
import '../../helpers/mockSession';

const PARENT_ID = 'parent-1';
const STUDENT_ID = 'student-1';

describe('GET /api/parent/subject-mastery', () => {
  beforeEach(() => {
    resetPrismaMock();
    (global as any).__TEST_SESSION__ = { user: { id: PARENT_ID, role: 'parent' } };
  });

  it('should return 401 when unauthenticated', async () => {
    (global as any).__TEST_SESSION__ = null;
    const { GET } = await import('@/app/api/parent/subject-mastery/route');
    const req = new Request(`http://localhost?studentId=${STUDENT_ID}`);
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('should return 400 when studentId is missing', async () => {
    const { GET } = await import('@/app/api/parent/subject-mastery/route');
    const req = new Request('http://localhost');
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it('should return 403 when student is not linked to parent', async () => {
    prismaMock.parentStudent.findUnique.mockResolvedValue(null);
    const { GET } = await import('@/app/api/parent/subject-mastery/route');
    const req = new Request(`http://localhost?studentId=${STUDENT_ID}`);
    const res = await GET(req as any);
    expect(res.status).toBe(403);
  });

  it('should return empty array when student has no mastery data', async () => {
    prismaMock.parentStudent.findUnique.mockResolvedValue({ status: 'active' } as any);
    prismaMock.user.findUnique.mockResolvedValue({ grade: '10' } as any);
    prismaMock.studentTopicMastery.groupBy.mockResolvedValueOnce([]); // subject level
    const { GET } = await import('@/app/api/parent/subject-mastery/route');
    const req = new Request(`http://localhost?studentId=${STUDENT_ID}`);
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it('should return chapter breakdown with predictedMarkRange and masteryExplanation', async () => {
    prismaMock.parentStudent.findUnique.mockResolvedValue({ status: 'active' } as any);
    prismaMock.user.findUnique.mockResolvedValue({ grade: '10' } as any);

    // Subject-level groupBy
    prismaMock.studentTopicMastery.groupBy
      .mockResolvedValueOnce([
        { subject: 'Mathematics', _avg: { accuracy: 0.72 }, _count: { topicId: 8 } },
      ])
      // Chapter-level groupBy
      .mockResolvedValueOnce([
        {
          subject: 'Mathematics',
          chapter: 'Algebra',
          _avg: { accuracy: 0.85 },
          _count: { topicId: 3 },
        },
        {
          subject: 'Mathematics',
          chapter: 'Trigonometry',
          _avg: { accuracy: 0.6 },
          _count: { topicId: 3 },
        },
        {
          subject: 'Mathematics',
          chapter: 'Statistics',
          _avg: { accuracy: 0.55 },
          _count: { topicId: 2 },
        },
      ]);

    prismaMock.learningPlanItem.findMany.mockResolvedValue([
      { concept: { chapter: 'Trigonometry' } },
    ] as any);

    const { GET } = await import('@/app/api/parent/subject-mastery/route');
    const req = new Request(`http://localhost?studentId=${STUDENT_ID}`);
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toHaveLength(1);
    const subject = data[0];
    expect(subject.subject).toBe('Mathematics');
    expect(subject.avgAccuracy).toBe(0.72);

    // Predicted mark range: 72% score => predictMarkRange(72) => delta=max(6, round(72*0.08))=max(6,6)=6 => [66,78]
    expect(subject.predictedMarkRange).toHaveLength(2);
    expect(subject.predictedMarkRange[0]).toBeLessThan(subject.predictedMarkRange[1]);

    // Tooltip text
    expect(subject.masteryExplanation).toContain('72%');
    expect(subject.masteryExplanation).toContain('Class 10');
    expect(subject.masteryExplanation).toContain('Mathematics');

    // Chapter breakdown
    expect(subject.chapters).toHaveLength(3);
    // Sorted by accuracy desc
    expect(subject.chapters[0].chapter).toBe('Algebra');

    // Top strengths = top 3 by accuracy
    expect(subject.topStrengths).toHaveLength(3);
    expect(subject.topStrengths[0].chapter).toBe('Algebra');

    // Top weaknesses = bottom 3 by accuracy, all aiWorking=true
    expect(subject.topWeaknesses).toHaveLength(3);
    expect(subject.topWeaknesses.every((w: any) => w.aiWorking === true)).toBe(true);
    expect(subject.topWeaknesses[0].chapter).toBe('Statistics');
  });

  it('should respect locale=hi for masteryExplanation prefix', async () => {
    prismaMock.parentStudent.findUnique.mockResolvedValue({ status: 'active' } as any);
    prismaMock.user.findUnique.mockResolvedValue({ grade: '10' } as any);
    prismaMock.studentTopicMastery.groupBy
      .mockResolvedValueOnce([
        { subject: 'Mathematics', _avg: { accuracy: 0.5 }, _count: { topicId: 4 } },
      ])
      .mockResolvedValueOnce([]);
    prismaMock.learningPlanItem.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/parent/subject-mastery/route');
    const req = new Request(`http://localhost?studentId=${STUDENT_ID}&locale=hi`);
    const res = await GET(req as any);
    const data = await res.json();
    expect(data[0].masteryExplanation).toContain('\u0907\u0938\u0915\u093e'); // Hindi prefix
  });
});
