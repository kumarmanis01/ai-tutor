import { jest } from '@jest/globals';

describe('Diagnostic start analytics emission', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('enqueues diagnostic_started when analytics queue available', async () => {
    const addMock = jest.fn().mockResolvedValue(undefined);

    jest.doMock('@/lib/queues/analyticsQueue', () => ({
      getAnalyticsQueue: () => ({ add: addMock }),
    }));

    // minimal mocks for route dependencies
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'u1' } }),
    }));

    jest.doMock('@/lib/diagnostics/diagnosticQuestionService', () => ({
      generateSubjectDiagnosticTest: jest.fn().mockResolvedValue({
        id: 'test1',
        subjectId: 's1',
        subjectName: 'Mathematics',
        questions: [{ id: 'q1' }, { id: 'q2' }],
      }),
    }));

    jest.doMock('@/lib/diagnostics/stateStore', () => ({
      getSubjectDiagnosticStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
      upsertSubjectDiagnosticStatus: jest.fn().mockResolvedValue({}),
    }));

    jest.doMock('@/lib/diagnostics/sessionStore', () => ({
      createSession: jest.fn().mockResolvedValue(undefined),
    }));

    jest.doMock('@/jobs/diagnosticAutoSubmit', () => ({
      enqueueDiagnosticAutoSubmit: jest.fn().mockResolvedValue(undefined),
    }));

    const { POST } = await import('app/api/student/diagnostic/start/route');

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ boardSlug: 'cbse', grade: 9, subjectSlug: 'math' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req as any);

    expect(addMock).toHaveBeenCalled();
    const call = addMock.mock.calls[0][1] || addMock.mock.calls[0][0];
    // the route either calls add(name, data) or add(data) depending on queue lib
    const jobData = call?.data ?? call;
    expect(jobData.eventType).toBe('diagnostic_started');
    expect(jobData.metadata).toMatchObject({ subjectId: 's1', totalQuestions: 2 });
    expect(typeof jobData.metadata.sessionId).toBe('string');
    expect(res.status).toBe(200);
  });

  test('falls back to DB when analytics queue unavailable', async () => {
    jest.doMock('@/lib/queues/analyticsQueue', () => ({
      getAnalyticsQueue: () => null,
    }));

    const prismaCreateMock = jest.fn().mockResolvedValue({});
    jest.doMock('@/lib/prisma', () => ({
      prisma: { analyticsEvent: { create: prismaCreateMock } },
    }));

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'u1' } }),
    }));

    jest.doMock('@/lib/diagnostics/diagnosticQuestionService', () => ({
      generateSubjectDiagnosticTest: jest.fn().mockResolvedValue({
        id: 'test1',
        subjectId: 's1',
        subjectName: 'Mathematics',
        questions: [{ id: 'q1' }],
      }),
    }));

    jest.doMock('@/lib/diagnostics/stateStore', () => ({
      getSubjectDiagnosticStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
      upsertSubjectDiagnosticStatus: jest.fn().mockResolvedValue({}),
    }));

    jest.doMock('@/lib/diagnostics/sessionStore', () => ({
      createSession: jest.fn().mockResolvedValue({}),
    }));

    jest.doMock('@/jobs/diagnosticAutoSubmit', () => ({
      enqueueDiagnosticAutoSubmit: jest.fn().mockResolvedValue(undefined),
    }));

    const { POST } = await import('app/api/student/diagnostic/start/route');

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ boardSlug: 'cbse', grade: 9, subjectSlug: 'math' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req as any);

    expect(prismaCreateMock).toHaveBeenCalled();
    const created = prismaCreateMock.mock.calls[0][0];
    expect(created.data.eventType).toBe('diagnostic_started');
    expect(created.data.metadata).toMatchObject({ subjectId: 's1', totalQuestions: 1 });
    expect(typeof created.data.metadata.sessionId).toBe('string');
    expect(res.status).toBe(200);
  });

  test('falls back to DB when analytics enqueue throws', async () => {
    const addMock = jest.fn().mockRejectedValue(new Error('enqueue-failure'));
    jest.doMock('@/lib/queues/analyticsQueue', () => ({
      getAnalyticsQueue: () => ({ add: addMock }),
    }));

    const prismaCreateMock = jest.fn().mockResolvedValue({});
    jest.doMock('@/lib/prisma', () => ({
      prisma: { analyticsEvent: { create: prismaCreateMock } },
    }));

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'u1' } }),
    }));

    jest.doMock('@/lib/diagnostics/diagnosticQuestionService', () => ({
      generateSubjectDiagnosticTest: jest.fn().mockResolvedValue({
        id: 'test1',
        subjectId: 's1',
        subjectName: 'Mathematics',
        questions: [{ id: 'q1' }],
      }),
    }));

    jest.doMock('@/lib/diagnostics/stateStore', () => ({
      getSubjectDiagnosticStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
      upsertSubjectDiagnosticStatus: jest.fn().mockResolvedValue({}),
    }));

    jest.doMock('@/lib/diagnostics/sessionStore', () => ({
      createSession: jest.fn().mockResolvedValue({}),
    }));

    jest.doMock('@/jobs/diagnosticAutoSubmit', () => ({
      enqueueDiagnosticAutoSubmit: jest.fn().mockResolvedValue(undefined),
    }));

    const { POST } = await import('app/api/student/diagnostic/start/route');

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ boardSlug: 'cbse', grade: 9, subjectSlug: 'math' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req as any);

    expect(prismaCreateMock).toHaveBeenCalled();
    const created = prismaCreateMock.mock.calls[0][0];
    expect(created.data.eventType).toBe('diagnostic_started');
    expect(created.data.metadata).toMatchObject({ subjectId: 's1', totalQuestions: 1 });
    expect(typeof created.data.metadata.sessionId).toBe('string');
    expect(res.status).toBe(200);
  });
});
