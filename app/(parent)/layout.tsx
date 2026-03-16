/**
 * Root layout for all parent-facing routes under app/(parent)/.
 *
 * Auth gate:
 *   - No session     → redirect to /login
 *   - role !== parent → redirect to /dashboard (student home)
 *
 * Nav: logo + "My children" + sign-out
 * Student routes are in a separate route group — not accessible from here.
 *
 * EDIT LOG:
 *   2026-03-08 | claude | created for Parent Progress Dashboard
 *   2026-03-15 | claude | T38 — add auth gate + top nav
 */

import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import type { AppSession } from '@/lib/types/auth'
import '@/styles/index.css'
import ParentLogoutButton from '@/components/parent/ParentLogoutButton'

export const viewport: Viewport = {
  themeColor: '#534AB7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Parent Dashboard | Spinzy',
  description: "Monitor your child's learning progress on Spinzy.",
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
  },
}

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const session = (await getServerSession(authOptions)) as AppSession | null

  if (!session?.user?.id) {
    redirect('/login')
  }

  if (session.user.role !== 'parent') {
    redirect('/dashboard')
  }

  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-gray-50 antialiased dark:bg-gray-950">

        {/* ── Top nav ────────────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-30 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">

            {/* Logo */}
            <a href="/parent/dashboard" className="flex items-center gap-1.5" aria-label="Parent dashboard">
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">Spinzy</span>
              <span className="hidden text-xs font-medium text-gray-500 sm:inline dark:text-gray-400">
                | Parent View
              </span>
            </a>

            {/* Nav links */}
            <div className="flex items-center gap-5">
              <a
                href="/parent/dashboard"
                className="text-sm font-medium text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400"
              >
                My children
              </a>
              <ParentLogoutButton />
            </div>

          </div>
        </nav>

        {children}
      </body>
    </html>
  )
}
