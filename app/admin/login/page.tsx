/**
 * FILE OBJECTIVE:
 * - Admin email/password sign-in page. Posts to NextAuth credentials provider
 *   and redirects to /admin (or callbackUrl) on success. middleware.ts bounces
 *   already-signed-in admins away from this page.
 *
 * LINKED UNIT TEST:
 * - covered via tests/unit/app/api/admin/auth/* and tests/unit/middleware.test.ts
 *   (the page itself is a thin form wrapper around signIn('credentials'))
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | create admin login page (email + password)
 */
'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || '/admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });
      if (!res || res.error) {
        setError('Invalid email or password.');
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Admin sign in</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Use your admin email and password.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
            className="w-full min-h-[44px] px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            className="w-full min-h-[44px] px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
          {error && <p className="text-error text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="flex items-center justify-between text-sm">
          <Link href="/admin/forgot-password" className="text-primary hover:underline">
            Forgot password?
          </Link>
          <Link href="/admin/signup" className="text-primary hover:underline">
            Create admin account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
