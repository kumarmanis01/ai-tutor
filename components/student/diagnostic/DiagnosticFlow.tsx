'use client';

/**
 * DiagnosticFlow -- v2 full-screen diagnostic test component
 *
 * Renders as a fixed overlay (z-[100]) covering the StudentNav.
 * Three phases:
 *   1. Active quiz     -- one question at a time, 30-min countdown timer
 *   2. Generating plan -- animated progress screen while bootstrap job runs
 *                         (polls /api/student/diagnostic/results/[subjectId]
 *                          every 2 s; resolves when chapter data arrives)
 *   3. Results view    -- knowledge map (no numeric score, CSS-token tier bands)
 *
 * Supports:
 *   - Resume from partial Redis state (initialAnswers / initialIndex)
 *   - "Save and continue later" -> POST /api/student/diagnostic/save-partial
 *   - Auto-save and submit at timer 0:00
 *   - Abandon guard (beforeunload + in-app confirm dialog)
 *   - Timer: amber + warning text at 2:00 remaining
 *
 * EDIT LOG:
 *   - 2026-06-04 | claude | add generating phase between quiz and results;
 *                           port KnowledgeMapResults to design-system CSS tokens
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { QuestionInteractionShell } from '@/components/questions/QuestionInteractionShell';
import { normaliseChoices } from '@/lib/session/sessionUtils';
import { Card, Btn, Ring, TierPill, Mono } from '@/components/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DiagnosticQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctAnswer: string;
  chapterId: string;
  chapterName: string;
  topicId: string;
};

type PartialAnswer = {
  questionId: string;
  selectedOption: string;
  timeSpentMs: number;
};

type ChapterResult = {
  chapterId: string;
  chapterName: string;
  avgMastery: number;
  questionCount: number;
};

interface DiagnosticFlowProps {
  subjectId: string;
  subjectName: string;
  questions: DiagnosticQuestion[];
  initialAnswers: Array<{ questionId: string; selectedOption: string }>;
  initialIndex: number;
  // Optional props used when running server-driven adaptive diagnostics
  boardSlug?: string;
  grade?: number | string;
  subjectSlug?: string;
  // Names of other subjects the student still needs to diagnose (for post-submit nudge)
  pendingDiagnosticSubjectNames?: string[];
  // Override destination for the "Start learning" / "Continue" CTA after results.
  // Defaults to /dashboard.
  afterResultsPath?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_SECONDS = 30 * 60; // 30 minutes
const AMBER_THRESHOLD = 2 * 60; // 2 minutes remaining → amber warning

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Check if the student's selected option is correct.
 * Handles both: correctAnswer = full option text, or correctAnswer = numeric index string.
 */
function checkCorrect(question: DiagnosticQuestion, selectedOption: string): boolean {
  const { correctAnswer, choices } = question;
  if (correctAnswer === selectedOption) return true;
  // Try numeric index fallback
  const idx = parseInt(correctAnswer, 10);
  if (!isNaN(idx) && idx >= 0 && idx < choices.length) {
    return choices[idx] === selectedOption;
  }
  return false;
}

/**
 * Compute per-chapter mastery from submitted answers.
 * Weights align with spec colour bands: Red < 40%, Amber 40-70%, Green > 70%.
 *   correct    = 1.0  (full credit)
 *   wrong      = 0.0  (no credit)
 *   unanswered = 0.4  (grade-level start assumed per AC-07, neutral partial credit)
 */
function computeChapterResults(
  questions: DiagnosticQuestion[],
  answers: PartialAnswer[],
): ChapterResult[] {
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  const chapterMap = new Map<
    string,
    { chapterName: string; correct: number; wrong: number; unanswered: number }
  >();

  for (const q of questions) {
    if (!chapterMap.has(q.chapterId)) {
      chapterMap.set(q.chapterId, {
        chapterName: q.chapterName,
        correct: 0,
        wrong: 0,
        unanswered: 0,
      });
    }
    const stat = chapterMap.get(q.chapterId)!;
    const ans = answerMap.get(q.id);
    if (!ans) {
      stat.unanswered += 1;
    } else if (checkCorrect(q, ans.selectedOption)) {
      stat.correct += 1;
    } else {
      stat.wrong += 1;
    }
  }

  const results: ChapterResult[] = [];
  for (const [chapterId, stat] of chapterMap) {
    const total = stat.correct + stat.wrong + stat.unanswered;
    if (total === 0) continue;
    const avgMastery =
      (stat.correct * 1.0 + stat.wrong * 0.0 + stat.unanswered * 0.4) / total;
    results.push({ chapterId, chapterName: stat.chapterName, avgMastery, questionCount: total });
  }

  // Sort by mastery ascending (weakest first -- "Start here" = first)
  results.sort((a, b) => a.avgMastery - b.avgMastery);
  return results;
}

