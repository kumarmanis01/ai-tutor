/**
 * FILE OBJECTIVE:
 * - Shared, DB-driven subject dropdown for use across admin, dashboard, and student pages.
 * - Uses session-cached hierarchy for subjects based on board + grade.
 * - Replaces all hardcoded subject lists throughout the app.
 *
 * USAGE:
 *   <SubjectSelect
 *     boardSlug="CBSE"
 *     gradeNum="10"
 *     value={selectedSlug}
 *     onChange={(slug) => setSelected(slug)}
 *   />
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | created shared subject select component
 * - 2026-02-03 | claude | refactored to use session-cached hierarchy
 */

'use client';

import React from 'react';
import { useAcademicHierarchy } from '@/hooks/useAcademicHierarchy';

export interface SubjectSelectProps {
  /** Board slug (e.g. "CBSE", "ICSE", "STATE") */
  boardSlug: string | null | undefined;
  /** Grade number (e.g. "10" or 10) */
  gradeNum: string | number | null | undefined;
  /** Currently selected subject slug (or id, depending on valueKey) */
  value: string;
  /** Callback when selection changes */
  onChange: (value: string) => void;
  /** Which field to use as option value: "slug" (default) or "id" */
  valueKey?: 'slug' | 'id';
  /** Placeholder text for the empty option */
  placeholder?: string;
  /** Include an "All Subjects" option at the top */
  showAll?: boolean;
  /** Label for the "All" option */
  allLabel?: string;
  /** Additional className for the <select> element */
  className?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
}

export default function SubjectSelect({
  boardSlug,
  gradeNum,
  value,
  onChange,
  valueKey = 'slug',
  placeholder = 'Select Subject',
  showAll = false,
  allLabel = 'All Subjects',
  className = '',
  disabled = false,
}: SubjectSelectProps) {
  const { loading, helpers } = useAcademicHierarchy();
  
  // Parse gradeNum to number if string
  const gradeNumParsed = typeof gradeNum === 'string' ? parseInt(gradeNum, 10) : gradeNum;
  const subjects = helpers.getSubjectsForGrade(boardSlug, gradeNumParsed);

  const isDisabled = disabled || !boardSlug || !gradeNum;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isDisabled}
      className={`px-3 py-2 border rounded ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      {loading ? (
        <option value="">Loading subjects...</option>
      ) : subjects.length === 0 ? (
        <option value="">
          {!boardSlug || !gradeNum ? 'Select board & grade first' : 'No subjects found'}
        </option>
      ) : (
        <>
          {showAll && <option value="">{allLabel}</option>}
          {!showAll && !value && <option value="">{placeholder}</option>}
          {subjects.map((s) => (
            <option key={s.id} value={s[valueKey]}>
              {s.name}
            </option>
          ))}
        </>
      )}
    </select>
  );
}
