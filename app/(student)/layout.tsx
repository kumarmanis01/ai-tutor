import React, { Suspense } from 'react';
import GoogleTagManagerClient from '@/components/ClientOnly/GoogleTagManagerClient';
import AppModalClient from '@/components/ClientOnly/AppModalClient';
import Providers from '@/app/providers';
import { GlobalLoaderProvider } from '@/context/GlobalLoaderProvider';
import AuthSessionLoader from '@/components/AuthSessionLoader';
import ToastHost from '@/components/ToastHost';
import StudentNav from './StudentNav';
import { requireActiveSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { checkProfileCompleteness } from '@/lib/student/profileGuard';
import { checkParentGate } from '@/lib/student/parentGate';
import { requiresParentOTPGate } from '@/lib/student/accountStatus';
import StudentLayoutShell from '@/components/student/StudentLayoutShell';
import '@/styles/index.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * Student shell root layout
 * - Owns the HTML document for all authenticated student routes
 *   (/dashboard/*, /rooms/*, /profile, /parent, /learn/*)
 * - Fetches session server-side; redirects to / if unauthenticated
 * - Profile completeness guard: redirects to /student/onboarding when required fields missing
 * - Parent verification gate (under-18): redirects to /student/verify-parent when required and not verified
 * - Renders StudentNav — the persistent student navigation bar
 * - Must NOT render the public Navbar
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id?: string })?.id;
  const pathname = (await headers()).get('x-pathname') ?? '';

  const skipApi = pathname.startsWith('/student/api');
  const skipVerifyParent = pathname.startsWith('/student/verify-parent');
  const skipOnboarding = pathname.startsWith('/student/onboarding');

  let showParentGate = false;
  let maskedParentEmail: string | null = null;

  if (!skipApi && !skipVerifyParent && !skipOnboarding && userId) {
    const needsOtpGate = await requiresParentOTPGate(userId);
    if (needsOtpGate) {
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

  if (!skipApi && !showParentGate && userId) {
    const gate = await checkParentGate(userId);
    if (!skipVerifyParent && !skipOnboarding && gate.required && !gate.verified) {
      redirect('/student/verify-parent');
    }
  }

  const studentName = (session.user as { name?: string })?.name ?? '';

  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen h-full">
        <Providers>
          <GlobalLoaderProvider>
            <AuthSessionLoader />
            <Suspense fallback={null}>
              <GoogleTagManagerClient />
            </Suspense>
            <AppModalClient />
            <StudentNav studentName={studentName} />
            <div className="pt-14">
              <StudentLayoutShell showParentGate={showParentGate} maskedParentEmail={maskedParentEmail}>
                {children}
              </StudentLayoutShell>
            </div>
            <ToastHost />
          </GlobalLoaderProvider>
        </Providers>
      </body>
    </html>
  );
}