function masteryBadge(avgMastery: number): { label: string; colorClass: string } {
  if (avgMastery > 0.7)
    return { label: 'Strong', colorClass: 'bg-[#EAF3DE] text-[#1D9E75]' };
  if (avgMastery >= 0.4)
    return { label: 'Partial', colorClass: 'bg-[#FAEEDA] text-[#BA7517]' };
  return { label: 'Needs work', colorClass: 'bg-[#FCEBEB] text-[#E24B4A]' };
}

// ── AbandonDialog ─────────────────────────────────────────────────────────────

function AbandonDialog({
  onSave,
  onAbandon,
  onCancel,
  busy,
}: {
  onSave: () => void;
  onAbandon: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">
          Leave the diagnostic?
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Your progress is saved for 24 hours -- you can pick up where you left off.
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] disabled:opacity-60 transition-colors"
          >
            {busy ? 'Saving...' : 'Save progress and leave'}
          </button>
          <button
            type="button"
            onClick={onAbandon}
            disabled={busy}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-[#E24B4A] text-[#E24B4A] text-sm font-medium hover:bg-[#FCEBEB] dark:hover:bg-[#E24B4A]/10 disabled:opacity-50 transition-colors"
          >
            Abandon -- progress will be lost
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            Continue diagnostic
          </button>
        </div>
      </div>
    </div>
  );
}

// ── KnowledgeMapResults ───────────────────────────────────────────────────────

function placementBanner(placement: 'below' | 'at' | 'above') {
  const map = {
    below: {
      label: 'Below grade level',
      sub: "We'll build your foundation from the ground up.",
      bg: 'bg-[#FCEBEB] dark:bg-[#E24B4A]/10',
      text: 'text-[#E24B4A]',
      subText: 'text-[#E24B4A]/80',
    },
    at: {
      label: 'At grade level',
      sub: "You're right where you need to be -- let's strengthen the gaps.",
      bg: 'bg-[#FAEEDA] dark:bg-[#BA7517]/10',
      text: 'text-[#BA7517]',
      subText: 'text-[#BA7517]/80',
    },
    above: {
      label: 'Above grade level',
      sub: "You're ahead -- Vidya will keep pushing you further.",
      bg: 'bg-[#EAF3DE] dark:bg-[#1D9E75]/10',
      text: 'text-[#1D9E75]',
      subText: 'text-[#1D9E75]/80',
    },
  };
  return map[placement];
}

// -- Generating plan screen (wireframe S2: quiz -> generating -> results) ------

const GEN_STAGES = [
  'Reviewing your answers',
  'Mapping concept gaps',
  'Calibrating difficulty',
  'Building your learning path',
  'Almost ready',
];

/**
 * Animated interstitial shown between quiz submission and the knowledge-map results.
 * Polls /api/student/diagnostic/results/[subjectId] every 2 s. Resolves once the
 * bootstrap job has written chapter-mastery data (typically < 5 s). Falls back to
 * showing results from locally-computed data after MAX_WAIT_MS regardless.
 */
