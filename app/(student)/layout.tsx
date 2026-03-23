import React, { Suspense } from 'react';
import { Inter, Nunito } from 'next/font/google';
import GoogleTagManagerClient from '@/components/ClientOnly/GoogleTagManagerClient';
import AppModalClient from '@/components/ClientOnly/AppModalClient';
import Providers from '@/app/providers';
import { GlobalLoaderProvider } from '@/context/GlobalLoaderProvider';
import AuthSessionLoader from '@/components/AuthSessionLoader';
import ToastHost from '@/components/ToastHost';
import Topbar from '@/components/student/layout/Topbar';
import BottomNav from '@/components/student/layout/BottomNav';
import { requireActiveSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { checkProfileCompleteness, isProfileComplete, EMPTY_PROFILE_DATA, type ProfileMissingField } from '@/lib/student/profileGuard';
import { checkParentGate } from '@/lib/student/parentGate';
import { requiresParentOTPGate } from '@/lib/student/accountStatus';
import StudentLayoutShell from '@/components/student/StudentLayoutShell';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import '@/styles/index.css';

import type { Metadata, Viewport } from 'next';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const nunito = Nunito({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-nunito', display: 'swap' });

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

  const userId = (session.user as { id?: string })?.id;
  // studentName kept for StudentLayoutShell (profile gate overlay)
  const pathname = (await headers()).get('x-pathname') ?? '';

  const skipApi = pathname.startsWith('/student/api');
  const skipVerifyParent = pathname.startsWith('/student/verify-parent');
  const skipOnboarding = pathname.startsWith('/student/onboarding');

  // Onboarding first, then parent verification: only run parent gate after profile is complete.
  const profile = userId ? await checkProfileCompleteness(userId) : { complete: false, missingFields: [] as const, data: EMPTY_PROFILE_DATA };
  const onboardingComplete = profile.complete;

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

  // Profile completion gate: shown as overlay when board/grade/language/subjects are missing.
  // Skipped on the same paths as the parent gate to avoid blocking API and onboarding routes.
  const showProfileGate =
    !skipApi &&
    !skipVerifyParent &&
    !skipOnboarding &&
    !isProfileComplete(profile.data);

  // [layout-gate] diagnostic log — remove after confirming fix is live
  console.log('[layout-gate]', {
    isProfileComplete: isProfileComplete(profile.data),
    requiresParentOTPGate: showParentGate,
    grade: profile.data.grade,
    board: profile.data.board,
    language: profile.data.language,
    subjectCount: profile.data.subjects?.length,
    accountStatus: (session.user as any).accountStatus,
    age: (session.user as any).age,
  });

  // Parent verification is shown as modal (ParentOTPGate); do not redirect to
  // /student/verify-parent -- that page redirects to /dashboard and causes a loop.
  const studentName = (session.user as { name?: string })?.name ?? '';

  return (
    <html lang="en" className={`h-full ${inter.variable} ${nunito.variable}`}>
      <body className="font-sans antialiased min-h-screen h-full">
        <Providers>
          <GlobalLoaderProvider>
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
              missingProfileFields={profile.missingFields as ProfileMissingField[]}
            >
              <div className="pb-16 md:pb-0">
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
