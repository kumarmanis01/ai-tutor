/**
 * FILE OBJECTIVE:
 * - Student shell root layout: HTML document root and authenticated student layout.
 *
 * LINKED UNIT TEST:
 * - tests/unit/layouts/student.layout.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | staff-engineer | add file header and top padding to avoid Topbar overlap
 */

import React, { Suspense } from 'react';
import localFont from 'next/font/local';
import GoogleTagManagerClient from '@/components/ClientOnly/GoogleTagManagerClient';
import AppModalClient from '@/components/ClientOnly/AppModalClient';
import Providers from '@/app/providers';
import { GlobalLoaderProvider } from '@/context/GlobalLoaderProvider';
import { NavigationProgress } from '@/components/NavigationProgress';
import AuthSessionLoader from '@/components/AuthSessionLoader';
import ToastHost from '@/components/ToastHost';
import Topbar from '@/components/student/layout/Topbar';
import BottomNav from '@/components/student/layout/BottomNav';
import { requireActiveSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import {
  checkProfileCompleteness,
  isProfileComplete,
  EMPTY_PROFILE_DATA,
} from '@/lib/student/profileGuard';
import { checkParentGate } from '@/lib/student/parentGate';
import { requiresParentOTPGate } from '@/lib/student/accountStatus';
import StudentLayoutShell from '@/components/student/StudentLayoutShell';
import { prisma } from '@/lib/prisma';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import '@/styles/index.css';

import type { Metadata, Viewport } from 'next';

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
  title: 'Spinzy AI Tutor',
  description: 'AI-powered home tutor for CBSE & ICSE students',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Spinzy',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
    shortcut: '/favicon.ico',
  },
  openGraph: {
    images: [{ url: '/logos/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#534AB7',
    'msapplication-TileImage': '/logos/icon-192.png',
  },
};

/**
 * Student shell root layout
 * - Owns the HTML document for all authenticated student routes
 *   (/dashboard/*, /rooms/*, /profile, /parent, /learn/*)
 * - Fetches session server-side; redirects to / if unauthenticated
 * - Profile completeness guard: redirects to /student/onboarding when required fields missing
 * - Parent verification (under-13/under-18): shown as modal via ParentOTPGate when required
 * - Renders Topbar (sticky, v2 slim bar with logo + streak + level + avatar)
 * - Renders BottomNav (fixed bottom, mobile-only, 4 tabs)
 * - Must NOT render the public Navbar
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  // Parents have their own route group -- never let them land in the student shell.
  if ((session.user as { role?: string }).role === 'parent') {
    redirect('/parent/dashboard');
  }

  const userId = (session.user as { id?: string })?.id;
  // studentName kept for StudentLayoutShell (profile gate overlay)
  const pathname = (await headers()).get('x-pathname') ?? '';

  const skipApi = pathname.startsWith('/student/api');
  const skipVerifyParent = pathname.startsWith('/student/verify-parent');
  const skipOnboarding = pathname.startsWith('/student/onboarding');

  // Onboarding first, then parent verification: only run parent gate after profile is complete.
  const profile = userId
    ? await checkProfileCompleteness(userId)
    : { complete: false, missingFields: [] as const, data: EMPTY_PROFILE_DATA };
  const onboardingComplete = profile.complete;

  // Always read fresh from DB for the profile gate check.
  // session.user is stale after onboarding and does not reflect updated subjects.
  // isProfileComplete handles all Prisma return shapes including Postgres wire-format strings.
  const freshProfile = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          board: true,
          grade: true,
          language: true,
          subjects: true,
          age: true,
          parentEmail: true,
        },
      })
    : null;

  let showParentGate = false;
  let maskedParentEmail: string | null = null;

  if (!skipApi && !skipVerifyParent && !skipOnboarding && userId && onboardingComplete) {
    const [needsOtpGate, gate] = await Promise.all([
      requiresParentOTPGate(userId),
      checkParentGate(userId),
    ]);
    const needsParentVerification = needsOtpGate || (gate.required && !gate.verified);
    if (needsParentVerification) {
      showParentGate = true;
      const parentEmail = (session.user as { parentEmail?: string | null }).parentEmail ?? null;
      if (parentEmail) {
        const [localPart, domain] = parentEmail.split('@');
        if (localPart && domain) {
          const first = localPart.charAt(0);
          maskedParentEmail = `${first}${'*'.repeat(Math.max(localPart.length - 1, 1))}@${domain}`;
        } else {
          maskedParentEmail = parentEmail;
        }
      } else {
        maskedParentEmail = 'parent email on file';
      }
    }
  }

  // Parse subjects from any Prisma return shape into string[] for the gate's initialValues.
  function parseSubjectsForGate(raw: unknown): string[] {
    if (Array.isArray(raw)) return (raw as string[]).filter(Boolean);
    if (typeof raw === 'string' && raw.length > 0) {
      return raw
        .replace(/^\{/, '')
        .replace(/\}$/, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }

  // Profile completion gate: shown as overlay when board/grade/language/subjects are missing.
  // Uses freshProfile (direct DB read) so the gate check is never stale after onboarding.
  // Skipped on API routes, /student/onboarding, and /student/verify-parent.
  const showProfileGate =
    !skipApi &&
    !skipVerifyParent &&
    !skipOnboarding &&
    !isProfileComplete(freshProfile ?? profile.data);

  // Build initialProfileData from fresh DB row, falling back to checkProfileCompleteness result.
  const initialProfileData = freshProfile
    ? {
        board: freshProfile.board ?? null,
        grade: freshProfile.grade ?? null,
        language: freshProfile.language ?? null,
        subjects: parseSubjectsForGate(freshProfile.subjects),
        age: freshProfile.age ?? null,
        parentEmail: freshProfile.parentEmail ?? null,
      }
    : profile.data;

  // Parent verification is shown as modal (ParentOTPGate); do not redirect to
  // /student/verify-parent -- that page redirects to /dashboard and causes a loop.
  const _studentName = (session.user as { name?: string })?.name ?? '';

  return (
    <html lang="en" className={`h-full ${inter.variable} ${nunito.variable}`}>
      <body className="font-sans antialiased min-h-screen h-full">
        {/* Skip link for keyboard users */}
        <a
          href="#student-main"
          className="sr-only focus:not-sr-only focus:absolute top-2 left-2 z-50 bg-white dark:bg-gray-900 px-2 py-1 rounded text-sm"
        >
          Skip to content
        </a>

        <Providers>
          <GlobalLoaderProvider>
            <NavigationProgress />
            <AuthSessionLoader />
            <Suspense fallback={null}>
              <GoogleTagManagerClient />
            </Suspense>
            <AppModalClient />
            <Topbar />
            <StudentLayoutShell
              showParentGate={showParentGate}
              maskedParentEmail={maskedParentEmail}
              showProfileGate={showProfileGate}
              initialProfileData={initialProfileData}
            >
              <div id="student-main" className="pt-[1px] pb-16 md:pb-0">
                {children}
              </div>
            </StudentLayoutShell>
            <BottomNav />
            <ToastHost />
            <InstallPrompt />
          </GlobalLoaderProvider>
        </Providers>
      </body>
    </html>
  );
}
