/**
 * FILE OBJECTIVE:
 * - Validate FocusAreaCard visual content and CTA rendering.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/dashboard/FocusAreaCard.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T15:45:00Z | copilot | add tests for focus area stats, status tone,
 *                          and study CTA link
 */

import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { FocusAreaCard } from '@/components/student/dashboard/FocusAreaCard'

describe('FocusAreaCard', () => {
  it('renders focus area chapter and key stats', () => {
    render(
      <FocusAreaCard
        subjectId="math"
        subjectName="Mathematics"
        chapterId="ch-1"
        chapterName="Quadratic Equations"
        masteryPercent={32}
        status="critical"
        sessionsNeeded={3}
        estimatedMinutes={45}
        href="/student/progress/math?focusChapter=ch-1"
      />,
    )

    expect(screen.getByText('Focus Area')).toBeInTheDocument()
    expect(screen.getByText('Quadratic Equations')).toBeInTheDocument()
    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('32%')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('~45m')).toBeInTheDocument()
    expect(screen.getByText('Weak')).toBeInTheDocument()
  })

  it('renders CTA link to focus chapter destination', () => {
    render(
      <FocusAreaCard
        subjectId="science"
        subjectName="Science"
        chapterId="ch-7"
        chapterName="Chemical Reactions"
        masteryPercent={48}
        status="needs_work"
        sessionsNeeded={2}
        estimatedMinutes={30}
        href="/student/progress/science?focusChapter=ch-7"
      />,
    )

    const cta = screen.getByRole('link', { name: 'Study Focus Area' })
    expect(cta).toHaveAttribute('href', '/student/progress/science?focusChapter=ch-7')
  })
})
