'use client';
/**
 * FILE OBJECTIVE:
 * - Client-only component that handles referral redemption on sign-in and emits referral analytics events.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/AuthRedeemOnSignIn.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | migrate analytics to canonical client constants; move userId to trackEvent top-level field; add FILE OBJECTIVE header
 */
import { useEffect, useRef, type ReactElement } from 'react';
import { logger } from '@/lib/logger';
import { useSession } from 'next-auth/react';
import type { AppSession } from '@/lib/types/auth';
import analyticsClient from '@/lib/analytics/client';
import { ANALYTICS_EVENTS, type StudentAnalyticsEvent } from '@/lib/analytics/events';

type TrackFn = (eventType: StudentAnalyticsEvent, metadata?: Record<string, unknown>) => void | Promise<void>;

/**
 * AuthRedeemOnSignIn
 *
 * Client-only component that:
 * - Waits for the user session to become "authenticated".
 * - Attempts a one-time referral redemption (reads ?ref or cookie "referral").
 * - Uses AbortController with timeout to avoid hanging requests.
 * - Records referral analytics via canonical analytics client constants.
 * - Ensures single execution with a ref to avoid duplicate network calls.
 *
 * Notes:
 * - This file intentionally avoids importing any server-only modules at top-level.
 * - No use of `any`; event types are constrained via StudentAnalyticsEvent.
 */
export default function AuthRedeemOnSignIn(): ReactElement | null {
  const { status, data: session } = useSession();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    if (typeof window === 'undefined') return; // defensive; component is client-only
    if (status !== 'authenticated') return;

    // Determine referral code: query param "ref" or "referral", or cookie named "referral"
    const params = new URLSearchParams(window.location.search);
    const paramRef = params.get('ref') ?? params.get('referral');
    const cookieMatch = document.cookie.match(/(?:^|; )referral=([^;]+)/);
    const cookieRef = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
    const referralCode = paramRef ?? cookieRef;
    if (!referralCode) return;

    attemptedRef.current = true;

    const controller = new AbortController();
    const TIMEOUT_MS = 10000;
    const timeoutId = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

    (async () => {
      const track: TrackFn = (eventType, metadata) => {
        analyticsClient.trackEvent({ eventType, metadata });
      };

      try {
        // Analytics: attempt to record redemption start (non-blocking)
        if (track) {
          try {
            const s = session as unknown as AppSession | null
            void analyticsClient.trackEvent({
              eventType: ANALYTICS_EVENTS.STUDENT.REFERRAL_REDEEM_ATTEMPT,
              userId: s?.user?.id ?? null,
              metadata: { code: referralCode },
            });
          } catch (err) {
            logger.warn('analytics track failed', { component: 'AuthRedeemOnSignIn', methodName: 'track_attempt', error: String(err) });
          }
        }

        // Perform referral redeem request
        const res = await fetch('/api/referral/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: referralCode }),
          signal: controller.signal,
        });

        // Analytics: record result (best-effort)
        if (track) {
          try {
            void track(ANALYTICS_EVENTS.STUDENT.REFERRAL_REDEEM_RESULT, { code: referralCode, status: res.status });
          } catch (err) {
            logger.warn('analytics track failed', { component: 'AuthRedeemOnSignIn', methodName: 'track_result', error: String(err) });
          }
        }
      } catch (err) {
        // Handle abort vs other errors and optionally log analytics
        const isAbort = (err as Error & { name?: string }).name === 'AbortError';
        if (track) {
          try {
            void track(ANALYTICS_EVENTS.STUDENT.REFERRAL_REDEEM_RESULT, {
              code: referralCode,
              status: isAbort ? 'timeout' : 'error',
              detail: String(err),
            });
          } catch (err2) {
            logger.warn('analytics track failed', { component: 'AuthRedeemOnSignIn', methodName: 'track_error', error: String(err2) });
          }
        }
      } finally {
        // cleanup timeout and abort controller
        clearTimeout(timeoutId);

        // Best-effort: clear referral cookie and remove query params so we don't retry
        try {
          document.cookie = 'referral=; path=/; max-age=0';
        } catch (err) {
          logger.warn('failed to clear referral cookie', { component: 'AuthRedeemOnSignIn', methodName: 'cleanup', error: String(err) });
        }
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('ref');
          url.searchParams.delete('referral');
          window.history.replaceState({}, document.title, url.toString());
        } catch (err) {
          logger.warn('failed to clear referral query params', { component: 'AuthRedeemOnSignIn', methodName: 'cleanup', error: String(err) });
        }
      }
    })();

    // Cleanup handler: abort pending request if the component unmounts
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
    // Only re-run when authentication status or session object changes.
    // attemptedRef prevents duplicate redemption attempts.
  }, [status, session]);

  return null;
}
