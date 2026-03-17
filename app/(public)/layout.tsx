import React, { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import GoogleTagManagerClient from '@/components/ClientOnly/GoogleTagManagerClient';
import AppModalClient from '@/components/ClientOnly/AppModalClient';
import Providers from '@/app/providers';
import { GlobalLoaderProvider } from '@/context/GlobalLoaderProvider';
import AuthSessionLoader from '@/components/AuthSessionLoader';
import ToastHost from '@/components/ToastHost';
import StickyHeader from '@/components/StickyHeader';
import '@/styles/index.css';

export const viewport: Viewport = {
  themeColor: '#534AB7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Spinzy Academy — Teacher Vidya, Your Child\'s AI Home Tutor',
  description: 'Meet Teacher Vidya — India\'s AI home tutor for Class 6-12 students. CBSE, ICSE & State Board. Start free at Spinzy Academy.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Spinzy',
  },
  icons: {
    apple: [
      { url: '/icons/icon-152.png', sizes: '152x152' },
      { url: '/icons/icon-192.png', sizes: '192x192' },
    ],
    icon: '/icons/icon-192.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#534AB7',
    'msapplication-TileImage': '/icons/icon-144.png',
  },
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
            {/* Single public navbar — StickyHeader is h-16 mobile / h-[72px] desktop */}
            <StickyHeader />
            <div className="pt-16 md:pt-[72px]">
              {children}
            </div>
            <ToastHost />
          </GlobalLoaderProvider>
        </Providers>
      </body>
    </html>
  );
}
