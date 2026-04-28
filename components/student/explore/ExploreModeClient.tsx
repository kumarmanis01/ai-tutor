'use client';

/**
 * FILE OBJECTIVE:
 * - Explore Mode home page (S0.3). Shown to under-18 students after registration while
 *   awaiting parent consent. Uses WebSocket (primary) + polling (fallback) for status.
 *   Integrates: locked curriculum map, sample lesson viewer, explore-mode diagnostic quiz,
 *   local diagnostic result caching, confetti approval transition, and locked features grid.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/explore/page.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 * - 2026-04-24T12:00:00Z | copilot | use useRouter for redirect; replace <a> with Link
 * - 2026-04-27T00:00:00Z | copilot | add Explore settings actions and consent-token rotation
 * - 2026-04-28T00:00:00Z | staff-engineer | S0.3 full: ExploreMap, ApprovalTransition, diagnostic,
 *   local diagnostic sync, ExploreLimitations, sentAt prop, 24h reminder
 */

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useConsentStatus } from '@/hooks/useConsentStatus';
import ExploreBanner from '@/components/student/explore/ExploreBanner';
import ApprovalStatusBar from '@/components/student/explore/ApprovalStatusBar';
import ExploreSettings from '@/components/student/explore/ExploreSettings';
import ExploreMap from '@/components/student/explore/ExploreMap';
import ApprovalTransition from '@/components/student/explore/ApprovalTransition';
import ExploreLimitations from '@/components/student/explore/ExploreLimitations';

// Local-storage key for diagnostic result cached in explore mode.
const LOCAL_DIAG_KEY = 'explore_diagnostic_result';

interface TopicPreview {
  id: string;
  name: string;
  sampleNote: string | null;
}

interface LocalDiagResult {
  studentId: string;
  answers: { questionId: string; selectedAnswer: string }[];
  score: number;
  placement: string;
}

function getLocalDiagResult(): LocalDiagResult | null {
  try {
    const raw = localStorage.getItem(LOCAL_DIAG_KEY);
    return raw ? (JSON.parse(raw) as LocalDiagResult) : null;
  } catch {
    return null;
  }
}

function clearLocalDiagResult(): void {
  try {
    localStorage.removeItem(LOCAL_DIAG_KEY);
  } catch {
    // ignore
  }
}

