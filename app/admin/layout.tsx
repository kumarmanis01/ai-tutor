import React, { Suspense } from 'react';
import localFont from 'next/font/local';
import { getServerSessionForHandlers } from '@/lib/session';
import { notFound } from 'next/navigation';
import AdminSidebar from '@/components/Admin/AdminSidebar';
import Providers from '@/app/providers';
import { GlobalLoaderProvider } from '@/context/GlobalLoaderProvider';
import AuthSessionLoader from '@/components/AuthSessionLoader';
import ToastHost from '@/components/ToastHost';
import GoogleTagManagerClient from '@/components/ClientOnly/GoogleTagManagerClient';
import AppModalClient from '@/components/ClientOnly/AppModalClient';
import '@/styles/index.css';

// Self-hosted fonts -- no build-time network dependency on fonts.googleapis.com
const inter = localFont({ src: '../../public/fonts/inter-latin-variable.woff2', variable: '--font-inter', display: 'swap' });
const nunito = localFont({ src: '../../public/fonts/nunito-variable-latin.woff2', variable: '--font-nunito', display: 'swap' });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * Admin shell root layout
 * - Standalone root layout for /admin/* routes (no parent app/layout.tsx)
 * - Checks admin role server-side; returns 404 for non-admins
 * - Renders AdminSidebar
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSessionForHandlers();

  // Hide admin area from non-admins
  if (!session || (session.user && session.user.role !== 'admin')) {
    notFound();
  }

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
            <div className="flex min-h-screen pt-16 bg-gray-50 dark:bg-gray-900">
              <AdminSidebar />
              <main className="flex-1 p-8 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 rounded-lg">
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
