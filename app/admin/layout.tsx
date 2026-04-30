import React, { Suspense } from 'react';
import localFont from 'next/font/local';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccessToken } from '@/lib/auth/token.service';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { AdminTopbar } from '../../components/admin/AdminTopbar';
import Providers from '@/app/providers';
import { GlobalLoaderProvider } from '@/context/GlobalLoaderProvider';
import { NavigationProgress } from '../../components/NavigationProgress';
import ToastHost from '../../components/ToastHost';
import GoogleTagManagerClient from '../../components/ClientOnly/GoogleTagManagerClient';
import AppModalClient from '../../components/ClientOnly/AppModalClient';
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
 * - Verifies __admin_tok HTTP-only cookie (JWT issued by /api/v1/admin/auth/*)
 * - Fetches sidebar badge counts server-side in parallel
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-pathname') ?? '';
  const isPublicAdminRoute = pathname === '/admin/login' || pathname === '/admin/setup';

  if (isPublicAdminRoute) {
    return (
      <html lang="en" className={`h-full ${inter.variable} ${nunito.variable}`}>
        <body className="font-sans antialiased h-full bg-gray-50 dark:bg-gray-950">{children}</body>
      </html>
    );
  }

  // Verify the admin session cookie set by the JWT auth endpoints
  const cookieStore = await cookies();
  const adminTok = cookieStore.get('__admin_tok')?.value;

  if (!adminTok) redirect('/admin/login');

  let adminUserId: string | undefined;
  try {
    const payload = await verifyAdminAccessToken(adminTok!);
    if (payload.scope === 'admin') adminUserId = payload.sub;
  } catch {
    redirect('/admin/login');
  }

  if (!adminUserId) redirect('/admin/login');

  const adminRecord = await prisma.adminUser.findUnique({
    where: { userId: adminUserId },
    select: { id: true, status: true },
  });

  if (!adminRecord || adminRecord.status !== 'ACTIVE') redirect('/admin/login');

  // Badge counts -- all run in parallel; individual failures fall back to 0
  const [pendingReview, activeJobs, failedJobs, safetyAlerts] = await Promise.all([
    // Content pending review: sum all draft content types
    Promise.all([
      prisma.chapterDef.count({ where: { status: 'draft', lifecycle: 'active' } }),
      prisma.topicDef.count({ where: { status: 'draft', lifecycle: 'active' } }),
      prisma.topicNote.count({ where: { status: 'draft', lifecycle: 'active' } }),
      prisma.generatedTest.count({ where: { status: 'draft', lifecycle: 'active' } }),
    ])
      .then(([c, t, n, gt]) => c + t + n + gt)
      .catch(() => 0),

    // Root hydration jobs currently running (hierarchyLevel 0 = pipeline root)
    prisma.hydrationJob.count({ where: { hierarchyLevel: 0, status: 'running' } }).catch(() => 0),

    // Failed root jobs (separate for badge colour differentiation in sidebar)
    prisma.hydrationJob.count({ where: { hierarchyLevel: 0, status: 'failed' } }).catch(() => 0),

    // Unresolved safety events
    prisma.safetyEvent.count({ where: { resolvedAt: null } }).catch(() => 0),
  ]);

  return (
    <html lang="en" className={`h-full ${inter.variable} ${nunito.variable}`}>
      <body className="font-sans antialiased h-full">
        <Providers>
          <GlobalLoaderProvider>
            <NavigationProgress />
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
                <AdminTopbar title="Admin" runningJobs={activeJobs} />
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
