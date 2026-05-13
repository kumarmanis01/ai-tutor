/**
 * FILE OBJECTIVE:
 * - Validate the ShareBadge action layout remains wrap-safe and all share channels render.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/ShareBadge.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-10T00:00:00Z | copilot | add layout regression tests for share action wrapping and rendered channels
 * - 2026-05-13T00:00:00Z | copilot | add analytics coverage for badge share and share-platform events
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import analyticsClient from '@/lib/analytics/client';
import ShareBadge from '@/components/ShareBadge';

jest.mock('@/lib/analytics/client', () => ({
  __esModule: true,
  default: {
    trackEvent: jest.fn(),
  },
}));

const trackEventMock = jest.mocked(analyticsClient.trackEvent);

describe('ShareBadge', () => {
  beforeEach(() => {
    trackEventMock.mockReset();
  });

  it('should render wrap-safe action container', () => {
    render(<ShareBadge badgeId="b1" title="Chapter Master" description="Mastered a chapter concept" url="https://example.com" />);

    const actions = screen.getByTestId('share-badge-actions');
    expect(actions.className).toContain('flex-wrap');
    expect(actions.className).toContain('max-w-full');
  });

  it('should render all share action labels', () => {
    render(<ShareBadge badgeId="b1" title="Chapter Master" description="Mastered a chapter concept" url="https://example.com" />);

    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Twitter' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Facebook' })).toBeTruthy();
  });

  it('emits share analytics for platform link clicks', () => {
    render(<ShareBadge badgeId="b1" title="Chapter Master" description="Mastered a chapter concept" url="https://example.com" />);

    fireEvent.click(screen.getByRole('link', { name: 'WhatsApp' }));

    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'student.badge.share_badge' }),
    );
    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'student.badge.share_platform' }),
    );
  });
});
