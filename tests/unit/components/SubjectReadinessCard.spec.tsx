/**
 * FILE OBJECTIVE:
 * - Unit tests for SubjectReadinessCard: loading state, error state,
 *   empty states, populated state, and predictedRange display (AC-04).
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/SubjectReadinessCard.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | fix stale assertions to match current component (no loading/error props, tier label not raw score, isParentView hides CTA)
 * - 2026-04-20T00:00:00Z | claude | created for F-STU-023 coverage confirmation
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { SubjectReadinessCard } from '@/components/student/dashboard/SubjectReadinessCard'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('SubjectReadinessCard', () => {
  it('should render subject name and readiness tier label when score is populated', () => {
    render(<SubjectReadinessCard subjectName="Mathematics" score={72} subjectId="sub-math" />)
    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    // Tier label, not numeric score (CLAUDE.md: never show numeric score)
    expect(screen.getByText('On track')).toBeInTheDocument()
  })

  it('should render "Critical" tier when score is below 40', () => {
    render(<SubjectReadinessCard subjectName="Science" score={20} subjectId="sub-sci" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('should show "Start diagnostic" CTA when diagnosticDone is false', () => {
    render(
      <SubjectReadinessCard subjectName="Science" score={0} subjectId="sub-sci" diagnosticDone={false} />
    )
    expect(screen.getByText('Start diagnostic')).toBeInTheDocument()
    expect(screen.getByText('Diagnostic pending')).toBeInTheDocument()
  })

  it('should show "Diagnostic complete" and hide "Start diagnostic" when diagnosticDone is true', () => {
    render(
      <SubjectReadinessCard subjectName="Science" score={0} subjectId="sub-sci" diagnosticDone />
    )
    expect(screen.getByText('Diagnostic complete')).toBeInTheDocument()
    expect(screen.queryByText('Start diagnostic')).not.toBeInTheDocument()
  })

  it('should hide "Start diagnostic" CTA when isParentView is true', () => {
    render(
      <SubjectReadinessCard
        subjectName="Science"
        score={0}
        subjectId="sub-sci"
        diagnosticDone={false}
        isParentView
      />
    )
    expect(screen.queryByText('Start diagnostic')).not.toBeInTheDocument()
    expect(screen.getByText('Diagnostic pending')).toBeInTheDocument()
  })

  it('should display predicted range with confidence interval when predictedRange is provided', () => {
    render(
      <SubjectReadinessCard
        subjectName="Physics"
        score={65}
        subjectId="sub-phy"
        predictedRange={{ low: 58, high: 72, confidenceLevel: 95 }}
      />
    )
    expect(screen.getByText(/58-72/)).toBeInTheDocument()
    expect(screen.getByText(/95% CI/)).toBeInTheDocument()
  })

  it('should not display predicted range section when predictedRange is absent', () => {
    render(<SubjectReadinessCard subjectName="Chemistry" score={80} subjectId="sub-che" />)
    expect(screen.queryByText(/% CI/)).not.toBeInTheDocument()
  })

  it('should show retake eligibility badge when retakeEligibleAt is provided', () => {
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    render(
      <SubjectReadinessCard
        subjectName="Biology"
        score={55}
        subjectId="sub-bio"
        retakeEligibleAt={futureDate}
      />
    )
    expect(screen.getByText(/Retake opens/i)).toBeInTheDocument()
  })
})
