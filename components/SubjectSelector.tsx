/**
 * FILE OBJECTIVE:
 * - Legacy subject selector wrapper. New code should use SubjectSelect directly.
 * - Kept for backward compatibility with existing imports.
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | rewrote to delegate to SubjectSelect with user profile
 * - 2026-01-22 | copilot | initial hardcoded selector
 */

'use client';

import React from 'react';
import SubjectSelect from '@/components/SubjectSelect';
import useCurrentUser from '@/hooks/useCurrentUser';

export default function SubjectSelector({
  subject,
  setSubject,
}: {
  subject: string;
  setSubject: (s: string) => void;
}) {
  const { data: profile } = useCurrentUser();

  return (
    <SubjectSelect
      boardSlug={profile?.board ?? null}
      gradeNum={profile?.grade ?? null}
      value={subject}
      onChange={setSubject}
      showAll
      allLabel="All Subjects"
      className="border rounded p-2"
    />
  );
}
