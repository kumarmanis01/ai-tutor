/**
 * @jest-environment jsdom
 */

/**
 * FILE OBJECTIVE:
 * - Unit tests for `ParentDashboard`: timezone display, horizontal tabs (AC-03),
 *   and exam countdown (AC-02).
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/parent/ParentDashboard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | assistant | add timezone display unit tests
 * - 2026-05-04T00:00:00Z | copilot | add horizontal tab (AC-03) and exam countdown (AC-02) tests
 */

import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'

import ParentDashboard from '@/components/parent/ParentDashboard'

const baseChild = {
  studentId: 's1',
  name: 'Test Student',
  grade: '8',
  board: 'CBSE',
  streak: 3,
  sessionsThisWeek: 2,
  readiness: [],
  timezone: null,
  examDate: null,
}

describe('ParentDashboard timezone display', () => {
  it('shows single timezone when parent and student timezone are the same', () => {
    const child = { ...baseChild, timezone: 'Asia/Kolkata' }
    render(<ParentDashboard parentTimezone="Asia/Kolkata" childrenData={[child]} />)

    expect(screen.getByText(/Times shown:/)).toHaveTextContent('Times shown: Asia/Kolkata')
    expect(screen.queryByText(/Student:/)).toBeNull()
  })

  it('shows both timezones when parent and student timezone differ', () => {
    const child = { ...baseChild, timezone: 'Asia/Kolkata' }
    render(<ParentDashboard parentTimezone="America/New_York" childrenData={[child]} />)

    expect(screen.getByText(/Times shown:/)).toHaveTextContent('Times shown: America/New_York • Student: Asia/Kolkata')
  })

  it('falls back to student timezone when parent timezone is missing', () => {
    const child = { ...baseChild, timezone: 'Asia/Kolkata' }
    render(<ParentDashboard parentTimezone={null} childrenData={[child]} />)

    expect(screen.getByText(/Times shown:/)).toHaveTextContent('Times shown: Student: Asia/Kolkata')
  })

  it('falls back to your timezone when no timezone info present', () => {
    render(<ParentDashboard parentTimezone={null} childrenData={[{ ...baseChild, timezone: null }]} />)

    expect(screen.getByText(/Times shown:/)).toHaveTextContent('Times shown: your timezone')
  })
})

describe('ParentDashboard exam countdown (F-PAR-010 AC-02)', () => {
  it('shows days to exam when examDate is in the future', () => {
    const future = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
    const child = { ...baseChild, examDate: future }
    render(<ParentDashboard parentTimezone={null} childrenData={[child]} />)

    expect(screen.getByText('Days to exam')).toBeInTheDocument()
    expect(screen.getByText(/\d+d/)).toBeInTheDocument()
  })

  it('does not show exam countdown when examDate is null', () => {
    render(<ParentDashboard parentTimezone={null} childrenData={[{ ...baseChild, examDate: null }]} />)

    expect(screen.queryByText('Days to exam')).toBeNull()
  })

  it('does not show exam countdown when examDate is in the past', () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const child = { ...baseChild, examDate: past }
    render(<ParentDashboard parentTimezone={null} childrenData={[child]} />)

    expect(screen.queryByText('Days to exam')).toBeNull()
  })
})

describe('ParentDashboard horizontal tabs (F-PAR-010 AC-03)', () => {
  const childA = { ...baseChild, studentId: 's1', name: 'Alice' }
  const childB = { ...baseChild, studentId: 's2', name: 'Bob' }

  it('does not render tab strip when only one child is linked', () => {
    render(<ParentDashboard parentTimezone={null} childrenData={[childA]} />)

    // No tab nav for single child
    expect(screen.queryByRole('navigation', { name: /children/i })).toBeNull()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders a tab for each child when multiple children are linked', () => {
    render(<ParentDashboard parentTimezone={null} childrenData={[childA, childB]} />)

    expect(screen.getByRole('navigation', { name: /children/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alice' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bob' })).toBeInTheDocument()
  })

  it('shows the first child by default and switches to the second on tab click', () => {
    render(<ParentDashboard parentTimezone={null} childrenData={[childA, childB]} />)

    // First child is active by default
    expect(screen.getByRole('button', { name: 'Alice' })).toHaveAttribute('aria-current', 'page')

    // Click Bob's tab
    fireEvent.click(screen.getByRole('button', { name: 'Bob' }))

    expect(screen.getByRole('button', { name: 'Bob' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Alice' })).not.toHaveAttribute('aria-current')
  })
})

describe('ParentDashboard empty state', () => {
  it('renders link-a-child CTA when no children are linked', () => {
    render(<ParentDashboard parentTimezone={null} childrenData={[]} />)

    expect(screen.getByText('No children linked yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Link a child' })).toBeInTheDocument()
  })
})

