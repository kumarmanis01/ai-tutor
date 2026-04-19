/**
 * FILE OBJECTIVE:
 * - Unit test for the ChapterTrend integration in `ChapterTests`.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Test/ChapterTrend.test.tsx
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | add unit test for per-chapter trend fetch + render
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChapterTests from '@/components/Test/ChapterTests';

describe('ChapterTrend (ChapterTests integration)', () => {
  beforeEach(() => {
    // @ts-expect-error TODO: fix types
    global.fetch = jest.fn();
  });

  it('fetches and shows per-chapter trend when Trend is toggled', async () => {
    // Mock the trend API response
    // @ts-expect-error TODO: fix types
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ date: '2026-04-01T00:00:00Z', score: 80 }] }) });

    render(
      <ChapterTests
        subject="Math"
        grade="10"
        board="CBSE"
        chapters={[{ id: 'ch1', name: 'Chapter One' }]}
      />,
    );

    // Click the Trend button
    const trendButton = screen.getByRole('button', { name: /Trend/i });
    fireEvent.click(trendButton);

    // Wait for the chart to render the rounded score label
    await waitFor(() => expect(screen.getByText('80%')).toBeInTheDocument());

    // Ensure fetch was called to the trend endpoint
    // @ts-expect-error TODO: fix types
    expect(global.fetch).toHaveBeenCalled();
  });
});
