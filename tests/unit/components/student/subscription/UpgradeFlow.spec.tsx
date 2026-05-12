/**
 * FILE OBJECTIVE:
 * - Verify the student upgrade gate shows the planned subscription benefits instead of free-tier usage counters.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/subscription/UpgradeFlow.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | add gate-step coverage for upgrade benefit copy
 */

import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { UpgradeFlow } from '@/components/student/subscription/UpgradeFlow'

describe('UpgradeFlow', () => {
  it('shows upgrade benefits on the gate step and hides usage counters', () => {
    render(
      <UpgradeFlow
        studentName="Aarav"
        studentEmail="aarav@example.com"
        freeTierUsage={{
          sessionsUsed: 4,
          sessionsRemaining: 1,
          periodStart: '2026-05-01T00:00:00.000Z',
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: /Please upgrade to continue learning/i })).toBeInTheDocument()
    expect(screen.getByText('Unlimited questions')).toBeInTheDocument()
    expect(screen.getByText('Unlimited practice sets')).toBeInTheDocument()
    expect(screen.getByText('Detailed AI explanations')).toBeInTheDocument()
    expect(screen.getByText('CBSE/ICSE Grades 1-12')).toBeInTheDocument()
    expect(screen.getByText('Progress tracking')).toBeInTheDocument()
    expect(screen.getByText('Priority processing')).toBeInTheDocument()
    expect(screen.queryByText(/used/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/left/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/resets/i)).not.toBeInTheDocument()
  })

  it('still advances to the plan step from the gate', () => {
    render(<UpgradeFlow />)

    fireEvent.click(screen.getByRole('button', { name: /See plans/i }))

    expect(screen.getByText(/Choose your plan/i)).toBeInTheDocument()
  })
})
