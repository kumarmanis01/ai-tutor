/**
 * FILE OBJECTIVE:
 * - Render the student layout shell and overlay parent verification gate when required.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/StudentLayoutShell.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | simplify shell props by removing profile gate overlay wiring
 */

'use client';

import React from 'react';
import ParentOTPGate from '@/components/student/ParentOTPGate';

interface StudentLayoutShellProps {
  showParentGate: boolean;
  maskedParentEmail: string | null;
  children: React.ReactNode;
}

export default function StudentLayoutShell({
  showParentGate,
  maskedParentEmail,
  children,
}: StudentLayoutShellProps) {
  return (
    <div className="relative">
      {children}
      {showParentGate && maskedParentEmail && <ParentOTPGate maskedEmail={maskedParentEmail} />}
    </div>
  );
}
