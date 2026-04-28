/**
 * FILE OBJECTIVE:
 * - Shared landing page CTA button that starts Google sign-in with loading and
 *   inline error feedback for marketing page conversion surfaces.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/LandingGoogleCtaButton.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | copilot | created shared Google sign-in CTA for landing page sections
 */
'use client';

import { useState, type ReactNode } from 'react';
import { signIn } from 'next-auth/react';
import { logger } from '@/lib/logger';

interface LandingGoogleCtaButtonProps {
  callbackUrl?: string;
  className?: string;
  errorClassName?: string;
  icon?: ReactNode;
  label: string;
}

const DEFAULT_ERROR_MESSAGE = 'Sign-in failed. Please try again or contact support.';

const LandingGoogleCtaButton = ({
  callbackUrl = '/student/onboarding',
  className,
  errorClassName,
  icon,
  label,
}: LandingGoogleCtaButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await signIn('google', { callbackUrl });
    } catch (error) {
      logger.error('landing.google_sign_in_failed', {
        error: error instanceof Error ? error.message : String(error),
        callbackUrl,
      });
      setErrorMessage(DEFAULT_ERROR_MESSAGE);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  };

  return (
    <div className="w-full sm:w-auto">
      <button
        type="button"
        onClick={() => {
          void handleClick();
        }}
        disabled={isLoading}
        aria-busy={isLoading}
        className={className}
      >
        {icon}
        <span>{isLoading ? 'Signing in...' : label}</span>
      </button>
      {errorMessage ? (
        <p className={errorClassName ?? 'mt-3 text-sm font-medium text-[#E24B4A]'}>{errorMessage}</p>
      ) : null}
    </div>
  );
};

export default LandingGoogleCtaButton;
