/**
 * FILE OBJECTIVE:
 * - Root client-side provider composition for auth, theme, onboarding, and app-level UI state.
 * - Emits app lifecycle analytics on mount and page hide so student app usage is visible in admin analytics.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/providers.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | emit app open and app close analytics from root client providers
 * - 2026-05-13T00:00:00Z | copilot | emit role-scoped app open and app close analytics for student, parent, and admin surfaces
 */

'use client';

import { useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import Script from 'next/script';
import analyticsClient from '@/lib/analytics/client';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import ThemeProvider from '@/components/UI/ThemeProvider';
import { OnboardingProvider } from '@/context/OnboardingProvider';
import AlertModal from '@/components/UI/AlertModal';

function resolveAppLifecycleEvents(pathname: string) {
  if (pathname.startsWith('/parent')) {
    return {
      open: ANALYTICS_EVENTS.PARENT.APP_OPEN,
      close: ANALYTICS_EVENTS.PARENT.APP_CLOSE,
    };
  }

  if (pathname.startsWith('/admin')) {
    return {
      open: ANALYTICS_EVENTS.ADMIN.APP_OPEN,
      close: ANALYTICS_EVENTS.ADMIN.APP_CLOSE,
    };
  }

  return {
    open: ANALYTICS_EVENTS.STUDENT.APP_OPEN,
    close: ANALYTICS_EVENTS.STUDENT.APP_CLOSE,
  };
}

function AuthAwareLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    const lifecycleEvents = resolveAppLifecycleEvents(pathname);

    analyticsClient.trackEvent({ eventType: lifecycleEvents.open });

    const handlePageHide = () => {
      analyticsClient.trackEvent({ eventType: lifecycleEvents.close });
      analyticsClient.flushEvents();
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>
      </div>
    </>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <OnboardingProvider>
          <AuthAwareLayout>{children}</AuthAwareLayout>
          <AlertModal />
        </OnboardingProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
