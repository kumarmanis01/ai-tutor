/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/student/progress/export.
 * - Verifies auth guard, successful PDF response, and server-error handling.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/student/progress/export.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T09:00:00Z | copilot | created tests for progress export route while closing Gap 8
 */

const mockGetServerSessionForHandlers = jest.fn();
const mockStructuredSessionCount = jest.fn();
const mockUserFindUnique = jest.fn();
const mockSubjectDefFindMany = jest.fn();
const mockExportProgressReportToPDF = jest.fn();
const mockComputeReadinessScore = jest.fn();
const mockLoggerDebug = jest.fn();
const mockLoggerError = jest.fn();
const mockLogAuditEvent = jest.fn();

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: mockGetServerSessionForHandlers,
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    structuredSession: { count: mockStructuredSessionCount },
    user: { findUnique: mockUserFindUnique },
    subjectDef: { findMany: mockSubjectDefFindMany },
  },
}));

jest.mock('@/lib/exporters/pdf', () => ({
  exportProgressReportToPDF: mockExportProgressReportToPDF,
}));

jest.mock('@/lib/student/examReadiness', () => ({
  computeReadinessScore: mockComputeReadinessScore,
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: mockLoggerDebug,
    error: mockLoggerError,
  },
}));

jest.mock('@/lib/audit/log', () => ({
  logAuditEvent: mockLogAuditEvent,
}));

describe('GET /api/student/progress/export', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetServerSessionForHandlers.mockResolvedValue({ user: { id: 'student-1' } });
    mockStructuredSessionCount.mockResolvedValue(4);
    mockUserFindUnique.mockResolvedValue({ name: 'Aarav', subjects: ['Mathematics'] });
    mockSubjectDefFindMany.mockResolvedValue([{ id: 'sub-1', name: 'Mathematics' }]);
    mockComputeReadinessScore.mockResolvedValue({ score: 81.6 });
    mockExportProgressReportToPDF.mockResolvedValue(Uint8Array.from([1, 2, 3]));
  });

  it('should return 401 when session is missing', async () => {
    mockGetServerSessionForHandlers.mockResolvedValueOnce(null);

    const { GET } = await import('@/app/api/student/progress/export/route');
    const response = await GET(new Request('http://localhost/api/student/progress/export'));

    expect(response.status).toBe(401);
    expect(mockStructuredSessionCount).not.toHaveBeenCalled();
  });

  it('should return a PDF attachment on success', async () => {
    const { GET } = await import('@/app/api/student/progress/export/route');
    const response = await GET(new Request('http://localhost/api/student/progress/export'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('progress-report.pdf');
    expect(mockExportProgressReportToPDF).toHaveBeenCalledTimes(1);

    const body = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(body)).toEqual([1, 2, 3]);
  });

  it('should return 500 when PDF generation throws', async () => {
    mockExportProgressReportToPDF.mockRejectedValueOnce(new Error('pdf failure'));

    const { GET } = await import('@/app/api/student/progress/export/route');
    const response = await GET(new Request('http://localhost/api/student/progress/export'));

    expect(response.status).toBe(500);
    expect(mockLoggerError).toHaveBeenCalledWith(
      'progress export failed',
      expect.objectContaining({ error: expect.any(String) })
    );
  });
});
