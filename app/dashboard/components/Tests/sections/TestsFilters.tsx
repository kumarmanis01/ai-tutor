/**
 * FILE OBJECTIVE:
 * - Filter controls for the Tests tab with DB-driven subject dropdown.
 * - Subject list fetched dynamically based on user's board + grade.
 * - Triggers data refresh via TestsProvider when filters change.
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | replaced hardcoded subjects with SubjectSelect
 * - 2026-01-22 | copilot | initial filter stub
 */

'use client';

import React, { useState, useCallback } from 'react';
import SubjectSelect from '@/components/SubjectSelect';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useTests } from '../context/TestsProvider';

export function TestsFilters() {
  const { data: profile } = useCurrentUser();
  const { refresh } = useTests();
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('');

  const boardSlug = profile?.board ?? null;
  const gradeNum = profile?.grade ?? null;

  const handleSubjectChange = useCallback(
    (slug: string) => {
      setSubject(slug);
      if (slug) {
        refresh(slug, gradeNum ? String(gradeNum) : undefined, boardSlug ?? undefined);
      }
    },
    [refresh, gradeNum, boardSlug],
  );

  return (
    <div className="flex items-center gap-2">
      <SubjectSelect
        boardSlug={boardSlug}
        gradeNum={gradeNum}
        value={subject}
        onChange={handleSubjectChange}
        showAll
        allLabel="All Subjects"
        className="px-3 py-2 border rounded"
      />
      <select
        value={difficulty}
        onChange={(e) => setDifficulty(e.target.value)}
        className="px-3 py-2 border rounded"
      >
        <option value="">All Levels</option>
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
    </div>
  );
}
