/**
 * FILE OBJECTIVE:
 * - Client component for the admin concept seeder page.
 *   Renders a form (board/grade/subject/topicSlug/chapterTitle/count),
 *   calls POST /api/admin/concepts/generate, and shows the generated concepts.
 *   Also shows the existing coverage table with delete capability.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial implementation for admin concept seeder
 */

'use client';

import React, { useState, useTransition } from 'react';

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
  summary: string;
  orderIndex: number;
}

interface Props {
  initialCoverage: CoverageRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BOARDS = ['CBSE', 'ICSE', 'ISC'];
const GRADES = ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SUBJECTS = [
  'mathematics',
  'science',
  'physics',
  'chemistry',
  'biology',
  'social-science',
  'history',
  'geography',
  'civics',
  'english',
  'accountancy',
  'economics',
  'business-studies',
  'evs',
];
const COUNT_OPTIONS = [3, 5, 7, 10];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#534AB7] min-h-[44px]"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
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
  const [board, setBoard] = useState('CBSE');
  const [grade, setGrade] = useState('6');
  const [subject, setSubject] = useState('mathematics');
  const [topicSlug, setTopicSlug] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [count, setCount] = useState(5);
  const [result, setResult] = useState<GeneratedConcept[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [coverage, setCoverage] = useState<CoverageRow[]>(initialCoverage);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  function handleGenerate() {
    if (!topicSlug.trim() || !chapterTitle.trim()) {
      setError('Topic slug and chapter title are required.');
      return;
    }
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/concepts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ board, grade, subject, topicSlug: topicSlug.trim(), chapterTitle: chapterTitle.trim(), count }),
        });
        const data: unknown = await res.json();
        if (!res.ok) {
          const msg = (data as Record<string, unknown>)?.error as string | undefined;
          setError(msg ?? 'Generation failed.');
          return;
        }
        const typedData = data as { concepts: GeneratedConcept[]; created: number };
        setResult(typedData.concepts);

        // Refresh coverage
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
      setCoverage((prev) => prev.filter(
        (r) => !(r.board === row.board && r.grade === row.grade && r.subject === row.subject && r.topicSlug === row.topicSlug),
      ));
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Generate form ─────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Generate Concepts for a Chapter</h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-3">
          <div>
            <FieldLabel>Board</FieldLabel>
            <Select value={board} onChange={setBoard} options={BOARDS} />
          </div>
          <div>
            <FieldLabel>Grade</FieldLabel>
            <Select value={grade} onChange={setGrade} options={GRADES} />
          </div>
          <div>
            <FieldLabel>Subject</FieldLabel>
            <Select value={subject} onChange={setSubject} options={SUBJECTS} />
          </div>
          <div>
            <FieldLabel>Count</FieldLabel>
            <Select
              value={String(count)}
              onChange={(v) => setCount(Number(v))}
              options={COUNT_OPTIONS.map(String)}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <FieldLabel>Topic slug</FieldLabel>
            <TextInput value={topicSlug} onChange={setTopicSlug} placeholder="e.g. fractions" />
          </div>
          <div className="col-span-2 sm:col-span-2 lg:col-span-2">
            <FieldLabel>Chapter title (shown to AI)</FieldLabel>
            <TextInput value={chapterTitle} onChange={setChapterTitle} placeholder="e.g. Fractions and Decimals" />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg bg-[#534AB7] text-white hover:bg-[#4339a0] disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Generating...' : 'Generate Concepts'}
          </button>
          {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
        </div>
      </section>

      {/* ── Results ───────────────────────────────────────────────────────────── */}
      {result && result.length > 0 && (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Generated {result.length} concepts for <span className="font-mono text-[#534AB7]">{topicSlug}</span>
          </h2>
          <div className="space-y-2">
            {result.map((c) => (
              <div key={c.orderIndex} className="flex gap-3 items-start text-sm">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#EEEDFE] text-[#534AB7] text-[10px] font-semibold flex items-center justify-center mt-0.5">
                  {c.orderIndex}
                </span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white leading-snug">{c.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{c.summary}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[#1D9E75] font-medium">Saved to database (duplicates skipped).</p>
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
                    <tr key={key} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300">{row.board}</td>
                      <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300">{row.grade}</td>
                      <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300">{row.subject}</td>
                      <td className="py-1.5 pr-3 font-mono text-[#534AB7]">{row.topicSlug}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{row.count}</td>
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
