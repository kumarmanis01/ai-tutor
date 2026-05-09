/**
 * FILE OBJECTIVE:
 * - Verify XP widget source breakdown rendering, filtering, and fallback labels.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/dashboard/XPWidget.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T15:00:00Z | copilot | add unit coverage for XP source breakdown rows,
 *                          zero filtering, and unknown source label formatting
 */

import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { XPWidget } from '@/components/student/dashboard/XPWidget'

describe('XPWidget', () => {
  it('renders source-wise XP rows with known labels', () => {
    render(
      <XPWidget
        totalXp={320}
        level={4}
        xpThisWeek={95}
        xpBySource={{
          session_correct: 40,
          streak_bonus: 20,
          revision_complete: 15,
          session_complete: 20,
        }}
      />,
    )

    expect(screen.getByText("This week's XP breakdown")).toBeInTheDocument()
    expect(screen.getByText('Correct answers')).toBeInTheDocument()
    expect(screen.getByText('Session completion')).toBeInTheDocument()
    expect(screen.getByText('Streak bonus')).toBeInTheDocument()
    expect(screen.getByText('Revision cards')).toBeInTheDocument()
    expect(screen.getByText('+40')).toBeInTheDocument()
    expect(screen.getAllByText('+20')).toHaveLength(2)
    expect(screen.getByText('+15')).toBeInTheDocument()
  })

  it('does not render zero-value sources', () => {
    render(
      <XPWidget
        totalXp={200}
        level={3}
        xpThisWeek={10}
        xpBySource={{
          session_correct: 10,
          streak_bonus: 0,
          revision_complete: 0,
        }}
      />,
    )

    expect(screen.getByText('Correct answers')).toBeInTheDocument()
    expect(screen.queryByText('Streak bonus')).not.toBeInTheDocument()
    expect(screen.queryByText('Revision cards')).not.toBeInTheDocument()
  })

  it('renders readable fallback label for unknown source keys', () => {
    render(
      <XPWidget
        totalXp={180}
        level={2}
        xpThisWeek={12}
        xpBySource={{
          custom_bonus_event: 12,
        }}
      />,
    )

    expect(screen.getByText('Custom Bonus Event')).toBeInTheDocument()
    expect(screen.getByText('+12')).toBeInTheDocument()
  })
})
