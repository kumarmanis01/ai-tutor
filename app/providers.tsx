'use client';

import { SessionProvider } from 'next-auth/react';
import Script from 'next/script';
import ThemeProvider from '@/components/UI/ThemeProvider';
import OnboardingModal from '@/components/OnboardingModal';

function AuthAwareLayout({ children }: { children: React.ReactNode }) {

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      {/* <Navbar /> Fixed, always on top */}
      <div className="flex flex-col min-h-screen">
        {/* Main content area, with top padding to avoid being hidden by Navbar */}
        <main className="flex-1 overflow-y-auto pt-16">{children}</main>
        {/* Adjust pt-16 to match your Navbar height (16 * 4px = 64px) */}
        {/* {!loggedIn && <Footer />} */}
      </div>
    </>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <AuthAwareLayout>{children}</AuthAwareLayout>
        <OnboardingModal />
      </ThemeProvider>
    </SessionProvider>
  );
}
