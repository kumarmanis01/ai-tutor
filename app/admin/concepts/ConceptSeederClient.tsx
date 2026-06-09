/**
 * FILE OBJECTIVE:
 * - Client component for the admin concept seeder page.
 *   Loads board/grade/subject/language options from DB via /api/admin/concepts/meta,
 *   renders a cascading form, calls POST /api/admin/concepts/generate, and shows results.
 *   Also renders the existing coverage table with delete capability.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | DB-driven dropdowns, cascading subject filter, count slider, language field
 * - 2026-06-09T00:00:00Z | claude | initial implementation for admin concept seeder
 */

'use client';

import React, { useState, useEffect, useTransition } from 'react';
import type { BoardOption, ConceptsMeta } from '@/app/api/admin/concepts/meta/route';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoverageRow {
  board: string;
  grade: string;
  subject: string;
  topicSlug: string;
  count: number;
}

interface GeneratedConcept {
  title: string;
  slug: string;
  summary: string;
  orderIndex: number;
}

interface Props {
  initialCoverage: CoverageRow[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
      {children}
    </label>
  );
}

function SelectField({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#534AB7] min-h-[44px] disabled:opacity-50"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#534AB7] min-h-[44px]"
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConceptSeederClient({ initialCoverage }: Props) {
  const [meta, setMeta] = useState<ConceptsMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  // Form state
  const [board, setBoard] = useState('');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [language, setLanguage] = useState('en');
  const [topicSlug, setTopicSlug] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [count, setCount] = useState(12);

  // Result state
  const [result, setResult] = useState<GeneratedConcept[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [coverage, setCoverage] = useState<CoverageRow[]>(initialCoverage);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  // Load meta from DB on mount
  useEffect(() => {
    fetch('/api/admin/concepts/meta')
      .then((r) => r.json())
      .then((data: ConceptsMeta) => {
        setMeta(data);
        if (data.boards.length > 0) {
          const firstBoard = data.boards[0];
          setBoard(firstBoard.slug);
          if (firstBoard.grades.length > 0) {
            const firstGrade = firstBoard.grades[0];
            setGrade(String(firstGrade.grade));
            if (firstGrade.subjects.length > 0) {
              setSubject(firstGrade.subjects[0].slug);
            }
          }
        }
      })
      .catch(() => setMetaError("Couldn't load form options -- tap to retry."));
  }, []);

  // Cascade: when board changes, reset grade + subject
  function handleBoardChange(newBoard: string) {
    setBoard(newBoard);
    setGrade('');
    setSubject('');
    const boardData = meta?.boards.find((b) => b.slug === newBoard);
    if (boardData?.grades.length) {
      const firstGrade = boardData.grades[0];
      setGrade(String(firstGrade.grade));
      if (firstGrade.subjects.length > 0) setSubject(firstGrade.subjects[0].slug);
    }
  }

  // Cascade: when grade changes, reset subject
  function handleGradeChange(newGrade: string) {
    setGrade(newGrade);
    setSubject('');
    const gradeData = currentGrades.find((g) => String(g.grade) === newGrade);
    if (gradeData?.subjects.length) setSubject(gradeData.subjects[0].slug);
  }

  const currentBoard: BoardOption | undefined = meta?.boards.find((b) => b.slug === board);
  const currentGrades = currentBoard?.grades ?? [];
  const currentGradeData = currentGrades.find((g) => String(g.grade) === grade);
  const currentSubjects = currentGradeData?.subjects ?? [];

  function handleGenerate() {
    if (!board || !grade || !subject) {
      setError('Select board, grade, and subject.');
      return;
    }
    if (!topicSlug.trim() || !chapterTitle.trim()) {
      setError('Topic slug and chapter title are required.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(topicSlug.trim())) {
      setError('Topic slug must use lowercase letters, numbers, and hyphens only.');
      return;
    }
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/concepts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            board,
            grade,
            subject,
            language,
            topicSlug: topicSlug.trim(),
            chapterTitle: chapterTitle.trim(),
            count,
          }),
        });
        const data: unknown = await res.json();
        if (!res.ok) {
          const msg = (data as Record<string, unknown>)?.error as string | undefined;
          setError(msg ?? 'Generation failed.');
          return;
        }
        const typedData = data as { concepts: GeneratedConcept[]; created: number; updated: number };
        setResult(typedData.concepts);

        // Refresh coverage table
        const coverageRes = await fetch('/api/admin/concepts');
        if (coverageRes.ok) {
          const coverageData = await coverageRes.json() as { coverage: CoverageRow[] };
          setCoverage(coverageData.coverage);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Network error.');
      }
    });
  }

  async function handleDelete(row: CoverageRow) {
    const key = `${row.board}|${row.grade}|${row.subject}|${row.topicSlug}`;
    setDeletingKey(key);
    try {
      await fetch('/api/admin/concepts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: row.board, grade: row.grade, subject: row.subject, topicSlug: row.topicSlug }),
      });
      setCoverage((prev) =>
        prev.filter(
          (r) =>
            !(r.board === row.board && r.grade === row.grade && r.subject === row.subject && r.topicSlug === row.topicSlug),
        ),
      );
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Generate form ─────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Generate Concepts for a Chapter
        </h2>

        {metaError && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mb-4 text-xs text-[#E24B4A] hover:underline min-h-[44px] flex items-center"
          >
            {metaError}
          </button>
        )}

        {!meta && !metaError && (
          <div className="flex gap-2 items-center mb-4">
            <div className="h-3 w-3 rounded-full bg-[#534AB7] animate-pulse" />
            <span className="text-xs text-gray-400">Loading form options...</span>
          </div>
        )}

        {meta && (
          <>
            {/* Row 1: Board · Grade · Subject · Language */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
              <div>
                <FieldLabel>Board</FieldLabel>
                <SelectField
                  value={board}
                  onChange={handleBoardChange}
                  placeholder="Select board"
                  options={meta.boards.map((b) => ({ value: b.slug, label: b.name }))}
                />
              </div>
              <div>
                <FieldLabel>Grade</FieldLabel>
                <SelectField
                  value={grade}
                  onChange={handleGradeChange}
                  placeholder="Select grade"
                  disabled={!board}
                  options={currentGrades.map((g) => ({
                    value: String(g.grade),
                    label: `Grade ${g.grade}`,
                  }))}
                />
              </div>
              <div>
                <FieldLabel>Subject</FieldLabel>
                <SelectField
                  value={subject}
                  onChange={setSubject}
                  placeholder="Select subject"
                  disabled={!grade}
                  options={currentSubjects.map((s) => ({ value: s.slug, label: s.name }))}
                />
              </div>
              <div>
                <FieldLabel>Language</FieldLabel>
                <SelectField
                  value={language}
                  onChange={setLanguage}
                  options={meta.languages.map((l) => ({ value: l.code, label: l.label }))}
                />
              </div>
            </div>

            {/* Row 2: Topic slug · Chapter title */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
              <div>
                <FieldLabel>Topic slug (e.g. fractions)</FieldLabel>
                <TextInput
                  value={topicSlug}
                  onChange={setTopicSlug}
                  placeholder="lowercase-with-hyphens"
                />
              </div>
              <div>
                <FieldLabel>Chapter title (shown to AI)</FieldLabel>
                <TextInput
                  value={chapterTitle}
                  onChange={setChapterTitle}
                  placeholder="e.g. Fractions and Decimals"
                />
              </div>
            </div>

            {/* Row 3: Count slider */}
            <div className="mb-4">
              <FieldLabel>
                Concept count:{' '}
                <span className="font-semibold text-[#534AB7]">{count}</span>
              </FieldLabel>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-4">1</span>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="flex-1 h-2 appearance-none rounded-full bg-gray-200 dark:bg-gray-700 accent-[#534AB7] cursor-pointer min-h-[44px]"
                />
                <span className="text-xs text-gray-400 w-5">20</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isPending || !board || !grade || !subject}
                className="px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg bg-[#534AB7] text-white hover:bg-[#4339a0] disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Generating...' : 'Generate Concepts'}
              </button>
              {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
            </div>
          </>
        )}
      </section>

      {/* ── Results ───────────────────────────────────────────────────────────── */}
      {result && result.length > 0 && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Generated {result.length} concepts for{' '}
            <span className="font-mono text-[#534AB7]">{topicSlug}</span>
          </h2>
          <div className="space-y-2">
            {result.map((c) => (
              <div key={c.orderIndex} className="flex gap-3 items-start text-sm">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#EEEDFE] text-[#534AB7] text-[10px] font-semibold flex items-center justify-center mt-0.5">
                  {c.orderIndex}
                </span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white leading-snug">
                    {c.title}
                    {c.slug && (
                      <span className="ml-2 font-mono text-[10px] text-gray-400">
                        {c.slug}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {c.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[#1D9E75] font-medium">
            Saved to database (existing concepts updated, new ones created).
          </p>
        </section>
      )}

      {/* ── Coverage table ────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Existing Coverage ({coverage.length} topic groups)
        </h2>
        {coverage.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No concepts seeded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-left text-gray-500">
                  <th className="pb-2 pr-3 font-medium">Board</th>
                  <th className="pb-2 pr-3 font-medium">Grade</th>
                  <th className="pb-2 pr-3 font-medium">Subject</th>
                  <th className="pb-2 pr-3 font-medium">Topic slug</th>
                  <th className="pb-2 pr-3 font-medium text-right">Concepts</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {coverage.map((row) => {
                  const key = `${row.board}|${row.grade}|${row.subject}|${row.topicSlug}`;
                  return (
                    <tr
                      key={key}
                      className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                    >
                      <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300">{row.board}</td>
                      <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300">{row.grade}</td>
                      <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300">{row.subject}</td>
                      <td className="py-1.5 pr-3 font-mono text-[#534AB7]">{row.topicSlug}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {row.count}
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          disabled={deletingKey === key}
                          className="text-[#E24B4A] hover:underline disabled:opacity-40 text-[10px] min-h-[28px] px-1"
                        >
                          {deletingKey === key ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
