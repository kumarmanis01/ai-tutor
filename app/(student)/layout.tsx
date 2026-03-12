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
 * - Renders StudentNav — the persistent student navigation bar
 * - Must NOT render the public Navbar
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id?: string })?.id;
  const pathname = (await headers()).get('x-pathname') ?? '';

  if (!pathname.startsWith('/student/onboarding') && !pathname.startsWith('/student/api')) {
    if (userId) {
      const profile = await checkProfileCompleteness(userId);
      if (!profile.complete) {
        redirect(`/student/onboarding?missing=${profile.missingFields.join(',')}`);
      }
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
              {children}
            </div>
            <ToastHost />
          </GlobalLoaderProvider>
        </Providers>
      </body>
    </html>
  );
}
