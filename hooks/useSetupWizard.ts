/**
 * FILE OBJECTIVE:
 * - Lightweight setup wizard state hook for A0.2 admin invite acceptance flow.
 *
 * LINKED UNIT TEST:
 * - tests/unit/hooks/useSetupWizard.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:08:00Z | copilot | created setup wizard state hook for multi-step admin onboarding UI
 */

'use client';

import { useCallback, useState } from 'react';

export interface SetupWizardStep {
  id: number;
  title: string;
}

export function useSetupWizard(totalSteps = 3) {
  const [step, setStep] = useState(1);

  const canGoNext = step < totalSteps;
  const canGoPrevious = step > 1;

  const next = useCallback(() => {
    setStep((s) => (s < totalSteps ? s + 1 : s));
  }, [totalSteps]);

  const previous = useCallback(() => {
    setStep((s) => (s > 1 ? s - 1 : s));
  }, []);

  const goTo = useCallback(
    (target: number) => {
      if (target >= 1 && target <= totalSteps) {
        setStep(target);
      }
    },
    [totalSteps]
  );

  return {
    step,
    canGoNext,
    canGoPrevious,
    next,
    previous,
    goTo,
  };
}

export default useSetupWizard;
