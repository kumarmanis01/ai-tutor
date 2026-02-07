'use client';

import { SessionProvider } from 'next-auth/react';
import Script from 'next/script';
import ThemeProvider from '@/components/UI/ThemeProvider';
import OnboardingModal from '@/components/Onboarding/OnboardingModal';
import { OnboardingProvider, useOnboarding } from '@/context/OnboardingProvider';
import AlertModal from '@/components/UI/AlertModal';

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
        <OnboardingProvider>
          <AuthAwareLayout>{children}</AuthAwareLayout>
          <AlertModal />
          {/* Bind provider state to presentational modal */}
          <OnboardingHost />
        </OnboardingProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

function OnboardingHost() {
  const { isOpen, isRequired, values, errors, loading, saving, setValue, close, save } = useOnboarding();
  return (
    <OnboardingModal
      open={isOpen}
      required={isRequired}
      values={values}
      errors={errors}
      loading={loading}
      saving={saving}
      onChange={setValue}
      onClose={close}
      onSave={save}
    />
  );
}
