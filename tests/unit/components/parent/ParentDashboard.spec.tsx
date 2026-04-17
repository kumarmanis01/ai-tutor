/**
 * FILE OBJECTIVE:
 * - Unit tests for `ParentDashboard` timezone display logic.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/parent/ParentDashboard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | assistant | add timezone display unit tests
 */

import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

import ParentDashboard from '@/components/parent/ParentDashboard'

describe('ParentDashboard timezone display', () => {
  const baseChild = {
    studentId: 's1',
    name: 'Test Student',
    grade: '8',
    board: 'CBSE',
    streak: 3,
    sessionsThisWeek: 2,
    readiness: [],
    timezone: null,
  }

  it('shows single timezone when parent and student timezone are the same', () => {
    const child = { ...baseChild, timezone: 'Asia/Kolkata' }
    render(<ParentDashboard parentTimezone="Asia/Kolkata">{[child]}</ParentDashboard>)

    expect(screen.getByText(/Times shown:/)).toHaveTextContent('Times shown: Asia/Kolkata')
    expect(screen.queryByText(/Student:/)).toBeNull()
  })

  it('shows both timezones when parent and student timezone differ', () => {
    const child = { ...baseChild, timezone: 'Asia/Kolkata' }
    render(<ParentDashboard parentTimezone="America\/New_York">{[child]}</ParentDashboard>)

    expect(screen.getByText(/Times shown:/)).toHaveTextContent('Times shown: America/New_York • Student: Asia/Kolkata')
  })

  it('falls back to student timezone when parent timezone is missing', () => {
    const child = { ...baseChild, timezone: 'Asia/Kolkata' }
    render(<ParentDashboard parentTimezone={null}>{[child]}</ParentDashboard>)

    expect(screen.getByText(/Times shown:/)).toHaveTextContent('Times shown: Student: Asia/Kolkata')
  })

  it('falls back to your timezone when no timezone info present', () => {
    const child = { ...baseChild, timezone: null }
    render(<ParentDashboard parentTimezone={null}>{[child]}</ParentDashboard>)

    expect(screen.getByText(/Times shown:/)).toHaveTextContent('Times shown: your timezone')
  })
})
