/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for shared landing Google CTA loading and sign-in behavior.
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
 * - 2026-04-28T00:00:00Z | copilot | created tests for shared landing Google CTA button
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LandingGoogleCtaButton from '@/app/(public)/landing-page/components/LandingGoogleCtaButton';

const mockSignIn = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

describe('LandingGoogleCtaButton', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockLoggerError.mockReset();
  });

  it('should call google sign-in with the provided callback url', async () => {
    mockSignIn.mockResolvedValue(undefined);

    render(
      <LandingGoogleCtaButton
        callbackUrl="/student/onboarding"
        className="min-h-[48px]"
        label="Start Free -- Sign in with Google"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Start Free -- Sign in with Google/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/student/onboarding' });
    });
  });

  it('should show an inline error message when sign-in throws', async () => {
    mockSignIn.mockRejectedValue(new Error('boom'));

    render(
      <LandingGoogleCtaButton
        className="min-h-[48px]"
        label="Start Free -- Sign in with Google"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Start Free -- Sign in with Google/i }));

    expect(
      await screen.findByText('Sign-in failed. Please try again or contact support.')
    ).toBeTruthy();
  });
});
