/**
 * Unit tests for SessionBottomBar component.
 *
 * EDIT LOG:
 * - 2026-04-22 | claude | initial test suite per review request
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock next/image -- renders a plain <img> in tests
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

// Stub global fetch before each test
beforeEach(() => {
  (global as any).fetch = jest.fn().mockResolvedValue({ ok: true });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runAllTimers();
  jest.useRealTimers();
  jest.resetAllMocks();
});

import { SessionBottomBar } from '@/components/session/SessionBottomBar';

const defaultProps = {
  onAskVidya: jest.fn(),
  sessionId: 'sess-123',
  currentPhase: 'EXPLANATION',
};

describe('SessionBottomBar', () => {
  it('renders Ask Vidya and Feedback buttons', () => {
    render(<SessionBottomBar {...defaultProps} />);
    expect(screen.getByText('Ask Vidya')).toBeTruthy();
    expect(screen.getByText('Feedback')).toBeTruthy();
  });

  it('calls onAskVidya when Ask Vidya button is tapped', () => {
    const onAskVidya = jest.fn();
    render(<SessionBottomBar {...defaultProps} onAskVidya={onAskVidya} />);
    fireEvent.click(screen.getByText('Ask Vidya'));
    expect(onAskVidya).toHaveBeenCalledTimes(1);
  });

  it('opens the feedback bottom sheet when Feedback is tapped', () => {
    render(<SessionBottomBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Feedback'));
    expect(screen.getByText('How was this lesson?')).toBeTruthy();
    // 5 star buttons visible
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByLabelText(`Rate ${i} star${i > 1 ? 's' : ''}`)).toBeTruthy();
    }
  });

  it('selecting a star submits POST with correct payload and shows thank-you', async () => {
    render(<SessionBottomBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Feedback'));

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Rate 4 stars'));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/student/session/feedback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'sess-123',
          rating: 4,
          phase: 'EXPLANATION',
        }),
      })
    );

    expect(screen.getByText(/thank you/i)).toBeTruthy();
  });

  it('closes feedback sheet after thank-you delay', async () => {
    render(<SessionBottomBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Feedback'));
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Rate 5 stars'));
    });

    // Sheet still open (thank-you visible)
    expect(screen.getByText(/thank you/i)).toBeTruthy();

    // Advance the 900ms auto-close timer
    act(() => jest.advanceTimersByTime(900));

    await waitFor(() => {
      expect(screen.queryByText('How was this lesson?')).toBeNull();
    });
  });

  it('dismisses feedback sheet when backdrop is tapped', () => {
    render(<SessionBottomBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Feedback'));
    expect(screen.getByText('How was this lesson?')).toBeTruthy();

    const backdrop = screen.getByTestId('feedback-backdrop');
    fireEvent.click(backdrop);
    expect(screen.queryByText('How was this lesson?')).toBeNull();
  });

  it('does not block the student when the feedback POST fails', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('network error'));
    render(<SessionBottomBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Feedback'));

    // Should not throw
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Rate 3 stars'));
    });

    // Thank-you state still shown (UI not affected by network error)
    expect(screen.getByText(/thank you/i)).toBeTruthy();
  });
});
