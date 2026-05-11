/**
 * FILE OBJECTIVE:
 * - Verify SessionContainer footer behavior for TEST phase submit/continue flow.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/session/SessionContainer.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | added regression test for TEST Continue footer enablement after submit
 * - 2026-05-11T00:00:00Z | copilot | add pending PRACTICE retry regression for transient hydration-status failures
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { SessionPhaseClient } from '@/lib/session/phaseConfig';
import { SessionContainer } from '@/components/session/SessionContainer';

const mockUseSession = jest.fn();
const mockPhaseRouter = jest.fn();

const mockStartSession = jest.fn();
const mockAdvancePhase = jest.fn(async () => {});
const mockNavigateToPhase = jest.fn(async () => {});
const mockSubmitPractice = jest.fn(async () => null);
const mockSubmitTest = jest.fn(async () => ({
  score: 1,
  percentage: 100,
  correctAnswers: 2,
  totalAnswers: 2,
  results: [
    { questionId: 'q1', isCorrect: true, correctAnswer: '1' },
    { questionId: 'q2', isCorrect: true, correctAnswer: 'Natural number' },
  ],
  nextPhase: 'HOMEWORK',
}));
const mockGetPracticeHydrationStatus = jest.fn(async () => null);
const mockTriggerPracticeHydration = jest.fn(async () => null);

jest.mock('@/hooks/session/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('@/lib/session/phaseRouter', () => ({
  phaseRouter: (phase: SessionPhaseClient) => mockPhaseRouter(phase),
}));

jest.mock('@/components/session/SessionLayout', () => ({
  SessionLayout: ({ footer, children }: { footer?: { nextLabel: string; nextDisabled?: boolean; loading?: boolean; onNext: () => void }; children: React.ReactNode }) => (
    <div>
      <div>{children}</div>
      {footer ? (
        <button
          onClick={footer.onNext}
          disabled={Boolean(footer.nextDisabled) || Boolean(footer.loading)}
        >
          {footer.nextLabel}
        </button>
      ) : null}
    </div>
  ),
}));

function TestPhaseStub({
  onSubmit,
  onTestStateChange,
  onRegisterTestSubmit,
}: {
  onSubmit: (answers: { questionId: string; answer: string }[]) => Promise<unknown>;
  onTestStateChange: (allAnswered: boolean, resultSet: boolean) => void;
  onRegisterTestSubmit: (handler: (() => Promise<void>) | null) => void;
}) {
  React.useEffect(() => {
    const readyTimer = setTimeout(() => {
      onTestStateChange(true, false);
    }, 0);

    onRegisterTestSubmit(async () => {
      const res = await onSubmit([{ questionId: 'q1', answer: 'a' }]);
      if (res) onTestStateChange(true, true);
    });

    return () => {
      clearTimeout(readyTimer);
      onRegisterTestSubmit(null);
    };
  }, [onSubmit, onRegisterTestSubmit, onTestStateChange]);

  return <div>Test phase stub</div>;
}

describe('SessionContainer', () => {
  beforeEach(() => {
    mockStartSession.mockClear();
    mockAdvancePhase.mockClear();
    mockNavigateToPhase.mockClear();
    mockSubmitPractice.mockClear();
    mockSubmitTest.mockClear();
    mockGetPracticeHydrationStatus.mockClear();
    mockTriggerPracticeHydration.mockClear();

    mockUseSession.mockReturnValue({
      session: {
        sessionId: 'session-1',
        topicName: 'Number Systems',
        subject: 'Math',
        chapter: 'Foundations',
        currentPhase: 'TEST',
        phaseIndex: 4,
        totalPhases: 5,
      },
      phase: { type: 'test' },
      content: {
        type: 'test',
        testId: 'test-1',
        title: 'Quick Test',
        difficulty: 'medium',
        questions: [],
      },
      loading: false,
      error: null,
      submitting: false,
      startSession: mockStartSession,
      advancePhase: mockAdvancePhase,
      navigateToPhase: mockNavigateToPhase,
      submitPractice: mockSubmitPractice,
      submitTest: mockSubmitTest,
      getPracticeHydrationStatus: mockGetPracticeHydrationStatus,
      triggerPracticeHydration: mockTriggerPracticeHydration,
    });

    mockPhaseRouter.mockImplementation((phase: SessionPhaseClient) => {
      if (phase === 'TEST') return TestPhaseStub;
      return null;
    });
  });

  it('should enable Continue after test submit result is set', async () => {
    render(<SessionContainer topicId="topic-1" />);

    const submitButton = await screen.findByRole('button', { name: 'Submit Test' });
    await waitFor(() => {
      expect(submitButton.hasAttribute('disabled')).toBe(false);
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockSubmitTest).toHaveBeenCalledTimes(1);
    });

    const continueButton = await screen.findByRole('button', { name: 'Continue' });
    expect(continueButton.hasAttribute('disabled')).toBe(false);
  });

  it('should retry pending PRACTICE status checks after a transient failure', async () => {
    jest.useFakeTimers();
    try {
      const getPracticeHydrationStatus = jest
        .fn(async () => null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          hasActiveQuestions: false,
          isHydrationRunning: true,
          runningJobId: 'job-1',
        });

      mockUseSession.mockReturnValue({
        session: {
          sessionId: 'session-1',
          topicName: 'Number Systems',
          subject: 'Math',
          chapter: 'Foundations',
          currentPhase: 'PRACTICE',
          phaseIndex: 2,
          totalPhases: 5,
        },
        phase: { type: 'pending' },
        content: {
          type: 'pending',
          message: 'Practice content is being prepared',
        },
        loading: false,
        error: null,
        submitting: false,
        startSession: mockStartSession,
        advancePhase: mockAdvancePhase,
        navigateToPhase: mockNavigateToPhase,
        submitPractice: mockSubmitPractice,
        submitTest: mockSubmitTest,
        getPracticeHydrationStatus,
        triggerPracticeHydration: mockTriggerPracticeHydration,
      });
      mockPhaseRouter.mockReturnValue(null);

      const { unmount } = render(<SessionContainer topicId="topic-1" />);

      const generateButton = screen.getByRole('button', { name: 'Generate Practice Questions' });

      await act(async () => {
        await Promise.resolve();
      });

      expect(getPracticeHydrationStatus).toHaveBeenCalledTimes(1);
      expect(generateButton.hasAttribute('disabled')).toBe(false);

      await act(async () => {
        jest.advanceTimersByTime(4500);
        await Promise.resolve();
      });

      expect(getPracticeHydrationStatus).toHaveBeenCalledTimes(2);
      expect(generateButton.hasAttribute('disabled')).toBe(true);

      unmount();
    } finally {
      jest.useRealTimers();
    }
  });
});
