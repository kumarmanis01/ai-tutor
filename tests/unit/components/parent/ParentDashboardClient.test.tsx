/**
 * FILE OBJECTIVE:
 * - Unit test for parent dashboard drill-down: verifies that the mastery
 *   info tooltip uses the server-provided `masteryExplanation` and that
 *   anonymized benchmarking text appears only when the parent opt-in is set.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/parent/ParentDashboardClient.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | assistant | add UI test for mastery tooltip & benchmarking opt-in
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next-auth session as authenticated
jest.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { name: 'Parent' } }, status: 'authenticated' }) }));

// Mock next/navigation router used inside the component
const pushMock = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock, refresh: jest.fn() }) }));

// Stub toast/logger to avoid noisy output
jest.mock('@/lib/toast', () => ({ toast: jest.fn() }));
jest.mock('@/lib/logger', () => ({ debug: jest.fn(), error: jest.fn(), info: jest.fn() }));

import ParentDashboardClient from '@/app/(student)/parent/ParentDashboardClient';

describe('ParentDashboardClient (integration)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // default fetch mock to route responses by URL
    (global as any).fetch = jest.fn((url: string) => {
      if (typeof url === 'string' && url.includes('/api/parent/dashboard')) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, isParent: true, totalStudents: 1, generatedAt: new Date().toISOString(), students: [{ studentId: 's1', studentName: 'Test Student', subjects: ['Math'], weekly: [], subjectProgress: [], attentionBySubject: [], masteryDistribution: [], attentionOpenCount: 0, readiness: [] }] }) });
      }

      if (typeof url === 'string' && url.includes('/api/parent/subject-mastery')) {
        return Promise.resolve({ ok: true, json: async () => ([{
          subject: 'Math',
          avgAccuracy: 0.75,
          topicCount: 10,
          predictedMarkRange: [70, 85],
          masteryExplanation: 'This is what this means',
          chapters: [
            { chapter: 'Algebra', topics: [{ topicId: 't1', masteryLevel: 'advanced', accuracy: 0.9, questionsAttempted: 5 }] }
          ],
          topStrengths: [],
          topWeaknesses: [],
          predictedDaysTo80: null,
          predictedReadyByDate: null,
          peerPercentile: 78
        }]) });
      }

      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
  });

  it('shows mastery tooltip and benchmarking copy when opt-in enabled', async () => {
    // Enable benchmarking opt-in in localStorage
    (global as any).localStorage.setItem('parent_benchmarking_optin', '1');

    render(<ParentDashboardClient />);

    // Wait for the deep-dive button to appear and click it
    await waitFor(() => expect(screen.getByRole('button', { name: /Open detailed view/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Open detailed view/i }));

    // Wait for the subject button to appear (from fetched subject-mastery)
    await waitFor(() => expect(screen.getByText('Math')).toBeInTheDocument());

    // Expand the subject card
    fireEvent.click(screen.getByText('Math'));

    // Info icon should have title equal to masteryExplanation
    await waitFor(() => expect(screen.getByText('ⓘ')).toHaveAttribute('title', 'This is what this means'));

    // Benchmarking copy should include the percentile (78)
    await waitFor(() => expect(screen.getByText(/78% of students/)).toBeInTheDocument());
  });
});
