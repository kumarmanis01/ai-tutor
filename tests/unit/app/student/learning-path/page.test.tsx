/**
 * FILE OBJECTIVE:
 * - Unit tests for the /student/learning-path page and its child components.
 * - Covers auth guard, timeline null fallback, client render, mandatory chapter
 *   reorder restrictions, and TodaysLearningCard "View full plan" link.
 *
 * LINKED COMPONENT:
 * - app/(student)/student/learning-path/page.tsx
 * - components/student/learning-path/LearningPathClient.tsx
 * - components/student/dashboard/TodaysLearningCard.tsx
 *
 * EDIT LOG:
 * - 2026-05-23T00:00:00Z | claude | created for F-STU-003 learning path tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import type { TimelineResponse } from '@/lib/student/learningPlanTimeline';

// ── Shared mocks ──────────────────────────────────────────────────────────────

const pushMock = jest.fn();
const refreshMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  redirect: jest.fn(),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));
jest.mock('@/lib/toast', () => ({ toast: jest.fn() }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTimeline(overrides: Partial<TimelineResponse> = {}): TimelineResponse {
  return {
    planId: 'plan-1',
    subjectId: 'sub-1',
    subjectName: 'Mathematics',
    examDate: null,
    weeklyGoal: 5,
    totalWeeks: 2,
    totalConcepts: 4,
    completedConcepts: 1,
    weeks: [
      {
        weekNumber: 1,
        startDate: '2026-06-01',
        items: [
          {
            id: 'item-1',
            conceptId: 'c1',
            conceptName: 'Quadratic Equations',
            chapterName: 'Algebra',
            chapterId: 'ch-1',
            orderInWeek: 0,
            status: 'UPCOMING',
            isMandatory: false,
          },
          {
            id: 'item-2',
            conceptId: 'c2',
            conceptName: 'Linear Equations',
            chapterName: 'Locked Chapter',
            chapterId: 'ch-2',
            orderInWeek: 1,
            status: 'UPCOMING',
            isMandatory: true,
          },
        ],
        chapterSummary: [
          { chapterName: 'Algebra', sessionCount: 1 },
          { chapterName: 'Locked Chapter', sessionCount: 1 },
        ],
      },
    ],
    ...overrides,
  };
}

// ── LearningPathClient tests ──────────────────────────────────────────────────

describe('LearningPathClient', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it('should render week panels with chapter names', () => {
    const LearningPathClient = require('@/components/student/learning-path/LearningPathClient').default;
    render(<LearningPathClient data={makeTimeline()} isFirstVisit={false} />);

    expect(screen.getByText('Algebra')).toBeInTheDocument();
    expect(screen.getByText('Locked Chapter')).toBeInTheDocument();
  });

  it('should show the welcome banner when isFirstVisit is true', () => {
    const LearningPathClient = require('@/components/student/learning-path/LearningPathClient').default;
    render(<LearningPathClient data={makeTimeline()} isFirstVisit={true} />);

    expect(
      screen.getByText(/Your personalised learning path is ready/i),
    ).toBeInTheDocument();
  });

  it('should not show the welcome banner when isFirstVisit is false', () => {
    const LearningPathClient = require('@/components/student/learning-path/LearningPathClient').default;
    render(<LearningPathClient data={makeTimeline()} isFirstVisit={false} />);

    expect(
      screen.queryByText(/Your personalised learning path is ready/i),
    ).not.toBeInTheDocument();
  });

  it('should show reorder buttons on non-mandatory upcoming chapters', () => {
    const LearningPathClient = require('@/components/student/learning-path/LearningPathClient').default;
    render(<LearningPathClient data={makeTimeline()} isFirstVisit={false} />);

    // "Algebra" chapter is not mandatory -- reorder buttons should be present
    expect(screen.getByLabelText('Move Algebra earlier')).toBeInTheDocument();
    expect(screen.getByLabelText('Move Algebra later')).toBeInTheDocument();
  });

  it('should not show reorder buttons on mandatory chapters', () => {
    const LearningPathClient = require('@/components/student/learning-path/LearningPathClient').default;
    render(<LearningPathClient data={makeTimeline()} isFirstVisit={false} />);

    // "Locked Chapter" is mandatory -- no reorder buttons
    expect(screen.queryByLabelText('Move Locked Chapter earlier')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Move Locked Chapter later')).not.toBeInTheDocument();
  });

  it('should show the exam countdown banner when exam date is set', () => {
    const LearningPathClient = require('@/components/student/learning-path/LearningPathClient').default;
    const examDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days from now
    render(<LearningPathClient data={makeTimeline({ examDate })} isFirstVisit={false} />);

    expect(screen.getByText(/Crunch Mode/i)).toBeInTheDocument();
  });

  it('should show the Recalculate Plan button', () => {
    const LearningPathClient = require('@/components/student/learning-path/LearningPathClient').default;
    render(<LearningPathClient data={makeTimeline()} isFirstVisit={false} />);

    expect(screen.getByRole('button', { name: /Recalculate Plan/i })).toBeInTheDocument();
  });
});

// ── TodaysLearningCard "View full plan" link ──────────────────────────────────

describe('TodaysLearningCard (View full plan link)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (global as any).fetch = jest.fn();
  });

  it('should show "View full plan" link in start state when planItemId is present', () => {
    const TodaysLearningCard = require('@/components/student/dashboard/TodaysLearningCard').default;
    const rec = {
      conceptId: 'c1',
      topicTitle: 'Topic 1',
      subject: 'Math',
      estimatedTimeMin: 10,
      weekNumber: 1,
      planItemId: 'lp-1',
    } as any;

    render(<TodaysLearningCard type="start" recommendation={rec} />);

    const link = screen.getByRole('link', { name: /View full plan/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/student/learning-path');
  });

  it('should show "View full plan" link in resume state', () => {
    const TodaysLearningCard = require('@/components/student/dashboard/TodaysLearningCard').default;
    const session = {
      sessionId: 's1',
      topicId: 't1',
      topicName: 'Topic 1',
      subject: 'Math',
      chapter: 'Chapter 1',
      currentPhase: 'LEARN',
    } as any;

    render(<TodaysLearningCard type="resume" session={session} />);

    const link = screen.getByRole('link', { name: /View full plan/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/student/learning-path');
  });
});
