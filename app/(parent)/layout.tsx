/**
 * Root layout for all parent-facing routes under app/(parent)/.
 *
 * Auth gate:
 *   - No session     → redirect to /login
 *   - role !== parent → redirect to /dashboard (student home)
 *
 * Nav: logo + "My children" + sign-out
 * Student routes are in a separate route group -- not accessible from here.
 *
 * EDIT LOG:
 *   2026-03-08 | claude | created for Parent Progress Dashboard
 *   2026-03-15 | claude | T38 -- add auth gate + top nav
 *   2026-04-26T00:00:00Z | copilot | PR#375 -- URL-encode callbackUrl in redirects via URLSearchParams
 */

import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { AppSession } from '@/lib/types/auth';
import '@/styles/index.css';
import Link from 'next/link';
import ParentLogoutButton from '@/components/parent/ParentLogoutButton';
import Logo from '@/components/Logo';
import { NavigationProgress } from '@/components/NavigationProgress';

// Self-hosted fonts -- no build-time network dependency on fonts.googleapis.com
const inter = localFont({
  src: '../../public/fonts/inter-latin-variable.woff2',
  variable: '--font-inter',
  display: 'swap',
});
const nunito = localFont({
  src: '../../public/fonts/nunito-variable-latin.woff2',
  variable: '--font-nunito',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#534AB7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Parent Dashboard | Spinzy',
  description: "Monitor your child's learning progress on Spinzy.",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
    shortcut: '/favicon.ico',
  },
};

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const session = (await getServerSession(authOptions)) as AppSession | null;

  if (!session?.user?.id) {
    redirect(`/auth/signin?${new URLSearchParams({ callbackUrl: '/parent/dashboard' }).toString()}`);
  }

  if (session.user.role !== 'parent') {
    // role:'user' means onboarding not yet complete -- send to parent setup flow.
    // role:'student' means they belong on the student dashboard.
    // Never redirect an authenticated user back to sign-in (causes a redirect loop).
    const dest = session.user.role === 'student' ? '/dashboard' : '/parent-onboarding';
    redirect(dest);
  }

  return (
    <html lang="en" className={`h-full ${inter.variable} ${nunito.variable}`}>
      <body className="font-sans antialiased min-h-screen bg-gray-50 dark:bg-gray-950">
        <NavigationProgress />

        {/* ── Top nav ────────────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-30 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            {/* Logo */}
            <Link
              href="/parent/dashboard"
              className="flex items-center gap-2"
              aria-label="Parent dashboard"
            >
              <span className="hidden sm:flex">
                <Logo variant="navbar" />
              </span>
              <span className="flex sm:hidden">
                <Logo variant="navbar-mobile" />
              </span>
              <span className="hidden text-xs font-medium text-gray-500 sm:inline dark:text-gray-400">
                | Parent View
              </span>
            </Link>

            {/* Nav links */}
            <div className="flex items-center gap-5">
              <Link
                href="/parent/dashboard"
                className="text-sm font-medium text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400"
              >
                My children
              </Link>
              <ParentLogoutButton />
            </div>
          </div>
        </nav>

        {children}
      </body>
    </html>
  );
}
