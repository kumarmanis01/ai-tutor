/**
 * FILE OBJECTIVE:
 * - Unit tests for Scorecard mastery badge: verifies that MASTERED / DEVELOPING
 *   pills and the newlyMastered celebration copy render correctly.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | S2-2 PART C tests: initial creation
 */

/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';

// ─── Mock next/link ───────────────────────────────────────────────────────────
jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('a', { href, ...rest }, children);
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// ─── Mock QuestionFeedback (heavy sub-component) ──────────────────────────────
jest.mock('@/components/Test/QuestionFeedback', () => {
  const MockQF = () => React.createElement('div', { 'data-testid': 'question-feedback' });
  MockQF.displayName = 'QuestionFeedback';
  return MockQF;
});

import Scorecard from '@/components/Test/Scorecard';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_RESULT = {
  scorePercent: 80,
  earnedPoints: 8,
  totalPoints: 10,
  graded: [],
  difficultyFeedback: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Scorecard mastery badge', () => {
  it('should show mint pill when masteryState is MASTERED', () => {
    render(
      <Scorecard result={{ ...BASE_RESULT, masteryState: 'MASTERED', newlyMastered: false }} />,
    );
    expect(screen.getByText('Mastered')).toBeInTheDocument();
  });

  it('should show amber pill when masteryState is DEVELOPING', () => {
    render(
      <Scorecard result={{ ...BASE_RESULT, masteryState: 'DEVELOPING', newlyMastered: false }} />,
    );
    expect(screen.getByText('Keep practising')).toBeInTheDocument();
  });

  it('should show celebration copy on first MASTERED transition', () => {
    render(
      <Scorecard result={{ ...BASE_RESULT, masteryState: 'MASTERED', newlyMastered: true }} />,
    );
    expect(screen.getByText('You have mastered this topic -- well done!')).toBeInTheDocument();
  });

  it('should not render any mastery badge when masteryState is null', () => {
    render(
      <Scorecard result={{ ...BASE_RESULT, masteryState: null }} />,
    );
    expect(screen.queryByText('Mastered')).not.toBeInTheDocument();
    expect(screen.queryByText('Keep practising')).not.toBeInTheDocument();
  });
});
