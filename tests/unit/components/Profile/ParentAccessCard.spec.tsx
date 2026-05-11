/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Verify ParentAccessCard renders onboarding guidance that explains how students share invite codes and how parents complete linking.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Profile/ParentAccessCard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add coverage for parent onboarding instructions in ParentAccessCard
 */

import { render, screen } from '@testing-library/react';
import ParentAccessCard from '@/components/Profile/ParentAccessCard';

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock('@/lib/toast', () => ({
  toast: jest.fn(),
}));

describe('ParentAccessCard', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        linkedParents: [],
        pendingInvites: [],
        parentCanSee: {
          attentionFlags: [],
          readiness: [],
          note: 'Parents can monitor progress and attention flags.',
        },
      }),
    });
  });

  it('shows clear share and parent onboarding instructions', async () => {
    render(<ParentAccessCard />);

    expect(await screen.findByText('How to share and link')).toBeTruthy();
    expect(screen.getByText('Tap Generate code to create a secure invite code.')).toBeTruthy();
    expect(
      screen.getByText('Tap Copy link and share it with your parent on WhatsApp, SMS, or email.')
    ).toBeTruthy();
    expect(screen.getByText('Parent opens the link, signs in, and lands on parent onboarding.')).toBeTruthy();
    expect(
      screen.getByText('In Link Student, the invite code is prefilled. Parent selects relationship and submits.')
    ).toBeTruthy();
    expect(
      screen.getByText('After linking, parent appears in Linked parents and can monitor your progress.')
    ).toBeTruthy();
    expect(
      screen.getByText('Invite codes expire automatically. If a code expires, generate a new one and share again.')
    ).toBeTruthy();
  });
});
