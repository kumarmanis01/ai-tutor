'use client';
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

export default function AuthRedeemOnSignIn() {
  const { status } = useSession();
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    if (typeof window === 'undefined') return; // ensure client
    if (status !== 'authenticated') return; // wait until user is signed in

    // read query params directly from window (avoid useSearchParams)
    const params = new URLSearchParams(window.location.search);
    const paramRef = params.get('ref') ?? params.get('referral');
    const cookieMatch = document.cookie.match(/(?:^|; )referral=([^;]+)/);
    const cookieRef = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
    const ref = paramRef ?? cookieRef;
    if (!ref) return;

    calledRef.current = true;

    (async () => {
      try {
        await fetch('/api/referral/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: ref }),
        });
      } catch {
        // ignore network errors
      } finally {
        // clear persisted cookie so we don't attempt to redeem again
        document.cookie = 'referral=; path=/; max-age=0';
        // remove ref param from URL to avoid reprocessing client-side
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('ref');
          url.searchParams.delete('referral');
          window.history.replaceState({}, document.title, url.toString());
        } catch {
          // ignore
        }
      }
    })();
  }, [status]);

  return null;
}
