/**
 * FILE OBJECTIVE:
 * - Student greeting header with name, grade, and board display.
 * - Shows time-appropriate greeting (morning/afternoon/evening).
 * - Non-editable profile info shown here (editing via Profile tab).
 *
 * LINKED UNIT TEST:
 * - __tests__/app/dashboard/components/home/StudentGreeting.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created for student dashboard PRD refactor
 */
'use client';

import React, { useMemo } from 'react';
import useCurrentUser from '@/hooks/useCurrentUser';

/** Get time-appropriate greeting */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function StudentGreeting() {
  const { data: profile, loading } = useCurrentUser();
  
  const greeting = useMemo(() => getGreeting(), []);
  const firstName = profile?.name?.split(' ')[0] || 'Student';
  const grade = profile?.grade;
  const board = profile?.board;

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-48 mb-2" />
        <div className="h-4 bg-muted rounded w-32" />
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Main Greeting */}
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
        {greeting}, <span className="text-primary">{firstName}</span> 👋
      </h1>
      
      {/* Grade & Board - Non-editable info */}
      {(grade || board) && (
        <div className="flex items-center gap-2 mt-2">
          {grade && (
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Grade {grade}
            </span>
          )}
          {board && (
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
              {board}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default StudentGreeting;
