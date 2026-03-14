'use client';

import React from 'react';
import ParentOTPGate from '@/components/student/ParentOTPGate';
import ProfileCompletionGate from '@/components/student/ProfileCompletionGate';
import type { ProfileMissingField } from '@/lib/student/profileGuard';

interface StudentLayoutShellProps {
  showParentGate: boolean;
  maskedParentEmail: string | null;
  showProfileGate?: boolean;
  missingProfileFields?: ProfileMissingField[];
  children: React.ReactNode;
}

export default function StudentLayoutShell({
  showParentGate,
  maskedParentEmail,
  showProfileGate,
  missingProfileFields,
  children,
}: StudentLayoutShellProps) {
  return (
    <div className="relative">
      {children}
      {showProfileGate && !showParentGate && (
        <ProfileCompletionGate missingFields={missingProfileFields ?? []} />
      )}
      {showParentGate && maskedParentEmail && <ParentOTPGate maskedEmail={maskedParentEmail} />}
    </div>
  );
}

