'use client';

import React from 'react';
import ParentOTPGate from '@/components/student/ParentOTPGate';
import ProfileCompletionGate from '@/components/student/ProfileCompletionGate';
import type { StudentProfileData } from '@/lib/student/profileGuard';

interface StudentLayoutShellProps {
  showParentGate: boolean;
  maskedParentEmail: string | null;
  showProfileGate?: boolean;
  initialProfileData?: StudentProfileData;
  children: React.ReactNode;
}

export default function StudentLayoutShell({
  showParentGate,
  maskedParentEmail,
  showProfileGate,
  initialProfileData,
  children,
}: StudentLayoutShellProps) {
  return (
    <div className="relative">
      {children}
      {showProfileGate && !showParentGate && (
        <ProfileCompletionGate initialValues={initialProfileData} />
      )}
      {showParentGate && maskedParentEmail && <ParentOTPGate maskedEmail={maskedParentEmail} />}
    </div>
  );
}
