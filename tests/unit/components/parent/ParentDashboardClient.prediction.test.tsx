import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next-auth session as authenticated
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Parent' } }, status: 'authenticated' }),
}));

// Mock next/navigation router used inside the component
const pushMock = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock, refresh: jest.fn() }) }));

// Stub toast/logger to avoid noisy output
jest.mock('@/lib/toast', () => ({ toast: jest.fn() }));
jest.mock('@/lib/logger', () => ({ debug: jest.fn(), error: jest.fn(), info: jest.fn() }));

import ParentDashboardClient from '@/app/(student)/parent/ParentDashboardClient';

describe('ParentDashboardClient - readiness projection display', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    (global as any).fetch = jest.fn((url: string) => {
      if (typeof url === 'string' && url.includes('/api/parent/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            isParent: true,
            totalStudents: 1,
            generatedAt: new Date().toISOString(),
            students: [
              {
                studentId: 's1',
                studentName: 'Test Student',
                subjects: ['Math'],
                weekly: [],
                subjectProgress: [],
                attentionBySubject: [],
                masteryDistribution: [],
                attentionOpenCount: 0,
                readiness: [],
              },
            ],
          }),
        });
      }

      if (typeof url === 'string' && url.includes('/api/parent/subject-mastery')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              subject: 'Math',
              avgAccuracy: 0.7,
              topicCount: 10,
              predictedMarkRange: [65, 80],
              masteryExplanation: 'This is what this means',
              chapters: [],
              topStrengths: [],
              topWeaknesses: [],
              predictedDaysTo80: 5,
              predictedReadyByDate: '2026-05-01',
              peerPercentile: null,
            },
          ],
        });
      }

      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
  });

  it('shows predicted days to 80% when API returns projection', async () => {
    render(<ParentDashboardClient />);

    // wait for deep-dive button and open detailed view
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Open detailed view/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: /Open detailed view/i }));

    // wait for subject name
    await waitFor(() => expect(screen.getByText('Math')).toBeInTheDocument());

    // Expand the subject card
    fireEvent.click(screen.getByText('Math'));

    // Projection text should be visible
    await waitFor(() =>
      expect(screen.getByText(/Estimated to reach 80% in 5 day\(s\)/)).toBeInTheDocument()
    );
  });
});