export default function ExploreModeClient() {
  const params = useSearchParams();
  const router = useRouter();

  const rawToken = params.get('token') ?? '';
  const initialToken = rawToken.startsWith('explore:') ? rawToken.slice(8) : rawToken;
  const [consentToken, setConsentToken] = useState(initialToken);

  // eslint-disable-next-line ai-guards/no-string-filters
  const grade = params.get('grade') ?? '';
  const board = params.get('board') ?? '';
  const studentId = params.get('studentId');
  const sentAtParam = params.get('sentAt'); // ISO string from registration response

  const gradeNum = parseInt(grade, 10) || 0;

  const consent = useConsentStatus(consentToken || null);
  const [topics, setTopics] = useState<TopicPreview[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);

  // Fetch 3 sample topics once grade/board are known.
  useEffect(() => {
    if (!grade || !board) return;
    setTopicsLoading(true);
    fetch(
      // eslint-disable-next-line ai-guards/no-string-filters
      `/api/v1/students/explore-content?grade=${encodeURIComponent(grade)}&board=${encodeURIComponent(board)}`
    )
      .then((r) => r.json())
      .then((d) => setTopics(Array.isArray(d.topics) ? d.topics : []))
      .catch(() => setTopics([]))
      .finally(() => setTopicsLoading(false));
  }, [grade, board]);

  // On approval: sync local diagnostic result, then redirect.
  const syncAndRedirect = useCallback(async () => {
    const localResult = getLocalDiagResult();
    if (localResult && localResult.studentId === studentId && studentId) {
      try {
        const exploreToken = `explore:${consentToken}`;
        await fetch(`/api/v1/students/${encodeURIComponent(studentId)}/diagnostic-result`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${exploreToken}`,
          },
          body: JSON.stringify({ answers: localResult.answers }),
        });
        clearLocalDiagResult();
      } catch {
        // Best-effort -- don't block redirect on sync failure.
      }
    }
    router.push('/dashboard');
  }, [consentToken, studentId, router]);

  async function handleSendReminder() {
    if (reminderBusy || !consentToken) return;
    setReminderBusy(true);
    try {
      await fetch('/api/v1/consent/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-fingerprint': navigator.userAgent,
        },
        body: JSON.stringify({ consent_token: consentToken }),
      });
    } catch {
      // best-effort
    } finally {
      setReminderBusy(false);
    }
  }

  // Approval: show celebration then redirect.
  if (consent.status === 'APPROVED') {
    return <ApprovalTransition onComplete={() => void syncAndRedirect()} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-16">
      {/* Sticky banner */}
      <ExploreBanner sentTo={consent.sentTo} sentAt={sentAtParam} />

      {/* Denied */}
      {consent.status === 'DENIED' && (
        <div className="mx-4 mt-4 p-6 rounded-2xl bg-[#FCEBEB] dark:bg-red-900 text-center">
          <p className="text-xl font-bold text-[#E24B4A]">Access Not Approved</p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            Your parent has declined access to Spinzy Academy. We recommend talking to them to
            understand why.
          </p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">
            You can try again with a different parent contact.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-flex min-h-[44px] px-6 items-center rounded-xl bg-[#E24B4A] text-white font-semibold text-sm"
          >
            Send New Request
          </Link>
        </div>
      )}

      {/* Expired */}
      {consent.status === 'EXPIRED' && (
        <div className="mx-4 mt-4 p-6 rounded-2xl bg-[#FAEEDA] dark:bg-amber-900 text-center">
          <p className="text-xl font-bold text-[#BA7517]">Approval Request Expired</p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
            Your approval request has expired. Send a new one?
          </p>
          <Link
            href="/register"
            className="mt-4 inline-flex min-h-[44px] px-6 items-center rounded-xl bg-[#BA7517] text-white font-semibold text-sm"
          >
            Send New Request
          </Link>
        </div>
      )}

      {/* Pending: status bar + settings */}
      {consent.status === 'PENDING' && consentToken && (
        <ApprovalStatusBar
          status={consent.status}
          expiresAt={consent.expiresAt}
          sentTo={consent.sentTo}
          consentToken={consentToken}
          onTokenRotate={setConsentToken}
        />
      )}

      {consent.status !== 'APPROVED' && consentToken && (
        <ExploreSettings
          studentId={studentId}
          consentToken={consentToken}
          sentTo={consent.sentTo}
          expiresAt={consent.expiresAt}
          channel={consent.channel}
          onTokenRotate={setConsentToken}
          onRequestCancelled={() => router.push('/register')}
        />
      )}

      {/* Diagnostic quiz in explore mode */}
      {showDiagnostic ? (
        <ExploreDiagnosticSection
          grade={gradeNum}
          board={board}
          studentId={studentId}
          consentToken={consentToken}
          onClose={() => setShowDiagnostic(false)}
        />
      ) : (
        <>
          {/* CTA to take diagnostic */}
          <div className="mx-4 mt-6 rounded-2xl bg-[#EEEDFE] dark:bg-[#534AB7]/10 border-2 border-[#534AB7]/20 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#534AB7] dark:text-indigo-300">
                Take your Diagnostic Quiz
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                5 quick questions. We save your result!
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDiagnostic(true)}
              className="shrink-0 min-h-[44px] px-4 rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] transition-colors"
            >
              Start
            </button>
          </div>

          {/* Locked curriculum map with 3 sample topics */}
          {topicsLoading ? (
            <div className="px-4 mt-6 flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-gray-200 dark:bg-slate-700 animate-pulse" />
              ))}
            </div>
          ) : topics.length > 0 ? (
            <ExploreMap
              sampleTopics={topics}
              grade={gradeNum}
              onSendReminder={() => void handleSendReminder()}
              reminderBusy={reminderBusy}
            />
          ) : (
            <p className="px-4 mt-6 text-sm text-gray-500 dark:text-gray-400">
              {grade && board
                ? 'No sample content available for your grade yet.'
                : // eslint-disable-next-line ai-guards/no-string-filters
                  'Add ?grade=&board= to the URL to load sample lessons.'}
            </p>
          )}

          {/* Limitations grid */}
          <ExploreLimitations />
        </>
      )}
    </div>
  );
}

// ── Inline explore-mode diagnostic section ────────────────────────────────────

interface ExploreDiagSectionProps {
  grade: number;
  board: string;
  studentId: string | null;
  consentToken: string;
  onClose: () => void;
}

function ExploreDiagnosticSection({
  grade,
  board,
  studentId,
  consentToken,
  onClose,
}: ExploreDiagSectionProps) {
  // Dynamically import QuickDiagnosticQuiz to keep the explore-mode bundle lean.
  // This section is only mounted when the student taps "Start", so the import
  // cost is paid on demand.
  const [QuizComponent, setQuizComponent] = useState<React.ComponentType<{
    grade: number;
    board: string;
    studentId?: string;
    accessToken?: string;
    isExploreMode?: boolean;
    onComplete?: (placement: string) => void;
  }> | null>(null);
  const [done, setDone] = useState(false);
  const [placement, setPlacement] = useState('');

  useEffect(() => {
    let mounted = true;
    import('@/components/student/onboarding/QuickDiagnosticQuiz').then((mod) => {
      if (mounted) setQuizComponent(() => mod.default);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (done) {
    return (
      <div className="mx-4 mt-6 rounded-2xl bg-[#EAF3DE] dark:bg-[#1D9E75]/10 p-6 text-center">
        <p className="text-lg font-bold text-[#1D9E75] mb-1">
          Great job! Your placement is saved.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Placement: <strong>{placement}</strong>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          You will see your full Learning Map once your parent approves.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] px-6 rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] transition-colors"
        >
          Back to Explore Mode
        </button>
      </div>
    );
  }

  if (!QuizComponent) {
    return (
      <div className="px-4 mt-6 flex justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-[#534AB7] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-4 mt-4">
      <button
        type="button"
        onClick={onClose}
        className="mb-3 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 min-h-[44px]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden>
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </button>
      <QuizComponent
        grade={grade}
        board={board}
        studentId={studentId ?? undefined}
        accessToken={`explore:${consentToken}`}
        isExploreMode
        onComplete={(p) => {
          setPlacement(p);
          setDone(true);
        }}
      />
    </div>
  );
}
