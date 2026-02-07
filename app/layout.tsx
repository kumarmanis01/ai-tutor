/**
 * FILE OBJECTIVE:
 * - Root layout component for the Next.js application with providers, analytics, and global UI.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/layout.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | added GTM integration
 */

import React, { Suspense } from 'react';
import GoogleTagManagerClient from '@/components/ClientOnly/GoogleTagManagerClient';
import AppModalClient from '@/components/ClientOnly/AppModalClient';
import '../styles/index.css';
import Providers from './providers';
import { GlobalLoaderProvider } from '@/context/GlobalLoaderProvider';
import AuthSessionLoader from '@/components/AuthSessionLoader';
import ToastHost from '@/components/ToastHost';
// Job registrations moved to worker/orchestrator to avoid running jobs in web process


export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata = {
  title: 'Next.js with Tailwind CSS',
  description: 'A boilerplate project with Next.js and Tailwind CSS',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen h-full">
        <Providers>
          <GlobalLoaderProvider>
            <AuthSessionLoader />
            {/* Google Tag Manager for external analytics & conversion tracking */}
            <Suspense fallback={null}>
              <GoogleTagManagerClient />
            </Suspense>
            {/* Global modal host */}
            <AppModalClient />
              {children}
              <ToastHost />
          </GlobalLoaderProvider>
        </Providers>

        {/* <script
          type="module"
          async
          src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Faitutori9032back.builtwithrocket.new&_be=https%3A%2F%2Fapplication.rocket.new&_v=0.1.10"
        />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.1" /> */}
      </body>
    </html>
  );
}

// AppModalClient is a client wrapper placed below to mount the modal host

// import './globals.css';
// import React from 'react';
// import { Inter } from 'next/font/google';
// import Providers from './providers';
// import AuthRedeemOnSignIn from '@/components/AuthRedeemOnSignIn';
// import Analytics from '@/components/Analytics';

// const inter = Inter({ subsets: ['latin'] });

// export const metadata = {
//   title: 'Spinzy Academy',
//   description: 'Your Personal AI Tutor — Learn Anything, Anytime.',
// };

// export default function RootLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html lang="en" className="h-full">
//       <body className={`${inter.className} min-h-screen h-full`}>
//         <div className="min-h-screen h-full bg-gray-50 dark:bg-gray-900 flex flex-col">
//           <Providers>
//             {/* Mount global client handlers inside Suspense to satisfy next/navigation hooks */}
//             <React.Suspense fallback={null}>
//               <AuthRedeemOnSignIn />
//               <Analytics />
//             </React.Suspense>

//             {children}
//           </Providers>
//         </div>
//       </body>
//     </html>
//   );
// }
