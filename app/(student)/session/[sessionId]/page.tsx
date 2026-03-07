"use client";

/**
 * Session UI — renders the 6-phase learning flow:
 *   OVERVIEW → EXPLANATION → PRACTICE → TEST → HOMEWORK → COMPLETE
 *
 * UX improvements (2026-03-07, Phase 2):
 *   - SessionPhaseStepper extracted as a reusable component
 *   - Practice: batch submit → show per-question feedback (correct/incorrect +
 *     correct answer). No score shown during practice.
 *   - Test: plain-language result card after submission; never blocking
 *   - Explanation: reading time estimate + "I've understood this" CTA
 *   - Homework: "Save & submit later" option; tutor-voiced framing
 *
 * Architecture notes:
 *   - The page mounts by fetching GET /api/session/[sessionId].
 *   - "Next Step" calls POST /api/session/next (advanceSession in the engine).
 *   - "Finish early" calls POST /api/session/complete (force-complete).
 *   - All content is returned inline in the API responses so no extra fetches
 *     are needed per phase.
 *   - Session state is the source of truth — the UI never writes phase directly.
 *
 * EDIT LOG:
 *   2026-03-07 | Manish Kumar | add OVERVIEW phase card; use currentPhase
 *                               as canonical field; keep state alias for compat.
 *   2026-03-07 | UX implementation | Phase 2 UX improvements (stepper, feedback,
 *               plain-language test results, reading time, homework framing).
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import TopicCompletionModal from "@/components/dashboard/TopicCompletionModal";
import SessionPhaseStepper from "@/components/session/SessionPhaseStepper";

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionPhase =
  | "OVERVIEW"
  | "EXPLANATION"
  | "PRACTICE"
  | "TEST"
  | "HOMEWORK"
  | "COMPLETE";

interface SessionData {
  sessionId: string;
  topicId: string;
  topicName: string;
  subject: string;
  chapter: string;
  currentPhase: SessionPhase;
  state: SessionPhase;
  startedAt: string;
  completedAt: string | null;
}

interface PhaseData {
  phase: SessionPhase;
  label: string;
  instruction: string;
}

interface HomeworkData {
  id: string;
  status: string;
  score: number | null;
  dueDate: string;
}

// ── Content types ─────────────────────────────────────────────────────────────

interface OverviewContent {
  type: "overview";
  topicName: string;
  subject: string;
  chapter: string;
  summary: string | null;
  objectives: string[];
  upcomingPhases: string[];
}

interface ExplanationContent {
  type: "explanation";
  noteId: string;
  title: string;
  contentJson: NoteJson;
}

interface NoteJson {
  title?: string;
  summary?: string;
  introduction?: string;
  sections?: NoteSection[];
  content?: NoteJson;
  keyPoints?: string[];
  objectives?: string[];
  [key: string]: unknown;
}

interface NoteSection {
  title?: string;
  heading?: string;
  content?: string;
  body?: string;
  points?: string[];
  subsections?: NoteSection[];
}

interface PracticeQuestion {
  id: string;
  type: string;
  prompt: string;
  choices: string[] | Record<string, string> | null;
  difficulty: string | null;
  hint?: string | null;
}

interface PracticeContent {
  type: "practice";
  questions: PracticeQuestion[];
}

interface TestQuestion {
  id: string;
  type: string;
  question: string;
  options: string[] | Record<string, string> | null;
  explanation: string | null;
}

interface TestContent {
  type: "test";
  testId: string;
  title: string;
  difficulty: string;
  questions: TestQuestion[];
}

interface HomeworkContent {
  type: "homework";
  assignmentId: string;
  status: string;
  dueDate: string;
  score: number | null;
  questions: unknown;
}

interface PendingContent {
  type: "pending";
  message: string;
}

interface CompleteContent {
  type: "complete";
}

type ContentData =
  | OverviewContent
  | ExplanationContent
  | PracticeContent
  | TestContent
  | HomeworkContent
  | PendingContent
  | CompleteContent;

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASES: SessionPhase[] = ["OVERVIEW", "EXPLANATION", "PRACTICE", "TEST", "HOMEWORK"];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [phase, setPhase] = useState<PhaseData | null>(null);
  const [content, setContent] = useState<ContentData | null>(null);
  const [homework, setHomework] = useState<HomeworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationFiredRef = useRef(false);

  const applyResponse = useCallback((data: {
    session: SessionData;
    phase: PhaseData;
    content?: ContentData;
    homework?: HomeworkData | null;
  }) => {
    setSession(data.session);
    setPhase(data.phase);
    if (data.content) setContent(data.content);
    if (data.homework !== undefined) setHomework(data.homework);
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}`);
      if (!res.ok) throw new Error("Failed to load session");
      applyResponse(await res.json());
    } catch {
      setError("Could not load session.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, applyResponse]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  useEffect(() => {
    const currentPhase = session?.currentPhase ?? session?.state;
    if (currentPhase === "COMPLETE" && !celebrationFiredRef.current) {
      celebrationFiredRef.current = true;
      setShowCelebration(true);
    }
  }, [session?.currentPhase, session?.state]);

  const handleNext = useCallback(async () => {
    if (advancing || !session) return;
    setAdvancing(true);
    try {
      const res = await fetch("/api/session/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      if (!res.ok) throw new Error("Failed to advance");
      applyResponse(await res.json());
    } catch {
      setError("Failed to advance session.");
    } finally {
      setAdvancing(false);
    }
  }, [advancing, session, applyResponse]);

  const handleComplete = useCallback(async () => {
    if (advancing || !session) return;
    setAdvancing(true);
    try {
      const res = await fetch("/api/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      if (!res.ok) throw new Error("Failed to complete");
      applyResponse(await res.json());
    } catch {
      setError("Failed to complete session.");
    } finally {
      setAdvancing(false);
    }
  }, [advancing, session, applyResponse]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
          <div className="h-2 w-full bg-gray-100 rounded-full" />
          <div className="h-40 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !session || !phase) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">{error || "Session not found."}</p>
        <Link href="/dashboard" className="text-indigo-600 hover:underline mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const currentPhase: SessionPhase = session.currentPhase ?? session.state;
  const currentIdx = PHASES.indexOf(currentPhase);
  const isComplete = currentPhase === "COMPLETE";
  const isLastDisplayablePhase = currentIdx === PHASES.length - 1;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-4">
        <p className="text-sm text-gray-500">
          {session.subject}{session.chapter ? ` · ${session.chapter}` : ""}
        </p>
        <h1 className="text-2xl font-bold mt-0.5">{session.topicName}</h1>
      </div>

      {/* Phase Stepper */}
      {!isComplete && (
        <div className="mb-8">
          <SessionPhaseStepper phases={PHASES} currentPhase={currentPhase} />
        </div>
      )}

      {/* Topic completion modal */}
      {showCelebration && session && (
        <TopicCompletionModal
          topicName={session.topicName}
          topicId={session.topicId}
          onClose={() => setShowCelebration(false)}
        />
      )}

      {/* Phase Content Card */}
      <div className="bg-white rounded-xl border shadow-sm p-6 sm:p-8 mb-6">
        {isComplete ? (
          <CompletionView phase={phase} />
        ) : (
          <>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-900">{phase.label}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{phase.instruction}</p>
            </div>

            <PhaseContentRenderer
              sessionId={sessionId}
              content={content}
              homework={homework}
              router={router}
              onAdvance={handleNext}
              onTestSubmitted={() => setSession((s) => s ? { ...s } : null)}
            />

            {/* Footer actions — shown only for phases that don't own their CTA */}
            {shouldShowFooterActions(currentPhase) && (
              <div className="flex items-center gap-3 mt-8 pt-6 border-t">
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={advancing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {advancing
                    ? "Loading…"
                    : currentPhase === "OVERVIEW"
                    ? "Begin"
                    : isLastDisplayablePhase
                    ? "Finish"
                    : "Next Step"}
                  {!advancing && (
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {currentPhase !== "OVERVIEW" && !isLastDisplayablePhase && (
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={advancing}
                    className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 focus:outline-none"
                  >
                    Skip to finish
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  );
}

/** OVERVIEW and EXPLANATION show footer buttons; other phases own their CTA. */
function shouldShowFooterActions(phase: SessionPhase): boolean {
  return phase === "OVERVIEW" || phase === "EXPLANATION";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CompletionView({ phase }: { phase: PhaseData }) {
  return (
    <div className="text-center py-8">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-gray-900">Topic Complete</h2>
      <p className="text-gray-500 mt-2">{phase.instruction}</p>
      <Link
        href="/dashboard"
        className="inline-block mt-6 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

function PhaseContentRenderer({
  sessionId,
  content,
  homework,
  router,
  onAdvance,
  onTestSubmitted,
}: {
  sessionId: string;
  content: ContentData | null;
  homework: HomeworkData | null;
  router: ReturnType<typeof useRouter>;
  onAdvance: () => void;
  onTestSubmitted?: () => void;
}) {
  if (!content) return <p className="text-gray-400 italic text-sm">Loading content...</p>;

  if (content.type === "pending") {
    return (
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <svg className="w-5 h-5 text-amber-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-amber-800">{content.message}</p>
      </div>
    );
  }

  switch (content.type) {
    case "overview":    return <OverviewView content={content} />;
    case "explanation": return <ExplanationView content={content} onReady={onAdvance} />;
    case "practice":    return <PracticeView sessionId={sessionId} content={content} onAdvance={onAdvance} />;
    case "test":        return <TestView sessionId={sessionId} content={content} onAdvance={onAdvance} onTestSubmitted={onTestSubmitted} />;
    case "homework":    return <HomeworkView content={content} homework={homework} router={router} onAdvance={onAdvance} />;
    case "complete":    return null;
    default:            return null;
  }
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewView({ content }: { content: OverviewContent }) {
  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
        {content.subject}{content.chapter ? ` › ${content.chapter}` : ""}
      </p>

      {content.summary ? (
        <p className="text-gray-700 leading-relaxed">{content.summary}</p>
      ) : (
        <p className="text-gray-500 text-sm italic">
          Get ready to dive into{" "}
          <span className="font-medium text-gray-700">{content.topicName}</span>.
        </p>
      )}

      {content.objectives.length > 0 && (
        <div className="bg-indigo-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-indigo-800 mb-2">What you will learn</h4>
          <ul className="space-y-1.5">
            {content.objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-indigo-700">
                <span className="mt-0.5 text-indigo-400" aria-hidden>✓</span>
                {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.upcomingPhases.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Session flow
          </h4>
          <div className="flex flex-wrap gap-2">
            {content.upcomingPhases.map((label, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-600 font-medium"
              >
                <span className="text-gray-400">{i + 1}.</span> {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Explanation ──────────────────────────────────────────────────────────────

function ExplanationView({
  content,
  onReady,
}: {
  content: ExplanationContent;
  onReady: () => void;
}) {
  const json = unwrapNoteJson(content.contentJson);

  // Estimate reading time at ~200 words/min
  const wordCount = JSON.stringify(json).replace(/"[^"]*":/g, "").split(/\s+/).length;
  const readingMin = Math.max(1, Math.round(wordCount / 200));

  return (
    <div>
      <div className="prose prose-indigo max-w-none">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{content.title}</h3>
        <p className="text-xs text-gray-400 mb-4">Reading time: about {readingMin} min</p>

        {json.introduction && (
          <p className="text-gray-700 leading-relaxed">{json.introduction}</p>
        )}
        {json.summary && !json.introduction && (
          <p className="text-gray-700 leading-relaxed">{json.summary}</p>
        )}

        {json.objectives && json.objectives.length > 0 && (
          <div className="my-4 bg-indigo-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-indigo-800 mb-2">Learning Objectives</h4>
            <ul className="list-disc list-inside space-y-1">
              {json.objectives.map((o, i) => (
                <li key={i} className="text-sm text-indigo-700">{o}</li>
              ))}
            </ul>
          </div>
        )}

        {json.sections?.map((sec, i) => (
          <div key={i} className="mt-5">
            <h4 className="text-base font-semibold text-gray-800 mb-2">
              {sec.title || sec.heading}
            </h4>
            {(sec.content || sec.body) && (
              <p className="text-gray-600 whitespace-pre-line">{sec.content || sec.body}</p>
            )}
            {sec.points && sec.points.length > 0 && (
              <ul className="list-disc list-inside mt-2 space-y-1">
                {sec.points.map((pt, j) => (
                  <li key={j} className="text-gray-600 text-sm">{pt}</li>
                ))}
              </ul>
            )}
            {sec.subsections?.map((sub, k) => (
              <div key={k} className="ml-4 mt-3">
                <h5 className="text-sm font-medium text-gray-700">{sub.title || sub.heading}</h5>
                {(sub.content || sub.body) && (
                  <p className="text-gray-500 text-sm mt-1 whitespace-pre-line">
                    {sub.content || sub.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}

        {json.keyPoints && json.keyPoints.length > 0 && (
          <div className="mt-6 bg-green-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-800 mb-2">Key Points</h4>
            <ul className="list-disc list-inside space-y-1">
              {json.keyPoints.map((kp, i) => (
                <li key={i} className="text-sm text-green-700">{kp}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* "I've understood this" CTA — explicit student confirmation */}
      <div className="mt-8 pt-6 border-t flex items-center gap-3">
        <button
          type="button"
          onClick={onReady}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 active:scale-95 transition-transform"
        >
          I've understood this
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Read again
        </button>
      </div>
    </div>
  );
}

function unwrapNoteJson(raw: NoteJson): NoteJson {
  if (
    raw?.content &&
    typeof raw.content === "object" &&
    ("sections" in raw.content || "summary" in raw.content)
  ) {
    return raw.content as NoteJson;
  }
  return raw;
}

// ─── Practice ─────────────────────────────────────────────────────────────────

interface PracticeResult {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string | null;
}

/**
 * PracticeView — per-question sequential flow
 *
 * Phase 1 (answering): shows one question at a time. Student selects an
 * option and clicks "Submit Answer". The answer is recorded locally and the
 * view advances to the next question. No feedback is shown yet. After the
 * last question the batch is submitted to the API.
 *
 * Phase 2 (review): shows one result at a time with correct/incorrect
 * indicator and the correct answer for wrong answers. "Next Question →"
 * advances through each result. The final question shows "Continue to Test →".
 *
 * This matches the UX spec wireframe exactly without requiring per-question
 * API calls — the batch endpoint is called once after all questions are answered.
 */
function PracticeView({
  sessionId,
  content,
  onAdvance,
}: {
  sessionId: string;
  content: PracticeContent;
  onAdvance: () => void;
}) {
  const totalQ = content.questions.length;

  // Phase 1: answering
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [committedAnswers, setCommittedAnswers] = useState<Record<string, string>>({});
  const [hintOpen, setHintOpen] = useState(false);

  // Phase 2: reviewing results
  const [results, setResults] = useState<PracticeResult[] | null>(null);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentQ = content.questions[currentIdx];
  const isAnsweringPhase = results === null && !submitting;
  const isLoadingPhase = submitting;
  const isReviewPhase = results !== null;

  // ── Submit all answers after last question ──────────────────────────────────
  const submitAllAnswers = async (finalAnswers: Record<string, string>) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/session/${sessionId}/practice/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(finalAnswers).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to submit");
      }
      const data = (await res.json()) as { results: PracticeResult[] };
      setResults(data.results ?? []);
      setReviewIdx(0);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Commit current answer and advance ──────────────────────────────────────
  const handleCommitAnswer = () => {
    if (!selectedOption || !currentQ) return;
    const updated = { ...committedAnswers, [currentQ.id]: selectedOption };
    setCommittedAnswers(updated);
    setSelectedOption(null);
    setHintOpen(false);

    if (currentIdx < totalQ - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      submitAllAnswers(updated);
    }
  };

  // ── Loading state (batch API call in flight) ───────────────────────────────
  if (isLoadingPhase) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Checking your answers…</p>
      </div>
    );
  }

  // ── Review phase: one result at a time ────────────────────────────────────
  if (isReviewPhase && results) {
    const resultMap = new Map(results.map((r) => [r.questionId, r]));
    const reviewQ = content.questions[reviewIdx];
    const reviewResult = resultMap.get(reviewQ?.id ?? "");
    const reviewOptions = normalizeChoices(reviewQ?.choices ?? null);
    const committedAnswer = committedAnswers[reviewQ?.id ?? ""];
    const isLast = reviewIdx === totalQ - 1;

    return (
      <div className="space-y-5">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Question {reviewIdx + 1} of {totalQ}
          </p>
          {reviewResult && (
            <span className={`text-sm font-bold ${reviewResult.isCorrect ? "text-green-600" : "text-red-500"}`}>
              {reviewResult.isCorrect ? "✓  Correct" : "✗  Not quite"}
            </span>
          )}
        </div>

        {/* Question + options (locked) */}
        <div className={`rounded-xl p-4 border ${
          reviewResult?.isCorrect ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
        }`}>
          <p className="font-medium text-gray-800 text-sm leading-snug mb-3">{reviewQ?.prompt}</p>
          <div className="space-y-2">
            {reviewOptions.map((opt, oi) => {
              const isChosen = committedAnswer === opt;
              const isCorrectOpt =
                reviewResult?.correctAnswer === opt ||
                reviewResult?.correctAnswer === String.fromCharCode(65 + oi).toLowerCase();
              const cls = (() => {
                if (isCorrectOpt) return "border-green-500 bg-green-100 text-green-800 font-medium";
                if (isChosen && !reviewResult?.isCorrect) return "border-red-400 bg-red-100 text-red-700";
                return "border-gray-200 bg-white text-gray-400";
              })();
              return (
                <div key={oi} className={`w-full px-4 py-2.5 rounded-lg border text-sm ${cls}`}>
                  <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                  {opt}
                </div>
              );
            })}
          </div>
          {reviewResult && !reviewResult.isCorrect && reviewResult.correctAnswer && (
            <p className="mt-3 text-sm text-gray-600">
              The correct answer is{" "}
              <span className="font-semibold text-green-700">{reviewResult.correctAnswer}</span>
            </p>
          )}
        </div>

        {submitError && <p className="text-sm text-red-500">{submitError}</p>}

        {isLast ? (
          <button
            type="button"
            onClick={onAdvance}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 active:scale-95 transition-transform"
          >
            Continue to Test
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setReviewIdx((i) => i + 1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gray-700 rounded-xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 active:scale-95 transition-transform"
          >
            Next Question
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // ── Answering phase: one question at a time ───────────────────────────────
  if (!currentQ) return null;
  const options = normalizeChoices(currentQ.choices);

  return (
    <div className="space-y-5">
      {/* Progress counter */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        Question {currentIdx + 1} of {totalQ}
      </p>

      {/* Question card */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="font-medium text-gray-800 text-sm leading-snug mb-4">{currentQ.prompt}</p>

        {currentQ.difficulty && (
          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 mb-3 capitalize">
            {currentQ.difficulty}
          </span>
        )}

        <div className="space-y-2">
          {options.map((opt, oi) => {
            const isSelected = selectedOption === opt;
            return (
              <button
                key={oi}
                type="button"
                onClick={() => setSelectedOption(opt)}
                className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hint (only rendered if hint data exists on the question) */}
      {currentQ.hint && (
        <div>
          <button
            type="button"
            onClick={() => setHintOpen((o) => !o)}
            className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            {hintOpen ? "Hide hint" : "Show hint"}
          </button>
          {hintOpen && (
            <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              {currentQ.hint}
            </p>
          )}
        </div>
      )}

      {submitError && <p className="text-sm text-red-500">{submitError}</p>}

      <button
        type="button"
        onClick={handleCommitAnswer}
        disabled={!selectedOption}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-green-500 active:scale-95 transition-transform"
      >
        Submit Answer
      </button>
    </div>
  );
}

// ─── Test ─────────────────────────────────────────────────────────────────────

interface TestSubmitResult {
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  results: { questionId: string; isCorrect: boolean; correctAnswer?: string }[];
}

function TestView({
  sessionId,
  content,
  onAdvance,
  onTestSubmitted,
}: {
  sessionId: string;
  content: TestContent;
  onAdvance: () => void;
  onTestSubmitted?: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestSubmitResult | null>(null);
  const [showReview, setShowReview] = useState(false);

  const handleSelect = (qId: string, val: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const allAnswered =
    content.questions.length > 0 &&
    Object.keys(answers).length >= content.questions.length;

  const handleSubmit = async () => {
    if (submitted || submitting || !allAnswered) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/session/${sessionId}/test/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to submit test");
      }
      const data = (await res.json()) as TestSubmitResult;
      setTestResult(data);
      setSubmitted(true);
      onTestSubmitted?.();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit test");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Post-submit: plain-language result ─────────────────────────────────────
  if (submitted && testResult) {
    const { correctAnswers, totalAnswers } = testResult;
    const pct = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;
    const message =
      pct >= 80
        ? "You've understood the core concept well."
        : pct >= 60
        ? "Good effort. A couple of areas need more practice."
        : "This topic needs more attention. Your homework will help.";

    const resultMap = new Map(testResult.results.map((r) => [r.questionId, r]));

    return (
      <div className="space-y-5">
        {/* Plain-language result — no percentage, no grade */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-center">
          <p className="text-2xl font-bold text-indigo-800">
            {correctAnswers} of {totalAnswers} correct
          </p>
          <p className="mt-1 text-sm text-indigo-600">{message}</p>
        </div>

        {/* Review answers — optional, not forced */}
        <button
          type="button"
          onClick={() => setShowReview((v) => !v)}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          {showReview ? "Hide answers" : "Review answers"}
        </button>

        {showReview && (
          <div className="space-y-3">
            {content.questions.map((q, qi) => {
              const result = resultMap.get(q.id);
              return (
                <div
                  key={q.id}
                  className={`rounded-xl p-4 border text-sm ${
                    result?.isCorrect
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <p className="font-medium text-gray-800 mb-1">
                    {qi + 1}. {q.question}
                    <span
                      className={`ml-2 font-bold ${
                        result?.isCorrect ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {result?.isCorrect ? "✓" : "✗"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Your answer:{" "}
                    <span className="font-medium">{answers[q.id] ?? "—"}</span>
                    {!result?.isCorrect && result?.correctAnswer && (
                      <>
                        {" "}
                        · Correct:{" "}
                        <span className="font-medium text-green-700">
                          {result.correctAnswer}
                        </span>
                      </>
                    )}
                  </p>
                  {q.explanation && (
                    <p className="mt-2 text-xs text-gray-500 bg-white rounded p-2 border border-gray-100">
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Always-enabled continue — NEVER blocked by score */}
        <button
          type="button"
          onClick={onAdvance}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 active:scale-95 transition-transform"
        >
          Continue to Homework
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    );
  }

  // ── Pre-submit: question list (no hints, no mid-test feedback) ─────────────
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">Quick Test</p>
        <p>
          {content.questions.length} question
          {content.questions.length > 1 ? "s" : ""} &nbsp;·&nbsp; No hints &nbsp;·&nbsp; No time
          limit
        </p>
        <p className="text-xs mt-1 text-amber-600">
          Answers will be revealed after you submit.
        </p>
      </div>

      {content.questions.map((q, qi) => {
        const options = normalizeChoices(q.options);
        return (
          <div key={q.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="font-medium text-gray-800 text-sm mb-3">
              {qi + 1}. {q.question}
            </p>
            <div className="space-y-2">
              {options.map((opt, oi) => {
                const isSelected = answers[q.id] === opt;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => handleSelect(q.id, opt)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {submitError && <p className="text-sm text-red-500">{submitError}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !allAnswered}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        {submitting ? "Submitting…" : "Submit Test"}
      </button>
    </div>
  );
}

// ─── Homework ──────────────────────────────────────────────────────────────────

function HomeworkView({
  content,
  homework,
  router,
  onAdvance,
}: {
  content: HomeworkContent;
  homework: HomeworkData | null;
  router: ReturnType<typeof useRouter>;
  onAdvance: () => void;
}) {
  const hw = homework ?? content;
  const isGraded = hw.status === "GRADED";
  const isSubmitted = hw.status === "SUBMITTED" || isGraded;
  const questions = Array.isArray(content.questions)
    ? (content.questions as { id: string; prompt?: string; question?: string }[])
    : [];
  const dueDate = new Date(content.dueDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="space-y-5">
      {/* Tutor-voiced framing */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-medium text-amber-800">
          Your tutor has assigned {questions.length} homework question
          {questions.length !== 1 ? "s" : ""}.
        </p>
        <p className="text-xs text-amber-600 mt-1">Due {dueDate}</p>
        {isGraded && hw.score != null && (
          <p className="text-xs text-green-700 mt-1 font-medium">
            {hw.score >= 0.9
              ? "Mastered"
              : hw.score >= 0.75
              ? "Understood"
              : hw.score >= 0.5
              ? "Getting there"
              : "Needs more practice"}
          </p>
        )}
        {isSubmitted && (
          <p className="text-xs text-green-700 mt-1">
            Submitted. Your tutor will review it.
          </p>
        )}
      </div>

      {/* Question list (display only) */}
      {questions.length > 0 && (
        <ul className="space-y-2">
          {questions.map((q, i) => (
            <li
              key={q.id || i}
              className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 border border-gray-100"
            >
              {i + 1}. {q.prompt || q.question || "Question"}
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      {!isSubmitted && content.assignmentId && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => router.push(`/homework/${content.assignmentId}`)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            Submit Answers
          </button>
          {/* Save & Submit Later — first-class option per UX spec */}
          <button
            type="button"
            onClick={onAdvance}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 focus:outline-none"
          >
            Save &amp; Submit Later
          </button>
        </div>
      )}

      {isSubmitted && (
        <button
          type="button"
          onClick={onAdvance}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Finish Session
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeChoices(
  raw: string[] | Record<string, string> | null | unknown,
): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "object") return Object.values(raw as Record<string, string>);
  return [];
}