function GeneratingPlanScreen({
  subjectId,
  onReady,
}: {
  subjectId: string;
  onReady: () => void;
}) {
  const MAX_WAIT_MS = 30_000;
  const POLL_MS = 2_000;
  const [pct, setPct] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    let stopped = false;
    let timerId: ReturnType<typeof setTimeout>;

    // Animate percentage smoothly regardless of poll results
    const animationId = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const natural = Math.min(96, Math.round((elapsed / MAX_WAIT_MS) * 100));
      setPct(natural);
      setStageIdx(Math.min(GEN_STAGES.length - 1, Math.floor(natural / (100 / GEN_STAGES.length))));
    }, 300);

    async function poll() {
      if (stopped) return;
      try {
        const res = await fetch(`/api/student/diagnostic/results/${subjectId}`);
        if (res.ok) {
          const json = await res.json();
          // Chapters array non-empty = bootstrap job completed
          if (Array.isArray(json?.chapters) && json.chapters.length > 0) {
            if (!stopped) { setPct(100); clearInterval(animationId); setTimeout(onReady, 600); return; }
          }
        }
      } catch { /* ignore transient errors */ }
      // Hard timeout: show results anyway after MAX_WAIT_MS
      if (Date.now() - startRef.current >= MAX_WAIT_MS) {
        if (!stopped) { clearInterval(animationId); onReady(); return; }
      }
      if (!stopped) timerId = setTimeout(poll, POLL_MS);
    }

    timerId = setTimeout(poll, POLL_MS);
    return () => { stopped = true; clearInterval(animationId); clearTimeout(timerId); };
  }, [subjectId, onReady]);

  const circumference = 2 * Math.PI * 52;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center text-center"
      style={{ background: 'var(--bg)', padding: 32 }}
    >
      {/* Circular progress */}
      <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 28 }}>
        <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="52" fill="none"
            stroke="var(--primary)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct / 100)}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 20, color: 'var(--primary)', animation: 'spz-pulse 1.6s infinite' }}>✦</span>
        </div>
      </div>

      <h2 style={{ margin: '0 0 8px', fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
        Building your plan
      </h2>
      <p style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--text-muted)', fontWeight: 500 }}>
        {GEN_STAGES[stageIdx]}...
      </p>
      <Mono style={{ fontSize: 12, color: 'var(--text-faint)' }}>{pct}%</Mono>
    </div>
  );
}

