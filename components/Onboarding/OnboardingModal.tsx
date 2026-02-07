/**
 * FILE OBJECTIVE:
 * - Onboarding modal for new users to set up their profile.
 * - Uses cascading filters for Language → Board → Grade → Subjects selection.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Onboarding/OnboardingModal.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | upgraded to use DB-driven cascading dropdowns
 * - 2026-02-03 | claude | refactored to use session-cached hierarchy hook
 */

"use client";
import React, { useState, useEffect } from 'react';
import { useAcademicHierarchy } from '@/hooks/useAcademicHierarchy';
import { LANGUAGES } from '@/components/CascadingFilters';

type Props = {
  open: boolean;
  required?: boolean;
  values: {
    name: string;
    class_grade: string | null;
    board: string | null;
    preferred_language: string | null;
    subjects: string[] | undefined;
  };
  errors?: Record<string, string>;
  loading?: boolean;
  saving?: boolean;
  onChange: (field: keyof Props['values'], value: any) => void;
  onClose: () => void;
  onSave: () => void;
};

export default function OnboardingModal({ open, required, values, errors = {}, saving, onChange, onClose, onSave }: Props) {
  // Single hierarchy fetch with session caching
  const { loading: hierarchyLoading, helpers } = useAcademicHierarchy();
  
  // Derive dropdown data from cached hierarchy
  const boards = helpers.getBoards();
  const grades = helpers.getGradesForBoard(values.board);
  const dbSubjects = helpers.getSubjectsForGrade(
    values.board,
    values.class_grade ? parseInt(values.class_grade, 10) : null
  );

  // Reset dependent fields when parent changes
  const [prevBoard, setPrevBoard] = useState(values.board);
  const [prevGrade, setPrevGrade] = useState(values.class_grade);

  useEffect(() => {
    if (prevBoard !== values.board) {
      setPrevBoard(values.board);
      // Reset grade and subjects when board changes
      if (values.class_grade) {
        onChange('class_grade', null);
      }
      if (values.subjects?.length) {
        onChange('subjects', undefined);
      }
    }
  }, [values.board, prevBoard, values.class_grade, values.subjects, onChange]);

  useEffect(() => {
    if (prevGrade !== values.class_grade) {
      setPrevGrade(values.class_grade);
      // Reset subjects when grade changes
      if (values.subjects?.length) {
        onChange('subjects', undefined);
      }
    }
  }, [values.class_grade, prevGrade, values.subjects, onChange]);

  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={required ? undefined : onClose} />
      <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="relative bg-white rounded-lg shadow-lg w-full max-w-full sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto" style={{ maxHeight: '90vh' }}>
        <div className="sticky top-0 z-10 bg-white px-5 pt-5 pb-3 border-b">
          <h2 className="text-lg font-semibold">Complete your profile</h2>
          <p className="text-sm text-muted-foreground">We need a few details to personalize learning.</p>
        </div>
        <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 112px)' }}>
          {/* Name */}
          <label className="block text-sm mb-1">
            Name <span className="text-red-600">*</span>
          </label>
          <input 
            aria-invalid={!!errors.name} 
            className={`w-full px-3 py-2 border rounded mb-1 ${errors.name ? 'border-red-500' : ''}`} 
            placeholder="Your name" 
            value={values.name} 
            onChange={(e) => onChange('name', e.target.value)} 
          />
          {errors.name && <div className="text-xs text-red-600 mb-2">{errors.name}</div>}

          {/* Preferred Language - First in cascade */}
          <div className="mb-3">
            <label className="block text-sm mb-1">Preferred language <span className="text-red-600">*</span></label>
            <select 
              aria-invalid={!!errors.preferred_language} 
              value={values.preferred_language ?? ''} 
              onChange={(e) => onChange('preferred_language', e.target.value || null)} 
              className={`w-full px-3 py-2 border rounded ${errors.preferred_language ? 'border-red-500' : ''}`}
            >
              <option value="">Choose language</option>
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
            {errors.preferred_language && <div className="text-xs text-red-600 mt-1">{errors.preferred_language}</div>}
          </div>

          {/* Board - DB-driven */}
          <div className="mb-3">
            <label className="block text-sm mb-1">Board <span className="text-red-600">*</span></label>
            <select 
              aria-invalid={!!errors.board} 
              value={values.board ?? ''} 
              onChange={(e) => onChange('board', e.target.value || null)} 
              disabled={hierarchyLoading}
              className={`w-full px-3 py-2 border rounded ${errors.board ? 'border-red-500' : ''} ${hierarchyLoading ? 'opacity-50' : ''}`}
            >
              <option value="">{hierarchyLoading ? 'Loading boards...' : 'Select board'}</option>
              {boards.map((board) => (
                <option key={board.id} value={board.slug}>{board.name}</option>
              ))}
            </select>
            {errors.board && <div className="text-xs text-red-600 mt-1">{errors.board}</div>}
          </div>

          {/* Grade/Class - DB-driven based on board */}
          <div className="mb-3">
            <label className="block text-sm mb-1">Class <span className="text-red-600">*</span></label>
            <select 
              aria-invalid={!!errors.class_grade} 
              value={values.class_grade ?? ''} 
              onChange={(e) => onChange('class_grade', e.target.value || null)} 
              disabled={!values.board}
              className={`w-full px-3 py-2 border rounded ${errors.class_grade ? 'border-red-500' : ''} ${!values.board ? 'opacity-50' : ''}`}
            >
              <option value="">
                {!values.board ? 'Select board first' : 'Select class'}
              </option>
              {grades.map((grade) => (
                <option key={grade.id} value={String(grade.grade)}>Class {grade.grade}</option>
              ))}
            </select>
            {errors.class_grade && <div className="text-xs text-red-600 mt-1">{errors.class_grade}</div>}
          </div>

          {/* Subjects - DB-driven based on board and grade */}
          <div className="mb-3">
            <label className="block text-sm mb-1">Subjects (optional)</label>
            {!values.board || !values.class_grade ? (
              <div className="text-sm text-muted-foreground py-2">Select board and class to see available subjects</div>
            ) : dbSubjects.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">No subjects available for this board and class</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {dbSubjects.map((subject) => (
                  <button 
                    type="button" 
                    key={subject.id} 
                    onClick={() => {
                      const prev = values.subjects ?? [];
                      const subjectSlug = subject.slug;
                      const next = prev.includes(subjectSlug) 
                        ? prev.filter((x) => x !== subjectSlug) 
                        : [...prev, subjectSlug];
                      onChange('subjects', next.length ? next : undefined);
                    }} 
                    className={`px-3 py-2 border rounded text-left transition-colors ${
                      values.subjects?.includes(subject.slug) 
                        ? 'bg-primary/10 border-primary' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    {values.subjects?.includes(subject.slug) ? '☑︎ ' : '◻︎ '} {subject.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {errors._root && <div className="text-sm text-red-600 mb-2">{errors._root}</div>}
        </div>
        <div className="sticky bottom-0 z-10 bg-white px-5 py-3 border-t flex justify-end gap-3">
          {!required && <button type="button" className="px-4 py-2 border rounded" onClick={onClose}>Cancel</button>}
          <button type="submit" disabled={!!saving} className="px-4 py-2 bg-primary text-white rounded">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
