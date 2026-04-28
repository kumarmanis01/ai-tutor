'use client';

/**
 * Client wrapper for the diagnostic page -- renders QuickDiagnosticQuiz.
 * Separated from the server component so we can use client-only hooks.
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
