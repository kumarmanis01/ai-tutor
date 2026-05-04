/**
 * @jest-environment jsdom
 */

/**
 * FILE OBJECTIVE:
 * - Unit tests for ParentProgressDetail: benchmarking opt-in toggle (F-PAR-011 AC-04),
 *   peer percentile display, and basic render coverage.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/parent/ParentProgressDetail.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-05-04T00:00:00Z | copilot | created -- F-PAR-011 AC-04 benchmarking unit tests
 */

import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock SubjectReadinessCard to avoid importing its heavy deps in unit tests
jest.mock('@/components/student/dashboard/SubjectReadinessCard', () => ({
  __esModule: true,
  default: ({ subjectName }: { subjectName: string }) => (
    <div data-testid="readiness-card">{subjectName}</div>
  ),
}))

// Mock ActivityHeatmap
jest.mock('@/components/parent/ActivityHeatmap', () => ({
  __esModule: true,
  default: () => <div data-testid="activity-heatmap" />,
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

import ParentProgressDetail from '@/components/parent/ParentProgressDetail'

const baseProps = {
  studentName: 'Riya Sharma',
  grade: '9',
  board: 'CBSE',
  sessions: [],
  readiness: [
    { subjectId: 'sub1', subjectName: 'Maths', score: 72, peerPercentile: 65 },
    { subjectId: 'sub2', subjectName: 'Science', score: 55, peerPercentile: null },
  ],
  heatmapDays: [],
}

beforeEach(() => {
  localStorageMock.clear()
})

describe('ParentProgressDetail benchmarking opt-in (F-PAR-011 AC-04)', () => {
  it('does not show peer percentile copy before opting in', () => {
    render(<ParentProgressDetail {...baseProps} />)

    // Benchmarking copy should be absent
    expect(screen.queryByText(/mastery is above/)).toBeNull()
  })

  it('shows the benchmarking toggle button', () => {
    render(<ParentProgressDetail {...baseProps} />)

    const btn = screen.getByRole('button', { name: /benchmarking|comparison/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows peer percentile copy after opting in when peerPercentile is available', () => {
    render(<ParentProgressDetail {...baseProps} />)

    const btn = screen.getByRole('button', { name: /benchmarking|comparison/i })
    fireEvent.click(btn)

    // Maths has peerPercentile=65, so benchmarking copy should include 65
    expect(screen.getByText(/65%/)).toBeInTheDocument()
  })

  it('does not show benchmarking copy for subjects where peerPercentile is null', () => {
    render(<ParentProgressDetail {...baseProps} />)

    const btn = screen.getByRole('button', { name: /benchmarking|comparison/i })
    fireEvent.click(btn)

    // Science has peerPercentile=null, only one percentile line should appear (for Maths)
    const matches = screen.getAllByText(/mastery is above/)
    expect(matches).toHaveLength(1)
  })

  it('persists benchmarking opt-in to localStorage', () => {
    render(<ParentProgressDetail {...baseProps} />)

    const btn = screen.getByRole('button', { name: /benchmarking|comparison/i })
    fireEvent.click(btn)

    expect(localStorageMock.getItem('parent_benchmarking_optin')).toBe('1')
  })

  it('reads persisted benchmarking opt-in from localStorage on mount', async () => {
    localStorageMock.setItem('parent_benchmarking_optin', '1')
    render(<ParentProgressDetail {...baseProps} />)

    // After mount the opt-in should be active and percentile shown
    // Use findBy to wait for the useEffect to fire
    const percentile = await screen.findByText(/65%/)
    expect(percentile).toBeInTheDocument()
  })
})

describe('ParentProgressDetail render', () => {
  it('renders student name and grade/board subtitle', () => {
    render(<ParentProgressDetail {...baseProps} />)

    expect(screen.getByText('Riya Sharma')).toBeInTheDocument()
    expect(screen.getByText('9 · CBSE')).toBeInTheDocument()
  })

  it('renders a readiness card per subject', () => {
    render(<ParentProgressDetail {...baseProps} />)

    const cards = screen.getAllByTestId('readiness-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveTextContent('Maths')
    expect(cards[1]).toHaveTextContent('Science')
  })

  it('renders back link to parent dashboard', () => {
    render(<ParentProgressDetail {...baseProps} />)

    expect(screen.getByText(/← My children/)).toBeInTheDocument()
  })
})
