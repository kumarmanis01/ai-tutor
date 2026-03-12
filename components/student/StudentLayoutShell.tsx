'use client';

import React from 'react';
import ParentOTPGate from '@/components/student/ParentOTPGate';

interface StudentLayoutShellProps {
  showParentGate: boolean;
  maskedParentEmail: string | null;
  children: React.ReactNode;
}

export default function StudentLayoutShell({ showParentGate, maskedParentEmail, children }: StudentLayoutShellProps) {
  return (
    <div className="relative">
      {children}
      {showParentGate && maskedParentEmail && <ParentOTPGate maskedEmail={maskedParentEmail} />}
    </div>
  );
}

