jest.mock('@/lib/diagnostics/stateStore', () => ({
  getSubjectDiagnosticStatus: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: { studentConceptState: { count: jest.fn() } },
}));

import { hasDiagnosticForSubject } from '@/lib/student/diagnosticGuard';
import { getSubjectDiagnosticStatus } from '@/lib/diagnostics/stateStore';
import { prisma } from '@/lib/prisma';

const mockedStatus = getSubjectDiagnosticStatus as unknown as jest.Mock;
const mockedCount = (prisma as any).studentConceptState.count as jest.Mock;

describe('hasDiagnosticForSubject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns true when statusRecord.status is completed', async () => {
    mockedStatus.mockResolvedValueOnce({ status: 'completed' });
    const res = await hasDiagnosticForSubject('stu-1', 'subj-1');
    expect(res).toBe(true);
    expect(mockedCount).not.toHaveBeenCalled();
  });

  test('returns true when status not completed but studentConceptState.count > 0', async () => {
    mockedStatus.mockResolvedValueOnce({ status: 'in_progress' });
    mockedCount.mockResolvedValueOnce(3);
    const res = await hasDiagnosticForSubject('stu-2', 'subj-2');
    expect(res).toBe(true);
    expect(mockedCount).toHaveBeenCalled();
  });

  test('returns false when neither status nor concept rows exist', async () => {
    mockedStatus.mockResolvedValueOnce({ status: 'not_started' });
    mockedCount.mockResolvedValueOnce(0);
    const res = await hasDiagnosticForSubject('stu-3', 'subj-3');
    expect(res).toBe(false);
  });
});
