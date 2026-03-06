"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionData {
  sessionId: string;
  topicId: string;
  topicName: string;
  subject: string;
  chapter: string;
  state: string;
  startedAt: string;
  completedAt: string | null;
}

interface PhaseData {
  phase: string;
  label: string;
  instruction: string;
}

interface HomeworkData {
  id: string;
  status: string;
  score: number | null;
  dueDate: string;
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
  | ExplanationContent
  | PracticeContent
  | TestContent
  | HomeworkContent
  | PendingContent
  | CompleteContent;

const PHASES = ["EXPLANATION", "PRACTICE", "TEST", "HOMEWORK", "COMPLETE"];

const PHASE_ICONS: Record<string, string> = {
  EXPLANATION: "\u{1F4D6}",
  PRACTICE: "\u{270F}\uFE0F",
  TEST: "\u{1F4DD}",
  HOMEWORK: "\u{1F4CB}",
  COMPLETE: "\u{2705}",
};

// ─── Main Page ───────────────────────────────────────────────────────────────

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

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

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

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
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

  const currentIdx = PHASES.indexOf(session.state);
  const isComplete = session.state === "COMPLETE";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-500">
          {session.subject} &middot; {session.chapter}
        </p>
        <h1 className="text-2xl font-bold mt-1">{session.topicName}</h1>
      </div>

