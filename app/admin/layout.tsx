import React, { Suspense } from 'react';
import localFont from 'next/font/local';
import { redirect } from 'next/navigation';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import Providers from '@/app/providers';
import { GlobalLoaderProvider } from '@/context/GlobalLoaderProvider';
import { NavigationProgress } from '@/components/NavigationProgress';
import AuthSessionLoader from '@/components/AuthSessionLoader';
import ToastHost from '@/components/ToastHost';
import GoogleTagManagerClient from '@/components/ClientOnly/GoogleTagManagerClient';
import AppModalClient from '@/components/ClientOnly/AppModalClient';
import '@/styles/index.css';

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
  const session = await getServerSessionForHandlers();

  if (!session || session.user?.role !== 'admin') {
    redirect('/dashboard');
  }

  // Badge counts -- all run in parallel; individual failures fall back to 0
  const [pendingReview, activeJobs, failedJobs, safetyAlerts] = await Promise.all([
    // Content pending review: sum all draft content types
    Promise.all([
      prisma.chapterDef.count({ where: { status: 'draft', lifecycle: 'active' } }),
      prisma.topicDef.count({ where: { status: 'draft', lifecycle: 'active' } }),
      prisma.topicNote.count({ where: { status: 'draft', lifecycle: 'active' } }),
      prisma.generatedTest.count({ where: { status: 'draft', lifecycle: 'active' } }),
    ]).then(([c, t, n, gt]) => c + t + n + gt).catch(() => 0),

    // Root hydration jobs currently running or failed (hierarchyLevel 0 = pipeline root)
    prisma.hydrationJob
      .count({ where: { hierarchyLevel: 0, status: { in: ['running', 'failed'] } } })
      .catch(() => 0),

    // Failed root jobs (separate for badge colour differentiation in sidebar)
    prisma.hydrationJob
      .count({ where: { hierarchyLevel: 0, status: 'failed' } })
      .catch(() => 0),

    // Unresolved safety events
    prisma.safetyEvent
      .count({ where: { resolvedAt: null } })
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