function KnowledgeMapResults({
  subjectName,
  results,
  placement,
  pendingDiagnosticSubjectNames = [],
  afterResultsPath = '/dashboard',
}: {
  subjectName: string;
  results: ChapterResult[];
  placement: 'below' | 'at' | 'above' | null;
  pendingDiagnosticSubjectNames?: string[];
  afterResultsPath?: string;
}) {
  const router = useRouter();

  // Map avgMastery 0-1 to a TierKey for the Ring/TierPill components
  function masteryToTier(m: number): 'critical' | 'weak' | 'fair' | 'ontrack' | 'strong' {
    if (m >= 0.9) return 'strong';
    if (m >= 0.7) return 'ontrack';
    if (m >= 0.5) return 'fair';
    if (m >= 0.3) return 'weak';
    return 'critical';
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto"
      style={{ background: 'var(--bg)' }}
    >
      <div className="max-w-[420px] mx-auto px-4 py-8 flex flex-col gap-5">

        {/* Hero */}
        <div className="text-center spz-fade-up">
          <div
            className="w-[72px] h-[72px] rounded-[24px] flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--tier-strong-soft)', color: 'var(--tier-strong)' }}
          >
            <span style={{ fontSize: 34 }}>✓</span>
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 25, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
            Your plan is ready
          </h1>
          <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {"Here's where you stand in"} <strong>{subjectName}</strong> — no score, just your starting point.
          </p>
        </div>

        {/* Grade placement banner */}
        {placement && (() => {
          const banner = placementBanner(placement);
          return (
            <div className={`rounded-[16px] px-4 py-3 ${banner.bg}`}>
              <p className={`text-[13.5px] font-bold ${banner.text}`}>{banner.label}</p>
              <p className={`text-[12px] mt-0.5 ${banner.subText}`}>{banner.sub}</p>
            </div>
          );
        })()}

        {/* Chapter results -- one Card per chapter with Ring + TierPill */}
        <div className="flex flex-col gap-[10px]">
          {results.map((chapter, i) => {
            const tier = masteryToTier(chapter.avgMastery);
            return (
              <Card key={chapter.chapterId} pad={14} style={{ display: 'flex', alignItems: 'center', gap: 14, animationDelay: `${i * 0.07}s` }} className="spz-fade-up">
                <Ring tier={tier} size={48} stroke={5}>
                  <div style={{ width: 16, height: 16, borderRadius: 99, background: `var(--tier-${tier}-soft)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 7, height: 7, borderRadius: 99, background: `var(--tier-${tier})` }} />
                  </div>
                </Ring>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{chapter.chapterName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Starting tier</div>
                </div>
                <TierPill tier={tier} size="sm" />
              </Card>
            );
          })}
          {results.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-faint)', textAlign: 'center', padding: '16px 0' }}>
              No chapter data yet.
            </p>
          )}
        </div>

        {/* First focus nudge */}
        {results[0] && (
          <div
            className="spz-fade-up"
            style={{ padding: 16, borderRadius: 16, background: 'var(--primary-soft)', display: 'flex', gap: 12 }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
            <div style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--text)' }}>
              <strong>First focus:</strong> {results[0].chapterName}. {"It's the fastest way to lift your"} {subjectName} tier.
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ paddingBottom: 16 }}>
          <Btn
            full
            size="lg"
            onClick={() => {
              if (afterResultsPath === '/dashboard' && pendingDiagnosticSubjectNames.length > 0) {
                const list = pendingDiagnosticSubjectNames.join(', ');
                toast(`Complete diagnostics for ${list} to unlock your full learning plan.`, 6000);
              }
              router.push(afterResultsPath);
            }}
          >
            {afterResultsPath === '/dashboard' ? 'Go to dashboard →' : 'Next subject →'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Main DiagnosticFlow ───────────────────────────────────────────────────────

export default function DiagnosticFlow({
  subjectId,
  subjectName,
  questions,
  initialAnswers,
  initialIndex,
  boardSlug,
  grade,
  subjectSlug,
  pendingDiagnosticSubjectNames = [],
  afterResultsPath = '/dashboard',
}: DiagnosticFlowProps) {
  const router = useRouter();

  // Convert initialAnswers (no timeSpentMs) to PartialAnswer
  const [answers, setAnswers] = useState<PartialAnswer[]>(() =>
    initialAnswers.map((a) => ({ ...a, timeSpentMs: 0 })),
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questionList, setQuestionList] = useState<DiagnosticQuestion[]>(questions);
  // Stable: derived from the original prop so it does not flip when questionList grows.
  const isAdaptiveMode = questions.length === 0 && !!boardSlug && !!subjectSlug;
  // Expected total from start API (used for progress bar in adaptive mode).
  const [totalExpected, setTotalExpected] = useState<number>(questions.length || 0);

  // Bootstrap adaptive session: call start API to create server session and
  // receive the first question. Runs once on mount when adaptive mode is active.
  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      if (!isAdaptiveMode || sessionId) return;
      if (!boardSlug || !subjectSlug) return;
      setSubmitting(true);
      try {
        const res = await fetch('/api/student/diagnostic/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boardSlug, grade, subjectSlug }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          if (res.status === 429 && json?.code === 'RETAKE_COOLDOWN') {
            if (mounted) setStartError({ code: 'RETAKE_COOLDOWN', eligibleAt: json.eligibleAt });
          }
          return;
        }
        const json = await res.json();
        if (!mounted) return;
        if (json?.sessionId) setSessionId(json.sessionId);
        if (typeof json?.totalQuestions === 'number') setTotalExpected(json.totalQuestions);
        if (json?.firstQuestion) {
          const fq = json.firstQuestion as any;
          const mapped: DiagnosticQuestion = {
            id: fq.id,
            prompt: fq.prompt,
            choices: (fq.options ?? []).map((o: any) => (o?.label ? o.label : String(o))),
            correctAnswer: '',
            chapterId: fq.chapterId ?? '',
            chapterName: fq.chapterName ?? '',
            topicId: fq.topicId ?? '',
          };
          setQuestionList([mapped]);
          setCurrentIndex(0);
        }
      } finally {
        if (mounted) setSubmitting(false);
      }
    }
    bootstrap();
    return () => {
      mounted = false;
    };
  }, [isAdaptiveMode, sessionId, boardSlug, grade, subjectSlug]);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [showAbandon, setShowAbandon] = useState(false);
  const [savingPartial, setSavingPartial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [startError, setStartError] = useState<{ code: string; eligibleAt?: string } | null>(null);
  const [phase, setPhase] = useState<'quiz' | 'generating' | 'results'>('quiz');
  const [chapterResults, setChapterResults] = useState<ChapterResult[]>([]);
  const [placement, setPlacement] = useState<'below' | 'at' | 'above' | null>(null);

  const questionStartRef = useRef(Date.now());
  const finalAnswersRef = useRef<PartialAnswer[]>(answers);

  // Keep ref in sync for timer auto-submit
  useEffect(() => {
    finalAnswersRef.current = answers;
  }, [answers]);

  // Pre-fill selection if resuming
  useEffect(() => {
    const existing = answers.find((a) => a.questionId === questionList[currentIndex]?.id);
    setSelectedOption(existing?.selectedOption ?? '');
    questionStartRef.current = Date.now();
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'quiz') return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-submit with current answers
          submitDiagnostic(finalAnswersRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Abandon guard (beforeunload) ──────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'quiz') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Must be above every early-return (cooldown, results) so hook call order is
  // stable across all render paths.
  const currentChoices = useMemo(
    () => normaliseChoices(questionList[currentIndex]?.choices ?? []),
    [questionList, currentIndex],
  );

  const recordAnswer = useCallback(
    (option: string): PartialAnswer[] => {
      const timeSpentMs = Date.now() - questionStartRef.current;
      const questionId = questionList[currentIndex].id;
      const updated = answers.filter((a) => a.questionId !== questionId);
      updated.push({ questionId, selectedOption: option, timeSpentMs });
      return updated;
    },
    [answers, currentIndex, questionList],
  );

  async function savePartial(currentAnswers: PartialAnswer[]): Promise<void> {
    setSavingPartial(true);
    try {
      await fetch('/api/student/diagnostic/save-partial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          answers: currentAnswers.map(({ questionId, selectedOption: sel }) => ({
            questionId,
            selectedOption: sel,
          })),
          currentIndex,
        }),
      });
    } finally {
      setSavingPartial(false);
    }
  }

  async function submitDiagnostic(finalAnswers: PartialAnswer[]): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/student/diagnostic/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          answers: finalAnswers,
          ...(sessionId ? { sessionId } : {}),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSubmitError(json?.error ?? 'Could not submit. Please try again.');
        setSubmitting(false);
        return;
      }
      // Switch to generating phase: animate plan-building while bootstrap job runs.
      // Chapter results are computed locally from answered questions so they are
      // available instantly when the poll resolves (no second results fetch needed).
      const json = await res.json().catch(() => ({}));
      if (json?.placement) setPlacement(json.placement as 'below' | 'at' | 'above');
      const results = computeChapterResults(questionList, finalAnswers);
      setChapterResults(results);
      setPhase('generating');
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
      setSubmitting(false);
    }
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  function handleSelectOption(option: string) {
    setSelectedOption(option);
  }

  async function handleNext() {
    if (!selectedOption) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const updatedAnswers = recordAnswer(selectedOption);
      setAnswers(updatedAnswers);

      if (isAdaptiveMode) {
        // Send to adaptive answer API and append nextQuestion if present
        const questionId = questionList[currentIndex].id;
        const timeSpentMs = Date.now() - questionStartRef.current;
        const res = await fetch('/api/student/diagnostic/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, questionId, selectedOption, timeSpentMs }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setSubmitError(json?.error ?? 'Could not record answer.');
          setSubmitting(false);
          return;
        }
        const json = await res.json();
        // update sessionId if returned
        if (json?.sessionState?.sessionId) setSessionId(json.sessionState.sessionId);

        if (json.nextQuestion) {
          const nq = json.nextQuestion as any;
          const mapped: DiagnosticQuestion = {
            id: nq.id,
            prompt: nq.prompt,
            choices: (nq.options ?? []).map((o: any) => (o?.label ? o.label : String(o))),
            correctAnswer: '',
            chapterId: nq.chapterId ?? '',
            chapterName: nq.chapterName ?? '',
            topicId: nq.topicId ?? '',
          };
          setQuestionList((q) => [...q, mapped]);
          setCurrentIndex((i) => i + 1);
          setSelectedOption('');
          questionStartRef.current = Date.now();
          setSubmitting(false);
          return;
        }

        // No nextQuestion → diagnostic finished server-side
        await submitDiagnostic(updatedAnswers);
        setSubmitting(false);
        return;
      }

      // Non-adaptive: proceed locally
      if (currentIndex < questionList.length - 1) {
        setCurrentIndex((i) => i + 1);
        setSelectedOption('');
        questionStartRef.current = Date.now();
      } else {
        // Last question -- submit
        await submitDiagnostic(updatedAnswers);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveAndLeave() {
    const updatedAnswers = selectedOption ? recordAnswer(selectedOption) : answers;
    await savePartial(updatedAnswers);
    router.push('/student/dashboard');
  }

  function handleAbandon() {
    router.push('/student/dashboard');
  }

  // ── Cooldown screen (AC-08: retake before 30-day window) ─────────────────

  if (startError?.code === 'RETAKE_COOLDOWN') {
    const eligibleDateStr = startError.eligibleAt
      ? new Date(startError.eligibleAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'soon';
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-slate-950 px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FAEEDA] dark:bg-[#BA7517]/20 flex items-center justify-center mx-auto mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2" className="w-8 h-8" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Diagnostic completed
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Your next retake is available on
          </p>
          <p className="text-sm font-semibold text-[#BA7517] mb-6">{eligibleDateStr}</p>
          <button
            type="button"
            onClick={() => router.push('/student/dashboard')}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  // -- Generating phase --------------------------------------------------------
  // Shown between quiz submit and the knowledge-map results while the
  // diagnostic bootstrap job builds StudentConceptState + LearningPlan.

  if (phase === 'generating') {
    return (
      <GeneratingPlanScreen
        subjectId={subjectId}
        onReady={() => setPhase('results')}
      />
    );
  }

  // -- Results phase -----------------------------------------------------------

  if (phase === 'results') {
    return (
      <KnowledgeMapResults
        subjectName={subjectName}
        results={chapterResults}
        placement={placement}
        pendingDiagnosticSubjectNames={pendingDiagnosticSubjectNames}
        afterResultsPath={afterResultsPath}
      />
    );
  }

  // ── Quiz phase ────────────────────────────────────────────────────────────

  const currentQuestion = questionList[currentIndex];
  if (!currentQuestion) return null;

  // In adaptive mode totalExpected comes from the start API; in non-adaptive it is the
  // fixed question list length. Guard against divide-by-zero with Math.max.
  const denominator = Math.max(isAdaptiveMode ? totalExpected : questionList.length, 1);
  const progressPct = Math.round(((currentIndex + 1) / denominator) * 100);
  // In adaptive mode the server decides when to stop -- the button never says "Submit".
  const isLast = isAdaptiveMode ? false : currentIndex === questionList.length - 1;
  const isAmber = secondsLeft <= AMBER_THRESHOLD;

  return (
    <>
      {/* Abandon confirm dialog */}
      {showAbandon && (
        <AbandonDialog
          onSave={handleSaveAndLeave}
          onAbandon={handleAbandon}
          onCancel={() => setShowAbandon(false)}
          busy={savingPartial}
        />
      )}

      {/* Full-screen overlay -- covers StudentNav */}
      <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-slate-950 overflow-y-auto">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 px-4 pt-safe-top">

          {/* Progress bar */}
          <div className="h-1 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-[#534AB7] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between py-3 gap-3">
            {/* Question counter */}
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 shrink-0">
              Question{' '}
              <span className="text-gray-900 dark:text-gray-100 font-bold">
                {currentIndex + 1}
              </span>{' '}
              of ~{isAdaptiveMode ? totalExpected : questionList.length}
            </p>

            {/* Timer */}
            <div
              className={`flex items-center gap-1.5 text-sm font-mono font-semibold shrink-0 transition-colors ${
                isAmber
                  ? 'text-[#BA7517]'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
              aria-live="polite"
              aria-label={`Time remaining: ${formatTime(secondsLeft)}`}
            >
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {formatTime(secondsLeft)}
              {isAmber && (
                <span className="text-xs font-normal ml-1 text-[#BA7517]">-- finishing soon</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Question card ─────────────────────────────────────────────────── */}
        <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full flex flex-col gap-5">

          {/* Subject + chapter badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/15 px-2.5 py-1 rounded-full">
              {subjectName}
            </span>
            {currentQuestion.chapterName && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                {currentQuestion.chapterName}
              </span>
            )}
          </div>

          <QuestionInteractionShell
            questionId={currentQuestion.id}
            prompt={currentQuestion.prompt}
            questionNumber={currentIndex + 1}
            totalQuestions={denominator}
            choices={currentChoices}
            value={selectedOption}
            onChange={(key) => {
              const match = currentChoices.find((c) => c.key === key);
              handleSelectOption(match?.label ?? key);
            }}
            disabled={submitting}
          />

          {/* Submit error */}
          {submitError && (
            <p role="alert" className="text-xs text-[#E24B4A] dark:text-red-400">
              {submitError}
            </p>
          )}
        </div>

        {/* ── Bottom actions ────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 px-4 py-4 flex flex-col gap-3 pb-safe-bottom">
          <button
            type="button"
            onClick={handleNext}
            disabled={!selectedOption || submitting}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] disabled:opacity-50 transition-all shadow-md shadow-[#534AB7]/25"
          >
            {submitting ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Submitting...
              </>
            ) : isLast ? (
              'Submit diagnostic →'
            ) : (
              'Next question →'
            )}
          </button>

          {/* Plain text link -- saves directly without a confirm dialog */}
          <button
            type="button"
            onClick={handleSaveAndLeave}
            disabled={submitting || savingPartial}
            className="flex w-full min-h-[44px] items-center justify-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            {savingPartial ? 'Saving...' : 'Save and continue later'}
          </button>
        </div>
      </div>
    </>
  );
}
