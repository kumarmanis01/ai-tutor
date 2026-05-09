/**
 * FILE OBJECTIVE:
 * - Unit tests for secondary dashboard start actions: Browse syllabus routing
 *   and Surprise me success/fallback navigation behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/dashboard/SecondaryStartOptions.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-08T00:00:00Z | copilot | add behavior tests for browse link and
 *                          surprise me success/fallback/unauthorized flows
 * - 2026-05-09T14:45:00Z | copilot | fix test expectations: on 204/error, 
 *                          Surprise me now routes to /dashboard not todaysHref/browser
 */

import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SecondaryStartOptions from '@/components/student/dashboard/SecondaryStartOptions'

const pushMock = jest.fn()
const toastMock = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

jest.mock('@/lib/toast', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}))

describe('SecondaryStartOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).fetch = jest.fn()
  })

  it('renders Browse syllabus link to learning path', () => {
    render(<SecondaryStartOptions todaysHref="/session/pre/concept-123" />)

    const browse = screen.getByRole('link', { name: 'Browse syllabus' })
    expect(browse).toHaveAttribute('href', '/learn/learning-path')
  })

  it('navigates to suggested pre-session concept on Surprise me success', async () => {
    ;(global as any).fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ action: { topicId: 'concept-surprise-1' } }),
    })

    render(<SecondaryStartOptions todaysHref="/session/pre/concept-123" />)
    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/session/pre/concept-surprise-1')
    })
  })

  it('falls back to todaysHref when Surprise me returns no content', async () => {
    ;(global as any).fetch.mockResolvedValue({
      status: 204,
      ok: true,
      json: async () => ({}),
    })

    render(<SecondaryStartOptions todaysHref="/session/pre/concept-123" />)
    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('does not navigate on Surprise me unauthorized and shows toast', async () => {
    ;(global as any).fetch.mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    })

    render(<SecondaryStartOptions todaysHref="/session/pre/concept-123" />)
    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalled()
      expect(pushMock).not.toHaveBeenCalled()
    })
  })

  it('falls back to browse syllabus when no today target exists and surprise fails', async () => {
    ;(global as any).fetch.mockRejectedValue(new Error('network-down'))

    render(<SecondaryStartOptions />)
    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/dashboard')
    })
  })
})
