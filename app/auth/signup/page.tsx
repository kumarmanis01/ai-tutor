'use client';
import { useEffect } from 'react';
import Link from 'next/link';

export default function SignupRedirectPage() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') ?? params.get('referral') ?? null;

    if (ref) {
      // persist referral until user signs in (30 days)
      document.cookie = `referral=${encodeURIComponent(ref)}; path=/; max-age=${60 * 60 * 24 * 30}`;
    }

    const signInUrl = `/api/auth/signin${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;

    // small delay so cookie write has a chance to commit in some browsers
    setTimeout(() => {
      window.location.href = signInUrl;
    }, 50);
  }, []);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <p className="mt-2 text-sm text-gray-600">Preparing sign in / sign up…</p>
      <Link
        href="/api/auth/signin"
        className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded"
      >
        Sign in / Sign up
      </Link>
    </div>
  );
}
