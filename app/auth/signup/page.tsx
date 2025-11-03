'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SignupRedirectPage() {
  const params = useSearchParams();
  const ref = params?.get('ref') ?? params?.get('referral') ?? null;

  useEffect(() => {
    if (ref) {
      // persist referral until user signs in (30 days)
      document.cookie = `referral=${encodeURIComponent(ref)}; path=/; max-age=${60 * 60 * 24 * 30}`;
    }
    // Redirect to next-auth sign in (preserves ref param)
    const signInUrl = `/api/auth/signin${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
    window.location.href = signInUrl;
  }, [ref]);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold">Continue to Sign in / Sign up</h1>
      {ref ? (
        <p className="mt-2 text-sm text-gray-600">Referral code detected: {ref}</p>
      ) : (
        <p className="mt-2 text-sm text-gray-600">No referral code found.</p>
      )}
      <a
        className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded"
        href={`/api/auth/signin${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`}
      >
        Sign in / Sign up
      </a>
    </div>
  );
}
