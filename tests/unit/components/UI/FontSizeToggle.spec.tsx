/**
 * FILE OBJECTIVE:
 * - Unit tests for the `FontSizeToggle` component.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/UI/FontSizeToggle.spec.tsx
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | add basic render + save test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the current user hook to provide a predictable profile
jest.mock('@/hooks/useCurrentUser', () => ({
  __esModule: true,
  default: () => ({ data: { preferences: { fontSize: 'medium' } }, mutate: jest.fn() }),
}));

import FontSizeToggle from '@/components/UI/FontSizeToggle';

describe('FontSizeToggle component', () => {
  beforeEach(() => {
    // @ts-expect-error TODO: fix types
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it('renders and calls save API when a size is selected', async () => {
    render(<FontSizeToggle />);

    const largeButton = screen.getByText('A+');
    fireEvent.click(largeButton);

    await waitFor(() => {
      // @ts-expect-error TODO: fix types
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
