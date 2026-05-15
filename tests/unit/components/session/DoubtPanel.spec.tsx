/**
 * FILE OBJECTIVE:
 * - Verify the session doubt panel handles API outcomes correctly, including free-limit paywall behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/session/DoubtPanel.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-08T00:00:00Z | copilot | add regression coverage for free-limit paywall handling in DoubtPanel
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DoubtPanel } from '@/components/session/DoubtPanel';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => <img {...props} alt={String(props.alt ?? '')} />,
}));

jest.mock('@/components/student/subscription/UpgradeFlow', () => ({
  UpgradeFlow: () => <div data-testid="upgrade-flow">Upgrade flow</div>,
}));

const mockFetch = jest.fn();

describe('DoubtPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it('should open the paywall modal when the doubts API returns free_limit_reached', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'free_limit_reached' }),
    });

    render(
      <DoubtPanel
        subject="Math"
        chapter="Fractions"
        topicName="Equivalent Fractions"
        isOpen
        onClose={() => {}}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Type or speak your doubt here...'), {
      target: { value: 'Can you explain this step?' },
    });
    fireEvent.click(screen.getByLabelText('Send doubt'));

    await waitFor(() => {
      expect(screen.getByText('Continue asking Teacher Vidya')).toBeTruthy();
    });

    expect(screen.getByTestId('upgrade-flow')).toBeTruthy();
    expect(screen.queryByText('I could not connect right now. Please try again in a moment.')).toBeNull();
  });

  it('should show the generic fallback message when the doubts API fails for other reasons', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));

    render(
      <DoubtPanel
        subject="Science"
        chapter="Plants"
        topicName="Photosynthesis"
        isOpen
        onClose={() => {}}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Type or speak your doubt here...'), {
      target: { value: 'Why are leaves green?' },
    });
    fireEvent.click(screen.getByLabelText('Send doubt'));

    await waitFor(() => {
      expect(screen.getByText('I could not connect right now. Please try again in a moment.')).toBeTruthy();
    });

    expect(screen.queryByTestId('upgrade-flow')).toBeNull();
  });
});