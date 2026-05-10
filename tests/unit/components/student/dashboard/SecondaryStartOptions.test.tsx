/**
 * FILE OBJECTIVE:
 * - Unit tests for secondary dashboard start actions: Browse syllabus routing
 *   and Surprise me success/fallback navigation behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/dashboard/SecondaryStartOptions.test.tsx
 *
 * EDIT LOG:
 * - 2026-05-08T00:00:00Z | copilot | add behavior tests for browse link and
 *                          surprise me success/fallback/unauthorized flows
 * - 2026-05-09T14:45:00Z | copilot | fix test expectations: on 204/error,
 *                          Surprise me now routes to /dashboard not todaysHref/browser
 * - 2026-05-10T00:00:00Z | staff-engineer | update to todaysTopics array prop;
 *                          add multi-subject rendering test
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
    render(<SecondaryStartOptions todaysTopics={[{ subject: 'Mathematics', href: '/session/pre/concept-123' }]} />)

    const browse = screen.getByRole('link', { name: 'Browse syllabus' })
    expect(browse).toHaveAttribute('href', '/learn/learning-path')
  })

  it('renders single Today\'s topic link when one subject provided', () => {
    render(<SecondaryStartOptions todaysTopics={[{ subject: 'Mathematics', href: '/session/pre/concept-123' }]} />)

    const link = screen.getByRole('link', { name: "Today's topic" })
    expect(link).toHaveAttribute('href', '/session/pre/concept-123')
  })

  it('renders per-subject links when multiple subjects provided', () => {
    render(
      <SecondaryStartOptions
        todaysTopics={[
          { subject: 'Mathematics', href: '/session/pre/concept-math' },
          { subject: 'Physics', href: '/session/pre/concept-physics' },
        ]}
      />,
    )

    const mathLink = screen.getByRole('link', { name: 'Mathematics' })
    expect(mathLink).toHaveAttribute('href', '/session/pre/concept-math')

    const physicsLink = screen.getByRole('link', { name: 'Physics' })
    expect(physicsLink).toHaveAttribute('href', '/session/pre/concept-physics')
  })

  it('renders clickable Today\'s topic falling back to learning path when no topics provided', () => {
    render(<SecondaryStartOptions todaysTopics={[]} />)

    const link = screen.getByRole('link', { name: "Today's topic" })
    expect(link).toHaveAttribute('href', '/learn/learning-path')
  })

  it('navigates to suggested pre-session concept on Surprise me success', async () => {
    ;(global as any).fetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ action: { topicId: 'concept-surprise-1' } }),
    })

    render(<SecondaryStartOptions todaysTopics={[{ subject: 'Mathematics', href: '/session/pre/concept-123' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/session/pre/concept-surprise-1')
    })
  })

  it('navigates to learning path when Surprise me returns no content (204)', async () => {
    ;(global as any).fetch.mockResolvedValue({
      status: 204,
      ok: true,
      json: async () => ({}),
    })

    render(<SecondaryStartOptions todaysTopics={[{ subject: 'Mathematics', href: '/session/pre/concept-123' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/learn/learning-path')
    })
  })

  it('does not navigate on Surprise me unauthorized and shows toast', async () => {
    ;(global as any).fetch.mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    })

    render(<SecondaryStartOptions todaysTopics={[{ subject: 'Mathematics', href: '/session/pre/concept-123' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalled()
      expect(pushMock).not.toHaveBeenCalled()
    })
  })

  it('navigates to learning path when no topics provided and Surprise me fails', async () => {
    ;(global as any).fetch.mockRejectedValue(new Error('network-down'))

    render(<SecondaryStartOptions />)
    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/learn/learning-path')
    })
  })
})
