"use client";

/**
 * MockExamRunner -- F-STU-021
 *
 * Full mock exam runner with:
 *   AC-01: Board-format paper (section headings, marks per question, Q numbering).
 *   AC-02: Global countdown timer; auto-submits all pending sections on expiry.
 *   AC-03: Free navigation within active section; review flag per question;
 *           submitted sections locked (cannot navigate back).
 *
 * Props come from POST /api/mock/[examId]/start response.
 * On completion, calls POST /api/mock/attempt/[attemptId]/complete and
 * switches to MockExamReport.
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created for F-STU-021
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import MockExamReport from './MockExamReport';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ExamQuestion {
  mockQuestionId: string;
  questionId: string;
  marks: number;
  order: number;
  type: string;
  prompt: string;
  choices: unknown[] | null;
}

interface ExamSection {
  id: string;
  title: string;
  order: number;
  totalMarks: number;
  instructions: string | null;
  questions: ExamQuestion[];
}

export interface MockExamRunnerProps {
  attemptId: string;
  examTitle: string;
  subjectName: string;
  totalMarks: number;
  durationSeconds: number;
  sections: ExamSection[];
}

type _SectionState = 'active' | 'submitted' | 'locked';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function isLowTime(secs: number): boolean {
  return secs <= 300; // last 5 minutes
}

// ── Sub-component: Question card ──────────────────────────────────────────────

interface QuestionCardProps {
  q: ExamQuestion;
  globalIndex: number; // Q1, Q2... across sections
  answer: string;
  flagged: boolean;
  locked: boolean;
  onAnswerChange: (qid: string, val: string) => void;
  onFlag: (qid: string) => void;
}

function QuestionCard({ q, globalIndex, answer, flagged, locked, onAnswerChange, onFlag }: QuestionCardProps) {
  const choices = Array.isArray(q.choices) ? q.choices : [];
  const qtype = q.type.toLowerCase();

  return (
    <div
      className={`rounded-xl border p-4 mb-4 transition-colors ${
        flagged
          ? 'border-[#BA7517] bg-[#FAEEDA] dark:bg-slate-800'
          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 flex-shrink-0">
            Q{globalIndex}.
          </span>
          <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">{q.prompt}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] bg-[#EEEDFE] text-[#534AB7] px-2 py-0.5 rounded-full font-semibold">
            {q.marks} mark{q.marks > 1 ? 's' : ''}
          </span>
          {!locked && (
            <button
              onClick={() => onFlag(q.questionId)}
              className={`min-h-[36px] min-w-[36px] text-xs rounded-lg transition-colors ${
                flagged ? 'bg-[#BA7517] text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'
              }`}
              title={flagged ? 'Remove review flag' : 'Mark for review'}
              aria-pressed={flagged}
            >
              {flagged ? '★' : '☆'}
            </button>
          )}
        </div>
      </div>

      {/* MCQ */}
      {qtype === 'mcq' && choices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {choices.map((c: any, i: number) => {
            const val = String(c?.key ?? c?.value ?? c);
            const label = String(c?.label ?? c?.value ?? c);
            return (
              <label
                key={i}
                className={`flex items-center gap-2 rounded-lg border p-2.5 min-h-[44px] transition-colors ${
                  locked
                    ? 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-slate-700'
                    : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700'
                } ${answer === val ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-slate-700' : 'border-gray-200 dark:border-slate-600'}`}
              >
                <input
                  type="radio"
                  name={`q-${q.questionId}`}
                  disabled={locked}
                  checked={answer === val}
                  onChange={() => !locked && onAnswerChange(q.questionId, val)}
                  className="accent-[#534AB7]"
                />
                <span className="text-sm text-gray-800 dark:text-gray-200">{label}</span>
              </label>
            );
          })}
        </div>
      )}

      {/* Short / numeric */}
      {(qtype === 'short' || qtype === 'numeric') && (
        <textarea
          disabled={locked}
          value={answer}
          onChange={(e) => !locked && onAnswerChange(q.questionId, e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
          placeholder={locked ? '' : 'Write your answer here...'}
        />
      )}

      {/* Long answer / essay */}
      {(qtype === 'long_answer' || qtype === 'long' || qtype === 'essay') && (
        <textarea
          disabled={locked}
          value={answer}
          onChange={(e) => !locked && onAnswerChange(q.questionId, e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
          placeholder={locked ? '' : 'Write a detailed answer...'}
        />
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MockExamRunner(props: MockExamRunnerProps) {
  const { attemptId, examTitle, subjectName, totalMarks, durationSeconds, sections } = props;

  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [submittedSectionIds, setSubmittedSectionIds] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [questionStartTimes, setQuestionStartTimes] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [submittingSection, setSubmittingSection] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completeRef = useRef<() => void>(() => {});

  // ── Timer ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (timeLeft <= 0) {
      completeRef.current();
      return;
    }
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  // Track when a question was first viewed for time-per-question heatmap
  useEffect(() => {
    const section = sections[activeSectionIdx];
    if (!section) return;
    const now = Date.now();
    setQuestionStartTimes((prev) => {
      const next = { ...prev };
      section.questions.forEach((q) => {
        if (!next[q.questionId]) next[q.questionId] = now;
      });
      return next;
    });
  }, [activeSectionIdx, sections]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const updateAnswer = useCallback((qid: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: val }));
  }, []);

  const toggleFlag = useCallback((qid: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }, []);

  async function submitSection(sectionId: string, sectionQuestions: ExamQuestion[]) {
    const payload = sectionQuestions.map((q) => ({
      questionId: q.questionId,
      answer: answers[q.questionId] ?? '',
      timeSpentSeconds: questionStartTimes[q.questionId]
        ? Math.round((Date.now() - questionStartTimes[q.questionId]) / 1000)
        : 0,
    }));

    await fetch(`/api/mock/attempt/${attemptId}/section/${sectionId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: payload }),
    });

    setSubmittedSectionIds((prev) => new Set([...prev, sectionId]));
  }

  async function completeExam() {
    if (completing) return;
    setCompleting(true);
    setError(null);
    try {
      // Submit any un-submitted sections
      for (const sec of sections) {
        if (!submittedSectionIds.has(sec.id)) {
          await submitSection(sec.id, sec.questions);
        }
      }
      const res = await fetch(`/api/mock/attempt/${attemptId}/complete`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to complete exam');

      // AC-04: Fetch full per-question time data from the GET report endpoint.
      // The POST complete response only includes aggregated scores.
      try {
        const reportRes = await fetch(`/api/mock/attempt/${attemptId}/report`);
        if (reportRes.ok) {
          const fullReport = await reportRes.json();
          setReport({ ...json, sections: fullReport.sections ?? [] });
        } else {
          setReport(json);
        }
      } catch {
        setReport(json);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to complete exam. Please try again.');
    } finally {
      setCompleting(false);
    }
  }

  completeRef.current = completeExam;

  async function handleSubmitSection() {
    const section = sections[activeSectionIdx];
    if (!section || submittingSection) return;
    setSubmittingSection(true);
    try {
      await submitSection(section.id, section.questions);
      // Move to next section if available
      if (activeSectionIdx < sections.length - 1) {
        setActiveSectionIdx(activeSectionIdx + 1);
      }
    } catch {
      setError('Failed to submit section. Please try again.');
    } finally {
      setSubmittingSection(false);
    }
  }

  // ── Build global question index ───────────────────────────────────────────────
  // AC-01: official question numbering across all sections

  let globalIndex = 0;
  const questionGlobalIndex: Record<string, number> = {};
  for (const sec of sections) {
    for (const q of sec.questions) {
      globalIndex++;
      questionGlobalIndex[q.questionId] = globalIndex;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (report) return <MockExamReport report={report} />;

  const activeSection = sections[activeSectionIdx];
  const isActiveLocked = submittedSectionIds.has(activeSection?.id ?? '');
  const lowTime = isLowTime(timeLeft);

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 dark:bg-slate-900">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">{subjectName}</p>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-50 truncate">{examTitle}</h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-[10px] text-gray-400">Total: {totalMarks} marks</span>
            {/* AC-02: Countdown timer */}
            <span
              className={`font-mono text-sm font-bold px-3 py-1.5 rounded-lg ${
                lowTime ? 'bg-[#FCEBEB] text-[#E24B4A]' : 'bg-[#EEEDFE] text-[#534AB7]'
              }`}
            >
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </header>

      {/* ── Section tabs (AC-03) ── */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-3xl mx-auto flex gap-1 px-4 py-2 overflow-x-auto">
          {sections.map((sec, idx) => {
            const isSubmitted = submittedSectionIds.has(sec.id);
            const isActive = idx === activeSectionIdx;
            return (
              <button
                key={sec.id}
                onClick={() => !isSubmitted && setActiveSectionIdx(idx)}
                disabled={isSubmitted}
                className={`min-h-[44px] px-4 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive && !isSubmitted
                    ? 'bg-[#534AB7] text-white'
                    : isSubmitted
                    ? 'bg-[#EAF3DE] text-[#1D9E75] cursor-not-allowed'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
                aria-current={isActive ? 'true' : undefined}
              >
                {sec.title}
                {isSubmitted && ' ✓'}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section content ── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        {activeSection && (
          <>
            {/* Section header (AC-01) */}
            <div className="mb-5">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-50">
                {activeSection.title}
              </h2>
              {activeSection.instructions && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {activeSection.instructions}
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {activeSection.questions.length} questions · {activeSection.totalMarks} marks
                {isActiveLocked && (
                  <span className="ml-2 text-[#1D9E75] font-semibold">Submitted</span>
                )}
              </p>
            </div>

            {/* Questions */}
            {activeSection.questions.map((q) => (
              <QuestionCard
                key={q.questionId}
                q={q}
                globalIndex={questionGlobalIndex[q.questionId]}
                answer={answers[q.questionId] ?? ''}
                flagged={flagged.has(q.questionId)}
                locked={isActiveLocked}
                onAnswerChange={updateAnswer}
                onFlag={toggleFlag}
              />
            ))}

            {/* Submit section button */}
            {!isActiveLocked && (
              <div className="mt-4 flex flex-col gap-3">
                {error && (
                  <p className="text-sm text-[#E24B4A]">{error}</p>
                )}
                <button
                  onClick={handleSubmitSection}
                  disabled={submittingSection}
                  className="w-full min-h-[52px] rounded-xl bg-[#534AB7] text-white font-semibold text-sm disabled:opacity-50 transition-colors hover:bg-[#4339a6]"
                >
                  {submittingSection ? 'Submitting...' : `Submit ${activeSection.title}`}
                </button>
                {activeSectionIdx === sections.length - 1 && (
                  <p className="text-xs text-center text-gray-400">
                    Submitting the last section will end the exam.
                  </p>
                )}
              </div>
            )}

            {/* Complete exam button -- shown when all sections submitted */}
            {isActiveLocked && activeSectionIdx === sections.length - 1 && (
              <div className="mt-6">
                <button
                  onClick={completeExam}
                  disabled={completing}
                  className="w-full min-h-[52px] rounded-xl bg-[#1D9E75] text-white font-semibold text-sm disabled:opacity-50 transition-colors hover:bg-[#17876a]"
                >
                  {completing ? 'Generating your report...' : 'View Results & Priority Plan'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
