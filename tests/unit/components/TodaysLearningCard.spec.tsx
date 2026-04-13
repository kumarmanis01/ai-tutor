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
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/navigation router used inside the component
const pushMock = jest.fn();
const refreshMock = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock, refresh: refreshMock }) }));
jest.mock('@/lib/toast', () => ({ toast: jest.fn() }));

// Component under test
import TodaysLearningCard from '@/components/student/dashboard/TodaysLearningCard';

describe('TodaysLearningCard (component)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (global as any).fetch = jest.fn();
  });

  it('renders start state and shows move controls when planItemId present', () => {
    const rec = {
      conceptId: 'c1',
      topicTitle: 'Topic 1',
      subject: 'Math',
      estimatedTimeMin: 10,
      weekNumber: 1,
      planItemId: 'lp-1',
    } as any;

    render(<TodaysLearningCard type="start" recommendation={rec} />);

    // move buttons should be present
    const up = screen.getByLabelText('Move earlier in week');
    const down = screen.getByLabelText('Move later in week');

    expect(up).toBeInTheDocument();
    expect(down).toBeInTheDocument();
  });

  it('sends PATCH move=next and refreshes on success', async () => {
    const rec = {
      conceptId: 'c1',
      topicTitle: 'Topic 1',
      subject: 'Math',
      estimatedTimeMin: 10,
      weekNumber: 1,
      planItemId: 'lp-1',
    } as any;

    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    render(<TodaysLearningCard type="start" recommendation={rec} />);

    const down = screen.getByLabelText('Move later in week');
    fireEvent.click(down);

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
    expect((global as any).fetch).toHaveBeenCalledWith(expect.stringContaining('/api/student/learning-plan/lp-1'), expect.objectContaining({ method: 'PATCH' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('sends PATCH move=prev and refreshes on success', async () => {
    const rec = {
      conceptId: 'c1',
      topicTitle: 'Topic 1',
      subject: 'Math',
      estimatedTimeMin: 10,
      weekNumber: 1,
      planItemId: 'lp-1',
    } as any;

    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    render(<TodaysLearningCard type="start" recommendation={rec} />);

    const up = screen.getByLabelText('Move earlier in week');
    fireEvent.click(up);

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
    expect((global as any).fetch).toHaveBeenCalledWith(expect.stringContaining('/api/student/learning-plan/lp-1'), expect.objectContaining({ method: 'PATCH' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
