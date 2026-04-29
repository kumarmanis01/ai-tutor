/**
 * FILE OBJECTIVE:
 * - S0.5: Deep-link landing page for child profile claim.
 *   Reads the ?token= query param, calls POST /api/v1/students/claim,
 *   stores the returned JWT, then routes to the student onboarding flow.
 *
 *   Three outcomes:
 *   - success  → welcome screen → [Start Learning] → /student/onboarding
 *   - expired  → "link has expired" message
 *   - used     → "link already used" message
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | claude | created for S0.5
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

type ErrorCode = 'token_expired' | 'token_used' | 'token_invalid' | 'server_error';

type ClaimState =
  | { status: 'loading' }
  | { status: 'success'; childName: string; grade: string | null; board: string | null }
  | { status: 'error'; code: ErrorCode; message: string };

interface ClaimResponse {
  ok?: boolean;
  accessToken?: string;
  refreshToken?: string;
  child?: { id: string; name: string; grade: string | null; board: string | null };
  error?: string;
  message?: string;
}

// ── Error copy per token error type ──────────────────────────────────────────

const ERROR_TITLE: Record<ErrorCode, string> = {
  token_expired: 'This link has expired',
  token_used: 'This link has already been used',
  token_invalid: 'Invalid link',
  server_error: "Something went wrong",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StudentClaimPage() {
  return (
    <PageShell>
      <Suspense fallback={<LoadingView />}>
        <StudentClaimContent />
      </Suspense>
    </PageShell>
  );
}

function StudentClaimContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<ClaimState>({ status: 'loading' });

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setState({
        status: 'error',
        code: 'token_invalid',
        message: 'No claim token was found in this link. Please ask your parent to send a new one.',
      });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/v1/students/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimToken: token }),
        });

        const data = (await res.json()) as ClaimResponse;
        if (cancelled) return;

        if (!res.ok || !data.ok) {
          const code = (data.error as ErrorCode) ?? 'server_error';
          setState({
            status: 'error',
            code,
            message:
              data.message ??
              "Couldn't process this link. Please ask your parent to send a new one.",
          });
          return;
        }

        // Persist JWT for subsequent API calls from the student app
        if (data.accessToken) {
          try {
            localStorage.setItem('student_access_token', data.accessToken);
          } catch {}
        }
        if (data.refreshToken) {
          try {
            localStorage.setItem('student_refresh_token', data.refreshToken);
          } catch {}
        }
        if (data.child?.id) {
          try {
            localStorage.setItem('student_id', data.child.id);
          } catch {}
        }

        setState({
          status: 'success',
          childName: data.child?.name ?? 'there',
          grade: data.child?.grade ?? null,
          board: data.child?.board ?? null,
        });
      } catch {
        if (!cancelled) {
          setState({
            status: 'error',
            code: 'server_error',
            message:
              "Couldn't load your profile. Please check your connection and try again.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <>
      {state.status === 'loading' && <LoadingView />}
      {state.status === 'success' && (
        <SuccessView
          childName={state.childName}
          grade={state.grade}
          board={state.board}
        />
      )}
      {state.status === 'error' && (
        <ErrorView code={state.code} message={state.message} />
      )}
    </>
  );
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

function LoadingView() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="w-10 h-10 border-4 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 dark:text-gray-400 text-sm">Setting up your account...</p>
    </div>
  );
}

function SuccessView({
  childName,
  grade,
  board,
}: {
  childName: string;
  grade: string | null;
  board: string | null;
}) {
  return (
    <>
      <div className="text-5xl text-center mb-4" aria-hidden="true">
        &#x1F389;
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center">
        Welcome, {childName}!
      </h1>
      {grade && board && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
          Class {grade} &middot; {board}
        </p>
      )}
      <p className="text-sm text-gray-600 dark:text-gray-300 text-center mt-3">
        Your account is ready. Let&apos;s start learning!
      </p>
      <Link
        href="/student/onboarding"
        className="mt-6 block w-full bg-[#534AB7] text-white text-center font-bold
          rounded-2xl py-4 min-h-[52px] hover:bg-[#4239a0] transition-colors"
      >
        Start Learning
      </Link>
    </>
  );
}

function ErrorView({ code, message }: { code: ErrorCode; message: string }) {
  return (
    <>
      <div className="text-4xl text-center mb-4" aria-hidden="true">
        &#x1F615;
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
        {ERROR_TITLE[code]}
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{message}</p>
      <p className="mt-4 text-xs text-gray-400 text-center">
        Ask your parent to send a new link from their Parent Dashboard.
      </p>
    </>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-6 sm:p-8">
        <div className="mb-6 text-center">
          <span className="text-[#534AB7] font-extrabold text-lg tracking-tight">
            Spinzy Academy
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
