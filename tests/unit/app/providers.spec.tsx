/**
 * FILE OBJECTIVE:
 * - Unit test for `app/providers.tsx` to ensure root providers render children.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/providers.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-22T13:05:00Z | copilot | add basic render test for Providers
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock heavy dependencies to keep the test focused and deterministic
jest.mock('next/script', () => ({ __esModule: true, default: () => null }));
jest.mock('next-auth/react', () => ({ __esModule: true, SessionProvider: ({ children }: any) => <>{children}</> }));
jest.mock('@/context/OnboardingProvider', () => ({ __esModule: true, OnboardingProvider: ({ children }: any) => <>{children}</> }));
jest.mock('@/components/UI/AlertModal', () => ({ __esModule: true, default: () => null }));

import Providers from '@/app/providers';

describe('app/providers', () => {
  test('renders children without crashing', () => {
    render(
      <Providers>
        <div>hello-providers</div>
      </Providers>
    );

    expect(screen.getByText('hello-providers')).toBeTruthy();
  });
});
