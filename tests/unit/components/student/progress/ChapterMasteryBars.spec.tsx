/**
 * @jest-environment jsdom
 */

/**
 * FILE OBJECTIVE:
 * - Unit tests for the chapter mastery list on the student progress page,
 *   including estimated-weight labelling and empty-state rendering.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/progress/ChapterMasteryBars.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-10T00:00:00Z | copilot | added coverage for estimated weight badge and empty state
 */

import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import ChapterMasteryBars from '@/components/student/progress/ChapterMasteryBars'

describe('ChapterMasteryBars', () => {
  it('renders the empty state when there are no subject rows', () => {
    render(<ChapterMasteryBars subjects={[]} />)

    expect(screen.getByText('Chapter mastery')).toBeInTheDocument()
    expect(screen.getByText(/No chapter data yet/i)).toBeInTheDocument()
  })

  it('shows an estimated label when equal-weight fallback was used', () => {
    render(
      <ChapterMasteryBars
        subjects={[
          {
            subjectId: 'sub-1',
            subjectName: 'Mathematics',
            chapters: [
              {
                chapterId: 'ch-1',
                chapterName: 'Algebra',
                masteryScore: 0.82,
                boardWeightPct: 8.3,
                weightSource: 'estimated',
                weakestConceptId: 'concept-1',
                memoryStrength: 0.4,
              },
            ],
          },
        ]}
      />,
    )

    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('est.')).toBeInTheDocument()
    expect(screen.getByText('8%')).toBeInTheDocument()
  })

  it('renders board-weight rows without the estimated badge', () => {
    render(
      <ChapterMasteryBars
        subjects={[
          {
            subjectId: 'sub-2',
            subjectName: 'Science',
            chapters: [
              {
                chapterId: 'ch-2',
                chapterName: 'Atoms',
                masteryScore: 0.1,
                boardWeightPct: 40,
                weightSource: 'board',
                weakestConceptId: null,
                memoryStrength: 0.2,
              },
            ],
          },
        ]}
      />,
    )

    expect(screen.getByText('Science')).toBeInTheDocument()
    expect(screen.queryByText('est.')).toBeNull()
  })
})
