'/**
' * FILE OBJECTIVE:
' * - Compose root application providers. Mounts auth, theme, UI-variant and onboarding
' *   providers and ensures CSS variables from `UIVariant` are applied at the app root.
' *
' * LINKED UNIT TEST:
' * - tests/unit/app/providers.spec.tsx
' *
' * COPILOT INSTRUCTIONS FOLLOWED:
' * - /docs/COPILOT_GUARDRAILS.md
' * - .github/copilot-instructions.md
' *
' * EDIT LOG:
' * - 2026-04-22T13:00:00Z | copilot | mount UIVariantProvider + ThemeWrapper at app root
' */

'use client';

import { SessionProvider } from 'next-auth/react';
import Script from 'next/script';
import ThemeProvider from '@/components/UI/ThemeProvider';
import { OnboardingProvider } from '@/context/OnboardingProvider';
import AlertModal from '@/components/UI/AlertModal';
import { UIVariantProvider, ThemeWrapper } from '@/components/UI/variants/UIVariantContext';
import type { Grade } from '@/lib/ai/prompts/schemas';

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
  // Default grade used until user profile hydrates. This ensures theme variables
  // are available on first render and can be overridden later.
  const DEFAULT_GRADE = 9 as Grade;

  return (
    <SessionProvider>
      <ThemeProvider>
        <UIVariantProvider grade={DEFAULT_GRADE}>
          <ThemeWrapper>
            <OnboardingProvider>
              <AuthAwareLayout>{children}</AuthAwareLayout>
              <AlertModal />
            </OnboardingProvider>
          </ThemeWrapper>
        </UIVariantProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
