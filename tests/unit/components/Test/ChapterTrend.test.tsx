/**
 * FILE OBJECTIVE:
 * - Unit test for the ChapterTrend integration in `ChapterTests`.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Test/ChapterTrend.test.tsx
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | add unit test for per-chapter trend fetch + render
 * - 2026-04-20T12:08:00Z | copilot | update fetch mocks to return URL-specific shapes for sparklines and trend API
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ChapterTests from '@/components/Test/ChapterTests';

describe('ChapterTrend (ChapterTests integration)', () => {
  beforeEach(() => {
    // @ts-expect-error TODO: fix types
    global.fetch = jest.fn((input: any) => {
      const url = typeof input === 'string' ? input : String(input?.url ?? input);
      // Sparklines endpoint returns a chapter->points map
      if (url.includes('/api/student/tests/trends')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: { 'Chapter One': [{ date: '2026-04-01T00:00:00Z', score: 80 }] },
          }),
        });
      }
      // Single-chapter trend endpoint returns an array of points
      if (url.includes('/api/student/tests/trend')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ date: '2026-04-01T00:00:00Z', score: 80 }] }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('fetches and shows per-chapter trend when Trend is toggled', async () => {
    // fetch is mocked above with URL-aware responses for sparklines and trend

    render(
      <ChapterTests
        subject="Math"
        grade="10"
        board="CBSE"
        chapters={[{ id: 'ch1', name: 'Chapter One' }]}
      />
    );

    // Click the Trend button
    const trendButton = screen.getByRole('button', { name: /Trend/i });
    fireEvent.click(trendButton);

    // Wait for the chart to render the rounded score label
    await waitFor(() => expect(screen.getByText('80%')).toBeInTheDocument());

    // Ensure fetch was called to the trend endpoint
    // @ts-expect-error TODO: fix types
    const calls = (global.fetch as jest.Mock).mock.calls;
    const calledTrend = calls.some(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('/api/student/tests/trend')
    );
    expect(calledTrend).toBeTruthy();
  });
});