      {/* Phase Progress Bar */}
      <div className="flex items-center gap-1 mb-8">
        {PHASES.slice(0, -1).map((p, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={p} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full h-2 rounded-full transition-colors ${
                  done ? "bg-indigo-600" : active ? "bg-indigo-400" : "bg-gray-200"
                }`}
              />
              <span
                className={`text-xs ${
                  done || active ? "text-indigo-600 font-medium" : "text-gray-400"
                }`}
              >
                {PHASE_ICONS[p]} {p.charAt(0) + p.slice(1).toLowerCase()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Phase Content Card */}
      <div className="bg-white rounded-lg border p-8 mb-6">
        {isComplete ? (
          <CompletionView phase={phase} />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{PHASE_ICONS[session.state]}</span>
              <div>
                <h2 className="text-xl font-semibold">{phase.label}</h2>
                <p className="text-sm text-gray-500">
                  Step {currentIdx + 1} of {PHASES.length - 1}
                </p>
              </div>
            </div>

            {/* Resolved content */}
            <PhaseContentRenderer
              content={content}
              homework={homework}
              sessionState={session.state}
              router={router}
            />

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-8 pt-6 border-t">
              <button
                type="button"
                onClick={handleNext}
                disabled={advancing}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {advancing
                  ? "Loading\u2026"
                  : currentIdx === PHASES.length - 2
                  ? "Finish"
                  : "Next Step"}
                {!advancing && (
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>

              {currentIdx < PHASES.length - 2 && (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={advancing}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 focus:outline-none"
                >
                  Skip to finish
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CompletionView({ phase }: { phase: PhaseData }) {
  return (
    <div className="text-center py-8">
      <div className="text-5xl mb-4">{"\u{1F389}"}</div>
      <h2 className="text-2xl font-bold text-gray-900">Topic Complete!</h2>
      <p className="text-gray-500 mt-2">{phase.instruction}</p>
      <Link
        href="/dashboard"
        className="inline-block mt-6 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

function PhaseContentRenderer({
  content,
  homework,
  sessionState,
  router,
}: {
  content: ContentData | null;
  homework: HomeworkData | null;
  sessionState: string;
  router: ReturnType<typeof useRouter>;
}) {
  if (!content) return <p className="text-gray-400 italic">Loading content...</p>;

  if (content.type === "pending") {
    return (
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <svg className="w-5 h-5 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-sm text-amber-800">{content.message}</p>
      </div>
    );
  }

  switch (content.type) {
    case "explanation":
      return <ExplanationView content={content} />;
    case "practice":
      return <PracticeView content={content} />;
    case "test":
      return <TestView content={content} />;
    case "homework":
      return <HomeworkView content={content} homework={homework} router={router} />;
    case "complete":
      return null;
    default:
      return null;
  }
}

// ─── Explanation ─────────────────────────────────────────────────────────────

function ExplanationView({ content }: { content: ExplanationContent }) {
  const json = unwrapNoteJson(content.contentJson);
  return (
    <div className="prose prose-indigo max-w-none">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">{content.title}</h3>

      {json.introduction && <p className="text-gray-700 leading-relaxed">{json.introduction}</p>}
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
  );
}

function unwrapNoteJson(raw: NoteJson): NoteJson {
  if (raw?.content && typeof raw.content === "object" && ("sections" in raw.content || "summary" in raw.content)) {
    return raw.content as NoteJson;
  }
  return raw;
}

// ─── Practice ────────────────────────────────────────────────────────────────

function PracticeView({ content }: { content: PracticeContent }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (qId: string, val: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-600 text-sm">
        Answer the following {content.questions.length} question
        {content.questions.length > 1 ? "s" : ""} to practice.
      </p>

      {content.questions.map((q, qi) => {
        const options = normalizeChoices(q.choices);
        return (
          <div key={q.id} className="bg-gray-50 rounded-lg p-4">
            <p className="font-medium text-gray-800 mb-3">
              {qi + 1}. {q.prompt}
            </p>
            {q.difficulty && (
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 mb-2 capitalize">
                {q.difficulty}
              </span>
            )}
            <div className="space-y-2 mt-1">
              {options.map((opt, oi) => {
                const selected = answers[q.id] === opt;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => handleSelect(q.id, opt)}
                    className={`w-full text-left px-4 py-2.5 rounded-md border text-sm transition-colors ${
                      selected
                        ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span className="font-medium mr-2">
                      {String.fromCharCode(65 + oi)}.
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {!submitted && content.questions.length > 0 && (
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          disabled={Object.keys(answers).length < content.questions.length}
          className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Check Answers
        </button>
      )}

      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-green-800">
            {Object.keys(answers).length} answer{Object.keys(answers).length > 1 ? "s" : ""}{" "}
            recorded. Move to the next step when ready.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Test ────────────────────────────────────────────────────────────────────

function TestView({ content }: { content: TestContent }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (qId: string, val: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-gray-600 text-sm">
          {content.title} &middot; {content.questions.length} question
          {content.questions.length > 1 ? "s" : ""}
        </p>
        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 capitalize">
          {content.difficulty}
        </span>
      </div>

      {content.questions.map((q, qi) => {
        const options = normalizeChoices(q.options);
        return (
          <div key={q.id} className="bg-gray-50 rounded-lg p-4">
            <p className="font-medium text-gray-800 mb-3">
              {qi + 1}. {q.question}
            </p>
            <div className="space-y-2">
              {options.map((opt, oi) => {
                const selected = answers[q.id] === opt;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => handleSelect(q.id, opt)}
                    className={`w-full text-left px-4 py-2.5 rounded-md border text-sm transition-colors ${
                      selected
                        ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span className="font-medium mr-2">
                      {String.fromCharCode(65 + oi)}.
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {submitted && q.explanation && (
              <p className="mt-3 text-sm text-gray-500 bg-white rounded p-2 border border-gray-100">
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}

      {!submitted && content.questions.length > 0 && (
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          disabled={Object.keys(answers).length < content.questions.length}
          className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Submit Test
        </button>
      )}

      {submitted && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-800">
            Test submitted. Review explanations above, then proceed to the next step.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Homework ────────────────────────────────────────────────────────────────

function HomeworkView({
  content,
  homework,
  router,
}: {
  content: HomeworkContent;
  homework: HomeworkData | null;
  router: ReturnType<typeof useRouter>;
}) {
  const hw = homework ?? content;
  const isGraded = hw.status === "GRADED";
  const questions = Array.isArray(content.questions) ? content.questions as { id: string; prompt?: string; question?: string }[] : [];

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-amber-800">
            Homework &middot; Due {new Date(content.dueDate).toLocaleDateString()}
          </p>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isGraded
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {hw.status}
          </span>
        </div>
        {isGraded && hw.score != null && (
          <p className="text-sm text-green-700 mt-1">
            Score: {Math.round(hw.score * 100)}%
          </p>
        )}
      </div>

      {questions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            {questions.length} Question{questions.length > 1 ? "s" : ""} Assigned
          </h4>
          <ul className="space-y-2">
            {questions.map((q, i) => (
              <li key={q.id || i} className="bg-gray-50 rounded p-3 text-sm text-gray-700">
                {i + 1}. {q.prompt || q.question || "Question"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isGraded && content.assignmentId && (
        <button
          type="button"
          onClick={() => router.push(`/homework/${content.assignmentId}`)}
          className="px-5 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700"
        >
          Start Homework
        </button>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeChoices(raw: string[] | Record<string, string> | null | unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "object") return Object.values(raw as Record<string, string>);
  return [];
}
