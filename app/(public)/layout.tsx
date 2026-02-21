import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import GoogleTagManagerClient from '@/components/ClientOnly/GoogleTagManagerClient';
import AppModalClient from '@/components/ClientOnly/AppModalClient';
import Providers from '@/app/providers';
import { GlobalLoaderProvider } from '@/context/GlobalLoaderProvider';
import AuthSessionLoader from '@/components/AuthSessionLoader';
import ToastHost from '@/components/ToastHost';
import Navbar from '@/components/Navbar';
import '@/styles/index.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Spinzy Academy – AI Tutor India',
  description:
    "India's first AI-powered tutor providing instant homework help for classes 1-12.",
  icons: { icon: [{ url: '/favicon.ico', type: 'image/x-icon' }] },
};

/**
 * Public shell root layout
 * - Owns the HTML document for all public/marketing routes (/, /about, /pricing …)
 * - Renders the public Navbar with auth-aware Login button
 * - Must NOT wrap any student or admin routes
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
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
            <Navbar />
            {children}
            <ToastHost />
          </GlobalLoaderProvider>
        </Providers>
      </body>
    </html>
  );
}
