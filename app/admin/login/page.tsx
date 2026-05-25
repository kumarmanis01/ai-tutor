'use client'

import { Suspense, useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Logo from '@/components/Logo';
import { GoogleLogo, Spinner } from '@/components/UI/design-system';

const ADMIN_DASHBOARD_PATH = '/admin';
const GOOGLE_ERROR_CODES = new Set(['Callback', 'OAuthCallback', 'OAuthSignin', 'OAuthAccountNotLinked']);

function AdminLoginContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get('error') ?? '';
  const googleFailed = GOOGLE_ERROR_CODES.has(authError);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'admin') {
      router.replace(ADMIN_DASHBOARD_PATH);
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Spinner />
      </div>
    );
  }

  async function handleGoogleSignIn() {
    setSigningIn(true);
    await signIn('google', { callbackUrl: ADMIN_DASHBOARD_PATH });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Logo variant="auth" className="mb-2" />
          </div>
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-primary-bg text-primary text-xs font-semibold tracking-wide uppercase">
              Admin Portal
            </span>
            <p className="text-sm text-muted-foreground mt-2">
              Sign in with your authorized Google account.
            </p>
          </div>
        </div>

        {/* Google sign-in error banner */}
        {googleFailed && (
          <div className="rounded-xl bg-error-bg border border-brand-danger/20 px-4 py-3 text-sm text-error">
            Google sign-in did not complete. Please try again -- if the problem continues, clear your browser cookies.
          </div>
        )}

        {/* Non-admin notice when authenticated but wrong role */}
        {status === 'authenticated' && session?.user?.role !== 'admin' && (
          <div className="rounded-xl bg-warning-bg border border-brand-warning/20 px-4 py-3 text-sm text-warning">
            Your account does not have admin access. Contact your administrator.
          </div>
        )}

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={signingIn}
          className="w-full flex items-center justify-center gap-3 px-4 py-3
                     border border-gray-300 dark:border-gray-600 rounded-xl
                     bg-white dark:bg-gray-900 hover:bg-gray-50
                     dark:hover:bg-gray-800 transition-colors
                     text-gray-700 dark:text-gray-200 font-medium text-sm
                     disabled:opacity-50 disabled:cursor-not-allowed
                     min-h-[44px]"
        >
          {signingIn ? <Spinner size="sm" /> : <GoogleLogo />}
          {signingIn ? 'Redirecting to Google...' : googleFailed ? 'Retry with Google' : 'Continue with Google'}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Admin access only. Unauthorized sign-in attempts are logged.
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Spinner />
      </div>
    }>
      <AdminLoginContent />
    </Suspense>
  );
}
