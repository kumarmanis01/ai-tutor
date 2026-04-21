/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Unit tests for POST /api/student/diagnostic/trigger-generation
 *
 * The route delegates job creation to enqueueSubjectHydration, so that helper
 * is mocked here. Its own behaviour is covered in
 * tests/unit/lib/diagnostics/enqueueSubjectHydration.spec.ts
 *
 * See: docs/v2/on-demand-generator.md
 */

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/diagnostics/enqueueSubjectHydration', () => ({
  enqueueSubjectHydration: jest.fn(),
}));

import { describe, it, expect, beforeEach } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock';

const USER_ID = 'student-1';
const SUBJECT_ID = 'subject-abc';

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/student/diagnostic/trigger-generation', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/student/diagnostic/trigger-generation', () => {
  let getServerSessionForHandlers: jest.Mock;
  let enqueueSubjectHydration: jest.Mock;

  beforeEach(() => {
    resetPrismaMock();
    getServerSessionForHandlers = require('@/lib/session').getServerSessionForHandlers;
    getServerSessionForHandlers.mockResolvedValue({ user: { id: USER_ID } });
    enqueueSubjectHydration = require('@/lib/diagnostics/enqueueSubjectHydration').enqueueSubjectHydration;
    enqueueSubjectHydration.mockReset();
  });

  it('should return 401 when unauthenticated', async () => {
    getServerSessionForHandlers.mockResolvedValue(null);
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(res.status).toBe(401);
  });

  it('should return 400 when subjectId is missing', async () => {
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({}) as any);
    expect(res.status).toBe(400);
  });

  it('should return phase "questions" and not call helper when topics already exist', async () => {
    prismaMock.topicDef.count.mockResolvedValue(10);
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ triggered: false, phase: 'questions' });
    expect(enqueueSubjectHydration).not.toHaveBeenCalled();
  });

  it('should return triggered:true with jobId when helper creates a new job', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    prismaMock.user.findUnique.mockResolvedValue({ language: 'en' });
    enqueueSubjectHydration.mockResolvedValue({ triggered: true, jobId: 'new-job-1' });
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ triggered: true, phase: 'topics', jobId: 'new-job-1' });
    expect(enqueueSubjectHydration).toHaveBeenCalledWith(SUBJECT_ID, 'en', 'student_on_demand');
  });

  it('should return triggered:false with existing jobId when a job is already running', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    prismaMock.user.findUnique.mockResolvedValue({ language: 'hi' });
    enqueueSubjectHydration.mockResolvedValue({ triggered: false, jobId: 'existing-job-1' });
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ triggered: false, phase: 'topics', jobId: 'existing-job-1' });
  });

  it('should return 404 when helper finds no SubjectDef', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    prismaMock.user.findUnique.mockResolvedValue({ language: 'en' });
    enqueueSubjectHydration.mockResolvedValue({ triggered: false, jobId: null });
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(res.status).toBe(404);
  });

  it('should default language to en when student has no language set', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    prismaMock.user.findUnique.mockResolvedValue({ language: null });
    enqueueSubjectHydration.mockResolvedValue({ triggered: true, jobId: 'job-x' });
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(enqueueSubjectHydration).toHaveBeenCalledWith(SUBJECT_ID, 'en', 'student_on_demand');
  });

  it('should return 500 when DB throws', async () => {
    prismaMock.topicDef.count.mockRejectedValue(new Error('DB error'));
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(res.status).toBe(500);
  });
});
