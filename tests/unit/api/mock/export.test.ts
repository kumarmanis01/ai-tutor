/**
 * Unit tests for mock export PDF endpoint
 */
jest.mock('@/lib/prisma', () => ({
  prisma: { mockExam: { findUnique: jest.fn() } },
}));

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({ allowRequest: jest.fn().mockReturnValue(true) }));
jest.mock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), error: jest.fn() } }));

const { prisma } = require('@/lib/prisma');
const { getServerSessionForHandlers } = require('@/lib/session');

import { GET } from '@/app/api/mock/[examId]/export/route';

describe('Mock export PDF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns PDF for a valid mock exam', async () => {
    const examRecord = {
      id: 'exam-1',
      title: 'Math Mock -- Paper 1',
      subject: { name: 'Math' },
      sections: [
        {
          id: 'sec-1',
          title: 'Section A',
          totalMarks: 20,
          questions: [
            { order: 1, marks: 1, question: { prompt: 'What is 2+2?' } },
            { order: 2, marks: 1, question: { prompt: 'What is 3+5?' } },
          ],
        },
      ],
    };

    prisma.mockExam.findUnique.mockResolvedValueOnce(examRecord);
    getServerSessionForHandlers.mockResolvedValue({ user: { id: 'student-1' } });

    const req = new Request('http://localhost/api/mock/exam-1/export');
    const res = await GET(req, { params: { examId: 'exam-1' } } as any);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    const cd = res.headers.get('Content-Disposition') || '';
    expect(cd).toContain('attachment');
    expect(cd).toContain('.pdf');
  });
});
