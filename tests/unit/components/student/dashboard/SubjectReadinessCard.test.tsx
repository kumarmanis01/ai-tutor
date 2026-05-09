/**
 * FILE OBJECTIVE:
 * - Validate SubjectReadinessCard rendering for score state, prediction/retake chips,
 *   and chapter-level readiness breakdown.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/dashboard/SubjectReadinessCard.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T15:20:00Z | copilot | add readiness card tests for normalized score,
 *                          diagnostic/prediction labels, and chapter mastery rows
 */

import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { SubjectReadinessCard } from '@/components/student/dashboard/SubjectReadinessCard'

describe('SubjectReadinessCard', () => {
  it('renders normalized score and readiness status', () => {
    render(
      <SubjectReadinessCard
        subjectId="math"
        subjectName="Mathematics"
        score={0.78}
        diagnosticDone
      />,
    )

    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('78%')).toBeInTheDocument()
    expect(screen.getByText('On track')).toBeInTheDocument()
    expect(screen.getByText('Diagnostic complete')).toBeInTheDocument()
  })

  it('renders predicted range and retake badge when provided', () => {
    render(
      <SubjectReadinessCard
        subjectId="science"
        subjectName="Science"
        score={64}
        diagnosticDone={false}
        predictedRange={{ low: 66, high: 74, confidenceLevel: 95 }}
        retakeEligibleAt="2026-06-04T00:00:00.000Z"
      />,
    )

    expect(screen.getByText('Diagnostic pending')).toBeInTheDocument()
    expect(screen.getByText('Predicted board score:')).toBeInTheDocument()
    expect(screen.getByText('66-74')).toBeInTheDocument()
    expect(screen.getByText('(95% CI)')).toBeInTheDocument()
    expect(screen.getByText(/Retake opens/i)).toBeInTheDocument()
  })

  it('renders chapter mastery rows', () => {
    render(
      <SubjectReadinessCard
        subjectId="english"
        subjectName="English"
        score={52}
        chapters={[
          {
            chapterId: 'c1',
            chapterName: 'Grammar',
            masteryScore: 0.33,
            boardWeightPct: 20,
            contribution: 6.6,
            status: 'critical',
          },
          {
            chapterId: 'c2',
            chapterName: 'Comprehension',
            masteryScore: 0.72,
            boardWeightPct: 30,
            contribution: 21.6,
            status: 'on_track',
          },
        ]}
      />,
    )

    expect(screen.getByText('Chapter mastery')).toBeInTheDocument()
    expect(screen.getByText('Grammar')).toBeInTheDocument()
    expect(screen.getByText('Comprehension')).toBeInTheDocument()
    expect(screen.getByText('33%')).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
  })
})
