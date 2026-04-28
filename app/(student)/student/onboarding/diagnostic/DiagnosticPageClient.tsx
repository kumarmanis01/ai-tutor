'use client';

/**
 * FILE OBJECTIVE:
 * - Client wrapper for the S1.3 diagnostic page. Renders QuickDiagnosticQuiz with
 *   server-resolved props (grade, board, studentId, accessToken).
 *   Separated from the server component to isolate client-only rendering.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/onboarding/diagnostic/DiagnosticPageClient.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | staff-engineer | created for S1.3 diagnostic onboarding step
 */

import QuickDiagnosticQuiz from '@/components/student/onboarding/QuickDiagnosticQuiz';

interface Props {
  grade: number;
  board: string;
  studentId: string;
  accessToken: string;
  selectedSubject?: string;
}

export default function DiagnosticPageClient({
  grade,
  board,
  studentId,
  accessToken,
  selectedSubject,
}: Props) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <QuickDiagnosticQuiz
        grade={grade}
        board={board}
        studentId={studentId}
        accessToken={accessToken}
        isExploreMode={false}
        selectedSubject={selectedSubject}
      />
    </div>
  );
}
