/**
 * FILE OBJECTIVE:
 * - Verifies the doubts tab emits canonical analytics for successful and failed ask flows.
 * - Covers both the thumbs-up and thumbs-down best-effort tracking branches.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(student)/dashboard/components/doubts/DoubtsTab.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | created doubts analytics coverage
 */

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import analyticsClient from '@/lib/analytics/client'
import { DoubtsTab } from '@/app/(student)/dashboard/components/doubts/DoubtsTab'

jest.mock('@/components/UI/ContentModal', () => ({
  __esModule: true,
  default: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div data-testid="content-modal">{children}</div> : null),
}))

jest.mock('@/components/student/subscription/UpgradeFlow', () => ({
  UpgradeFlow: () => <div data-testid="upgrade-flow" />,
}))

jest.mock('@/lib/analytics/client', () => ({
  __esModule: true,
  default: {
    trackEvent: jest.fn(),
  },
}))

const trackEventMock = jest.mocked(analyticsClient.trackEvent)

describe('DoubtsTab analytics', () => {
  beforeEach(() => {
    trackEventMock.mockReset()
    global.fetch = jest.fn()
  })

  it('should emit thumbs-up analytics after a successful ask flow', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        questionId: 'question-1',
        response: 'Here is the answer.',
        followUpQuestions: ['Why?'],
      }),
    })

    render(<DoubtsTab />)

    fireEvent.change(screen.getByLabelText('Type your question'), { target: { value: 'What is a fraction?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask My Tutor' }))

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'student.doubts.thumbsup' }),
      )
    })
  })

  it('should emit thumbs-down analytics when the ask request fails', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({ error: 'something_else' }),
    })

    render(<DoubtsTab />)

    fireEvent.change(screen.getByLabelText('Type your question'), { target: { value: 'Why is the sky blue?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask My Tutor' }))

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'student.doubts.thumbsdown' }),
      )
    })
  })
})
