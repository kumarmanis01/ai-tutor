/**
 * FILE OBJECTIVE:
 * - Unit tests for `SessionCompletionScreen` copy-to-clipboard and share behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/session/SessionCompletionScreen.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-16T12:00:00Z | copilot | added tests for copy/share summary
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionCompletionScreen from '@/components/student/session/SessionCompletionScreen';
import { buildShareableSessionSummary } from '@/lib/student/sessionSummary';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe('SessionCompletionScreen', () => {
  beforeEach(() => {
    // Mock fetch for session complete and next-action
    global.fetch = jest.fn((url: RequestInfo) => {
      const s = String(url);
      if (s.includes('/complete')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              xpEarned: 40,
              totalXp: 1000,
              leveledUp: false,
              newLevel: null,
              masteryDelta: 0.1,
              masteryAfter: 0.6,
              badgesEarned: [{ name: 'Streak' }],
              aiInsight: 'Keep practising',
              sessionDurationMinutes: 15,
              correctAnswers: 8,
              totalQuestions: 10,
            }),
        } as any);
      }
      if (s.includes('/api/home/next-action') || s.includes('next-action')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ action: {} }) } as any);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
    }) as any;

    // Mock clipboard
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('copies multi-line shareable summary to clipboard', async () => {
    render(<SessionCompletionScreen sessionId="s1" topicName="Quadratic" hintsUsed={1} />);

    const btn = await screen.findByRole('button', { name: /Copy session summary/i });
    await userEvent.click(btn);

    await waitFor(() => expect((navigator as any).clipboard.writeText).toHaveBeenCalled());

    const expected = buildShareableSessionSummary({
      topicName: 'Quadratic',
      xpEarned: 40,
      sessionDurationMinutes: 15,
      correctAnswers: 8,
      totalQuestions: 10,
      masteryAfter: 0.6,
      aiInsight: 'Keep practising',
      badges: [{ name: 'Streak' }],
      hintsUsed: 1,
    });

    expect((navigator as any).clipboard.writeText).toHaveBeenCalledWith(expected);
  });
});
