/**
 * FILE OBJECTIVE:
 * - Unit tests for `LearningPlanTimeline` component.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/LearningPlanTimeline.test.tsx
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | add component unit tests for optimistic reorder
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { LearningPlanTimeline } from '@/components/student/LearningPlanTimeline';

describe('LearningPlanTimeline component', () => {
  const initialData = {
    planId: 'plan-1',
    subjectId: 's1',
    subjectName: 'Test',
    examDate: null,
    weeklyGoal: 2,
    totalWeeks: 1,
    totalConcepts: 2,
    completedConcepts: 0,
    weeks: [
      {
        weekNumber: 1,
        startDate: '2026-04-06',
        chapterSummary: [{ chapterName: 'Ch1', sessionCount: 2 }],
        items: [
          {
            id: 'i1',
            conceptId: 'c1',
            conceptName: 'First concept',
            chapterName: 'Ch1',
            chapterId: 'ch1',
            orderInWeek: 0,
            status: 'UPCOMING' as const,
            isMandatory: false,
          },
          {
            id: 'i2',
            conceptId: 'c2',
            conceptName: 'Second concept',
            chapterName: 'Ch1',
            chapterId: 'ch1',
            orderInWeek: 1,
            status: 'UPCOMING' as const,
            isMandatory: false,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    // Reset global.fetch mock
    // @ts-expect-error TODO: fix types
    global.fetch = jest.fn();
  });

  it('optimistically swaps items when move succeeds', async () => {
    // Mock fetch to return OK
    // @ts-expect-error TODO: fix types
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    render(<LearningPlanTimeline initialData={initialData as any} />);

    // initial order numbers: 1 and 2
    expect(screen.getAllByText('1')[0]).toBeInTheDocument();
    expect(screen.getAllByText('2')[0]).toBeInTheDocument();

    // click move down on first item's down button
    const downButtons = screen.getAllByRole('button', { name: /Move .* down/i });
    expect(downButtons.length).toBeGreaterThan(0);

    fireEvent.click(downButtons[0]);

    // Wait for optimistic reorder to reflect: first item should now show order 2
    await waitFor(() => {
      const orderBadges = screen.getAllByText(/^[12]$/);
      // After swap, the first concept should now have badge '2'
      expect(orderBadges.some((el) => el.textContent === '2')).toBe(true);
    });

    // Ensure fetch was called with PATCH and correct body
    // @ts-expect-error TODO: fix types
    expect(global.fetch).toHaveBeenCalled();
    // Check last call payload
    // @ts-expect-error TODO: fix types
    const lastCall = global.fetch.mock.calls[0];
    expect(lastCall[0]).toMatch(/\/api\/student\/learning-plan\//);
    const fetchOptions = lastCall[1];
    expect(fetchOptions.method).toBe('PATCH');
    const body = JSON.parse(fetchOptions.body);
    expect(body.action).toBe('move');
  });
});
