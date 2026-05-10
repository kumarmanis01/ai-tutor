/**
 * FILE OBJECTIVE:
 * - Unit tests for the `ProfileWidgets` component showcase flow: open modal, select badges, save via PATCH.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/ProfileWidgets.showcase.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-18T00:00:00Z | copilot | add showcase selection test
 * - 2026-05-10T00:00:00Z | copilot | add overflow guard assertions for badge cards and action area
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileWidgets from '@/components/ProfileWidgets';

describe('ProfileWidgets showcase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('allows selecting badges and saves via PATCH', async () => {
    const badges = [
      { id: 'b1', name: 'First', description: 'desc', icon: '🏅' },
      { id: 'b2', name: 'Second', description: 'desc', icon: '🎖️' },
    ];

    const mockFetch = jest.fn((input: any, opts?: any) => {
      if (!opts) {
        // GET /api/user/profile
        return Promise.resolve({ ok: true, json: async () => ({ preferences: { badgeShowcase: [] } }) });
      }
      if (opts.method === 'PATCH') {
        const body = JSON.parse(opts.body || '{}');
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, preferences: { badgeShowcase: body.preferences.badgeShowcase } }) });
      }
      return Promise.resolve({ ok: false });
    });

    (global as any).fetch = mockFetch;

    render(<ProfileWidgets badges={badges as any} showLeaderboard={false} showChallenge={false} /> as any);

    const grid = await screen.findByTestId('badges-grid');
    expect(grid.className).toContain('max-w-full');

    const badgeCard = await screen.findByTestId('badge-card');
    expect(badgeCard.className).toContain('overflow-hidden');

    const badgeCardActions = await screen.findByTestId('badge-card-actions');
    expect(badgeCardActions.className).toContain('w-full');

    // wait for manage button
    const manage = await screen.findByRole('button', { name: /Manage Showcase/i });
    fireEvent.click(manage);

    // select first badge
    const firstButton = await screen.findByRole('button', { name: /First/i });
    fireEvent.click(firstButton);

    // save
    const save = screen.getByRole('button', { name: /Save Showcase/i });
    fireEvent.click(save);

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    // verify PATCH called with selected id
    const patchCall = mockFetch.mock.calls.find((c: any[]) => c[1] && c[1].method === 'PATCH');
    expect(patchCall).toBeTruthy();
    const body = JSON.parse(patchCall[1].body);
    expect(body.preferences.badgeShowcase).toEqual(['b1']);
  });
});
