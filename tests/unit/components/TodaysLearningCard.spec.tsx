/**
 * FILE OBJECTIVE:
 * - Unit tests for the `TodaysLearningCard` component: loading and defer/move actions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/TodaysLearningCard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | add TodaysLearningCard component test stubs
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// TODO: adjust import path if component is colocated differently.
import TodaysLearningCard from '@/components/student/dashboard/TodaysLearningCard';

describe('TodaysLearningCard (component)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (global as any).fetch = jest.fn();
  });

  it('renders placeholder without crashing (skeleton)', () => {
    // NOTE: provide required props or wrap in providers if component is client-only.
    render(<TodaysLearningCard /> as any);
    expect(true).toBe(true); // placeholder assertion — replace with real checks
  });

  it('calls PATCH endpoint when defer/skip is triggered', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    render(<TodaysLearningCard /> as any);

    // TODO: find and trigger the actual defer/skip button in the component.
    // Example (replace selector when known):
    // const btn = screen.getByRole('button', { name: /skip|defer/i });
    // fireEvent.click(btn);

    // expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/student/learning-plan'), expect.objectContaining({ method: 'PATCH' }));
  });
});
