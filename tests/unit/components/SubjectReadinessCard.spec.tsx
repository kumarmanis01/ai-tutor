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
  it('should render without crash when score is populated', () => {
    render(<SubjectReadinessCard subjectName="Mathematics" score={72} subjectId="sub-math" />)
    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('72')).toBeInTheDocument()
  })

  it('should render skeleton and no subject name in loading state', () => {
    const { container } = render(
      <SubjectReadinessCard subjectName="Mathematics" score={0} subjectId="sub-math" loading />
    )
    expect(screen.queryByText('Mathematics')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })

  it("should render error message in error state", () => {
    render(<SubjectReadinessCard subjectName="Mathematics" score={0} subjectId="sub-math" error />)
    expect(screen.getByText(/couldn't load readiness/i)).toBeInTheDocument()
  })

  it('should render Start Diagnostic CTA when score=0 and diagnosticDone=false', () => {
    render(
      <SubjectReadinessCard subjectName="Science" score={0} subjectId="sub-sci" diagnosticDone={false} />
    )
    expect(screen.getByText(/Take diagnostic/i)).toBeInTheDocument()
    expect(screen.getByText(/Start Diagnostic/i)).toBeInTheDocument()
  })

  it('should render preparing message when score=0 and diagnosticDone=true', () => {
    render(
      <SubjectReadinessCard subjectName="Science" score={0} subjectId="sub-sci" diagnosticDone />
    )
    expect(screen.getByText(/being calculated/i)).toBeInTheDocument()
  })

  it('should display predicted range with confidence interval when predictedRange is provided', () => {
    render(
      <SubjectReadinessCard
        subjectName="Physics"
        score={65}
        subjectId="sub-phy"
        predictedRange={{ low: 58, high: 72, confidenceLevel: 95, daysUsed: 30 }}
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
