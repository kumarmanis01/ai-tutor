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
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import ShareBadge from '@/components/ShareBadge';

describe('ShareBadge', () => {
  it('should render wrap-safe action container', () => {
    render(<ShareBadge badgeId="b1" title="Chapter Master" description="Mastered a chapter concept" url="https://example.com" />);

    const actions = screen.getByTestId('share-badge-actions');
    expect(actions.className).toContain('flex-wrap');
    expect(actions.className).toContain('max-w-full');
  });

  it('should render all share action labels', () => {
    render(<ShareBadge badgeId="b1" title="Chapter Master" description="Mastered a chapter concept" url="https://example.com" />);

    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Twitter' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Facebook' })).toBeInTheDocument();
  });
});
