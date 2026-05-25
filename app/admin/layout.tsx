import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import Providers from '@/app/providers';
import { GlobalLoaderProvider } from '@/context/GlobalLoaderProvider';
import { NavigationProgress } from '../../components/NavigationProgress';
import AuthSessionLoader from '../../components/AuthSessionLoader';
import ToastHost from '../../components/ToastHost';
import GoogleTagManagerClient from '../../components/ClientOnly/GoogleTagManagerClient';
import AppModalClient from '../../components/ClientOnly/AppModalClient';
import '@/styles/index.css';

import { inter, nunito } from '@/app/fonts';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * Admin shell root layout
 * - Standalone root layout for /admin/* routes (no parent app/layout.tsx)
 * - Checks admin role server-side; redirects non-admins to /dashboard
 * - Fetches sidebar badge counts server-side in parallel
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '';

  // Admin login page is public -- render minimal shell, skip auth + sidebar.
  if (pathname === '/admin/login') {
    return (
      <html lang="en" className={`h-full ${inter.variable} ${nunito.variable}`}>
        <body className="font-sans antialiased h-full">
          <Providers>{children}</Providers>
        </body>
      </html>
    );
  }

  const session = await getServerSessionForHandlers();

  if (!session) {
    redirect('/admin/login');
  }

  if (session.user?.role !== 'admin') {
    redirect('/dashboard');
  }

  // Badge counts -- all run in parallel; individual failures fall back to 0
  const [pendingReview, activeJobs, failedJobs, safetyAlerts, flaggedQuestions] = await Promise.all([
    // Content pending review: sum all draft content types
    Promise.all([
      prisma.chapterDef.count({ where: { status: 'draft', lifecycle: 'active' } }),
      prisma.topicDef.count({ where: { status: 'draft', lifecycle: 'active' } }),
      prisma.topicNote.count({ where: { status: 'draft', lifecycle: 'active' } }),
      prisma.generatedTest.count({ where: { status: 'draft', lifecycle: 'active' } }),
    ]).then(([c, t, n, gt]) => c + t + n + gt).catch(() => 0),

    // Root hydration jobs currently running (hierarchyLevel 0 = pipeline root)
    prisma.hydrationJob
      .count({ where: { hierarchyLevel: 0, status: 'running' } })
      .catch(() => 0),

    // Failed root jobs (separate for badge colour differentiation in sidebar)
    prisma.hydrationJob
      .count({ where: { hierarchyLevel: 0, status: 'failed' } })
      .catch(() => 0),

    // Unresolved safety events
    prisma.safetyEvent
      .count({ where: { resolvedAt: null } })
      .catch(() => 0),

    // Flagged/quarantined questions pending review
    prisma.question
      .count({ where: { status: { in: ['PENDING_REVIEW', 'QUARANTINED'] } } })
      .catch(() => 0),
  ]);

  return (
    <html lang="en" className={`h-full ${inter.variable} ${nunito.variable}`}>
      <body className="font-sans antialiased h-full">
        <Providers>
          <GlobalLoaderProvider>
            <NavigationProgress />
            <AuthSessionLoader />
            <Suspense fallback={null}>
              <GoogleTagManagerClient />
            </Suspense>
            <AppModalClient />
            <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
              <AdminSidebar
                pendingReview={pendingReview}
                runningJobs={activeJobs}
                failedJobs={failedJobs}
                safetyAlerts={safetyAlerts}
                flaggedQuestions={flaggedQuestions}
              />
              <main className="flex-1 overflow-y-auto text-gray-900 dark:text-gray-100">
                {children}
              </main>
            </div>
            <ToastHost />
          </GlobalLoaderProvider>
        </Providers>
      </body>
    </html>
  );
}
