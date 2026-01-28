'use client';

/**
 * FILE OBJECTIVE:
 * - Admin page to submit "Hydrate All" jobs for generating complete content
 *   for a board/grade/subject/language combination.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/content-engine/hydrate-all/page.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22T07:35:00Z | copilot | Created hydrate-all page for full content generation
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Board {
  id: string;
  name: string;
  slug: string;
  classes: ClassLevel[];
}

interface ClassLevel {
  id: string;
  grade: number;
  slug: string;
  subjects: Subject[];
}

interface Subject {
  id: string;
  name: string;
  slug: string;
}

interface HierarchyData {
  boards: Board[];
  languages: string[];
  difficulties: string[];
}

type SubmitState = {
  loading: boolean;
  error: string | null;
  success: string | null;
  jobId: string | null;
};

export default function HydrateAllPage() {
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>(['easy', 'medium', 'hard']);

  // Submit state
  const [submitState, setSubmitState] = useState<SubmitState>({
    loading: false,
    error: null,
    success: null,
    jobId: null,
  });

  // Fetch hierarchy data
  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        const res = await fetch('/api/admin/content-engine/hydrate-all', {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error('Failed to fetch hierarchy');
        }
        const data = await res.json();
        setHierarchy(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load hierarchy');
      } finally {
        setLoading(false);
      }
    };
    fetchHierarchy();
  }, []);

  // Derived data for cascading dropdowns
  const selectedBoardData = hierarchy?.boards.find((b) => b.id === selectedBoard);
  const classes = selectedBoardData?.classes || [];
  const selectedClassData = classes.find((c) => c.id === selectedClass);
  const subjects = selectedClassData?.subjects || [];

  // Reset downstream selections when parent changes
  useEffect(() => {
    setSelectedClass('');
    setSelectedSubject('');
  }, [selectedBoard]);

  useEffect(() => {
    setSelectedSubject('');
  }, [selectedClass]);

  // Toggle difficulty selection
  const toggleDifficulty = (diff: string) => {
    setSelectedDifficulties((prev) =>
      prev.includes(diff) ? prev.filter((d) => d !== diff) : [...prev, diff]
    );
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!selectedBoard || !selectedClass || !selectedSubject || !selectedLanguage) {
      setSubmitState({
        loading: false,
        error: 'Please select all required fields',
        success: null,
        jobId: null,
      });
      return;
    }

    if (selectedDifficulties.length === 0) {
      setSubmitState({
        loading: false,
        error: 'Please select at least one difficulty level',
        success: null,
        jobId: null,
      });
      return;
    }

    setSubmitState({ loading: true, error: null, success: null, jobId: null });

    try {
      const res = await fetch('/api/admin/content-engine/hydrate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          boardId: selectedBoard,
          classId: selectedClass,
          subjectId: selectedSubject,
          language: selectedLanguage,
          difficulties: selectedDifficulties,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit job');
      }

      setSubmitState({
        loading: false,
        error: null,
        success: data.message,
        jobId: data.jobId,
      });
    } catch (err) {
      setSubmitState({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to submit job',
        success: null,
        jobId: null,
      });
    }
  };

  // Get selected names for display
  const getSelectionSummary = () => {
    const board = hierarchy?.boards.find((b) => b.id === selectedBoard);
    const classLevel = board?.classes.find((c) => c.id === selectedClass);
    const subject = classLevel?.subjects.find((s) => s.id === selectedSubject);

    if (!board || !classLevel || !subject) return null;

    return {
      board: board.name,
      grade: classLevel.grade,
      subject: subject.name,
      language: selectedLanguage === 'en' ? 'English' : 'Hindi',
      difficulties: selectedDifficulties.join(', '),
    };
  };

  const summary = getSelectionSummary();

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="text-center py-8 text-gray-500">Loading hierarchy...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Hydrate All Content</h1>
        <p className="text-gray-600 mt-2">
          Generate complete content for a subject: syllabus, chapters, topics, notes, questions, and tests.
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">How it works:</h3>
        <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>Select a board, class, subject, and language</li>
          <li>Choose difficulty levels for questions and tests</li>
          <li>Click &quot;Start Full Hydration&quot; to begin</li>
          <li>The system will generate content in order:</li>
        </ol>
        <div className="mt-3 ml-6 text-sm text-blue-600 dark:text-blue-400">
          <div className="flex items-center gap-2 py-1">
            <span className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center text-xs font-bold">1</span>
            <span>Syllabus (Chapters &amp; Topics)</span>
          </div>
          <div className="flex items-center gap-2 py-1">
            <span className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center text-xs font-bold">2</span>
            <span>Notes for each topic</span>
          </div>
          <div className="flex items-center gap-2 py-1">
            <span className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center text-xs font-bold">3</span>
            <span>Questions for each topic (by difficulty)</span>
          </div>
          <div className="flex items-center gap-2 py-1">
            <span className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center text-xs font-bold">4</span>
            <span>Tests assembled from questions</span>
          </div>
        </div>
      </div>

      {/* Selection Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="font-semibold mb-4">Select Content Target</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Board */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Board <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Select Board</option>
              {hierarchy?.boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Class / Grade <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              disabled={!selectedBoard}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
            >
              <option value="">Select Class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  Class {cls.grade}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              disabled={!selectedClass}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
            >
              <option value="">Select Subject</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Language <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
        </div>

        {/* Difficulty Levels */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Difficulty Levels <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            {['easy', 'medium', 'hard'].map((diff) => (
              <label key={diff} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDifficulties.includes(diff)}
                  onChange={() => toggleDifficulty(diff)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className={`px-2 py-1 rounded text-sm font-medium ${
                  diff === 'easy' ? 'bg-green-100 text-green-800' :
                  diff === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {diff.charAt(0).toUpperCase() + diff.slice(1)}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Selection Summary */}
      {summary && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Selection Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Board:</span>
              <div className="font-medium">{summary.board}</div>
            </div>
            <div>
              <span className="text-gray-500">Grade:</span>
              <div className="font-medium">Class {summary.grade}</div>
            </div>
            <div>
              <span className="text-gray-500">Subject:</span>
              <div className="font-medium">{summary.subject}</div>
            </div>
            <div>
              <span className="text-gray-500">Language:</span>
              <div className="font-medium">{summary.language}</div>
            </div>
            <div>
              <span className="text-gray-500">Difficulties:</span>
              <div className="font-medium">{summary.difficulties}</div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSubmit}
          disabled={submitState.loading || !selectedBoard || !selectedClass || !selectedSubject}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {submitState.loading ? 'Submitting...' : '🚀 Start Full Hydration'}
        </button>
        <Link
          href="/admin/content-engine/jobs"
          className="text-blue-600 hover:underline"
        >
          View Jobs →
        </Link>
      </div>

      {/* Status Messages */}
      {submitState.error && (
        <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {submitState.error}
        </div>
      )}

      {submitState.success && (
        <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <div className="font-semibold">{submitState.success}</div>
          {submitState.jobId && (
            <div className="text-sm mt-1">
              Job ID: <code className="bg-green-200 px-1 rounded">{submitState.jobId}</code>
            </div>
          )}
          <div className="mt-2">
            <Link href="/admin/content-engine/jobs" className="underline">
              Track progress in Jobs →
            </Link>
          </div>
        </div>
      )}

      {/* Warning Note */}
      <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <span className="text-yellow-600 text-xl">⚠️</span>
          <div>
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Note</h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              This operation will generate a large amount of content and may take several minutes to complete.
              All generated content will be in &quot;draft&quot; status and requires approval before becoming visible to students.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
