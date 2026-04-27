'use client';
import { useEffect, useRef, type ReactElement } from 'react';
import { logger } from '@/lib/logger';
import { useSession } from 'next-auth/react';
import type { AppSession } from '@/lib/types/auth';

type TrackFn = (event: string, props?: Record<string, unknown>) => void | Promise<void>;

/**
 * AuthRedeemOnSignIn
 *
 * Client-only component that:
 * - Waits for the user session to become "authenticated".
 * - Attempts a one-time referral redemption (reads ?ref or cookie "referral").
 * - Uses AbortController with timeout to avoid hanging requests.
 * - Attempts to record analytics via a dynamically imported, client-safe analytics module.
 * - Ensures single execution with a ref to avoid duplicate network calls.
 *
 * Notes:
 * - This file intentionally avoids importing any server-only modules at top-level.
 * - The analytics module is loaded dynamically; runtime checks ensure we only call a real function.
 * - No use of `any` -- runtime-checked against Record<string, unknown>.
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
      // Dynamically import analytics client. Use unknown & runtime guards (no `any`).
      let track: TrackFn | undefined = undefined;
      try {
        const mod = (await import('@/lib/analyticsClient').catch(() => undefined)) as unknown;
        if (mod && typeof (mod as Record<string, unknown>).trackEvent === 'function') {
          track = (mod as Record<string, unknown>).trackEvent as TrackFn;
        } else if (mod && typeof (mod as Record<string, unknown>).default === 'function') {
          track = (mod as Record<string, unknown>).default as unknown as TrackFn;
        } else if (
          mod &&
          typeof (mod as Record<string, unknown>).default === 'object' &&
          (mod as Record<string, unknown>).default !== null &&
          typeof ((mod as Record<string, unknown>).default as Record<string, unknown>)
            .trackEvent === 'function'
        ) {
          track = ((mod as Record<string, unknown>).default as Record<string, unknown>)
            .trackEvent as TrackFn;
        }
      } catch (err) {
        logger.warn('analytics client import failed', { component: 'AuthRedeemOnSignIn', methodName: 'init', error: String(err) });
        track = undefined; // best-effort analytics only
      }

      try {
        // Analytics: attempt to record redemption start (non-blocking)
        if (track) {
          try {
            const s = session as unknown as AppSession | null
            void track('referral_redeem_attempt', {
              code: referralCode,
              userId: s?.user?.id ?? null,
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
            void track('referral_redeem_result', { code: referralCode, status: res.status });
          } catch (err) {
            logger.warn('analytics track failed', { component: 'AuthRedeemOnSignIn', methodName: 'track_result', error: String(err) });
          }
        }
      } catch (err) {
        // Handle abort vs other errors and optionally log analytics
        const isAbort = (err as Error & { name?: string }).name === 'AbortError';
        if (track) {
          try {
            void track('referral_redeem_result', {
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
