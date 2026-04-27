/**
 * FILE OBJECTIVE:
 * - Unit tests for the `CrunchModeToggle` component.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/CrunchModeToggle.spec.tsx
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | add basic render + update test
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('@/hooks/useCurrentUser', () => ({
  __esModule: true,
  default: () => ({ data: { preferences: { crunchMode: 'auto' } }, mutate: jest.fn() }),
}))

import CrunchModeToggle from '@/components/student/dashboard/CrunchModeToggle'

describe('CrunchModeToggle component', () => {
  beforeEach(() => {
    // @ts-expect-error TODO: fix types
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  })

  it('renders and calls update API when mode changes', async () => {
    render(<CrunchModeToggle />)

    const select = screen.getByLabelText('Crunch mode') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'on' } })

    await waitFor(() => {
      // @ts-expect-error TODO: fix types
      expect(global.fetch).toHaveBeenCalled()
    })
  })
})
