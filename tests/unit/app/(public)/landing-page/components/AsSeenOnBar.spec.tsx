/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for AsSeenOnBar media trust strip.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/AsSeenOnBar.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T10:56:00Z | copilot | add basic rendering coverage for media logo placeholders
 */
import { render, screen } from '@testing-library/react';
import AsSeenOnBar from '@/app/(public)/landing-page/components/AsSeenOnBar';

describe('AsSeenOnBar', () => {
  it('should render heading and media logos', () => {
    render(<AsSeenOnBar />);

    expect(screen.getByText('As Seen On')).toBeTruthy();
    expect(screen.getByLabelText('YourStory')).toBeTruthy();
    expect(screen.getByLabelText('Inc42')).toBeTruthy();
    expect(screen.getByLabelText('The Hindu')).toBeTruthy();
  });
});
