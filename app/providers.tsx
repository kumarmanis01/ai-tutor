'use client';

import { SessionProvider } from 'next-auth/react';
import Script from 'next/script';
import ThemeProvider from '@/components/UI/ThemeProvider';
import { OnboardingProvider } from '@/context/OnboardingProvider';
import AlertModal from '@/components/UI/AlertModal';

function AuthAwareLayout({ children }: { children: React.ReactNode }) {
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
