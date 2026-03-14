'use client';

import React from 'react';
import ParentOTPGate from '@/components/student/ParentOTPGate';
import ProfileCompletionGate from '@/components/student/ProfileCompletionGate';
import type { StudentProfileData } from '@/lib/student/profileGuard';

interface StudentLayoutShellProps {
  showParentGate: boolean;
  maskedParentEmail: string | null;
  showProfileGate?: boolean;
  profileData?: StudentProfileData;
  children: React.ReactNode;
}

export default function StudentLayoutShell({
  showParentGate,
  maskedParentEmail,
  showProfileGate,
  profileData,
  children,
}: StudentLayoutShellProps) {
  return (
    <div className="relative">
      {children}
      {showProfileGate && !showParentGate && (
        <ProfileCompletionGate profileData={profileData ?? { board: null, grade: null, language: null, subjects: [] }} />
      )}
      {showParentGate && maskedParentEmail && <ParentOTPGate maskedEmail={maskedParentEmail} />}
    </div>
  );
}

