/**
 * FILE OBJECTIVE:
 * - Public root layout for marketing routes, including the shared navbar,
 *   providers, and landing-page font configuration.
 *
 * LINKED UNIT TEST:
 * - __tests__/next.config.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | copilot | LP-1.1: switch public shell to Roboto and Noto Sans Devanagari via next/font/google
 */
import React, { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Devanagari, Roboto } from 'next/font/google';
import GoogleTagManagerClient from '@/components/ClientOnly/GoogleTagManagerClient';
import AppModalClient from '@/components/ClientOnly/AppModalClient';
import Providers from '@/app/providers';
import { GlobalLoaderProvider } from '@/context/GlobalLoaderProvider';
import AuthSessionLoader from '@/components/AuthSessionLoader';
import ToastHost from '@/components/ToastHost';
import StickyHeader from '@/components/StickyHeader';
import '@/styles/index.css';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-devanagari',
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://spinzyacademy.com'),
  title: "Spinzy AI Tutor -- Teacher Vidya, Your Child's AI Home Tutor",
  description:
    'Turn doubts into confidence with Spinzy AI Tutor. Adaptive practice, mastery checks, and guided hints for Class 1-12 students. CBSE, ICSE & State Boards.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Spinzy Academy',
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
 * Public shell root layout
 * - Owns the HTML document for all public/marketing routes (/, /about, /pricing ...)
 * - Renders the public Navbar with auth-aware Login button
 * - Must NOT wrap any student or admin routes
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${roboto.variable} ${notoSansDevanagari.variable}`}>
      <body className="font-sans antialiased min-h-screen h-full">
        <Providers>
          <GlobalLoaderProvider>
            <AuthSessionLoader />
            <Suspense fallback={null}>
              <GoogleTagManagerClient />
            </Suspense>
            <AppModalClient />
            {/* Single public navbar -- StickyHeader is h-16 mobile / h-[72px] desktop */}
            <StickyHeader />
            <div className="pt-16 md:pt-[72px]">{children}</div>
            <ToastHost />
          </GlobalLoaderProvider>
        </Providers>
      </body>
    </html>
  );
}
