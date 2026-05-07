/**
 * FILE OBJECTIVE:
 * - Verify referral creation is user-triggered and never runs on component mount.
 * - Ensure copy and WhatsApp share actions fetch referral data explicitly on click.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/referral/ReferralShareCard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | created tests for explicit click-driven referral API calls
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ReferralShareCard from '@/components/student/referral/ReferralShareCard'

describe('ReferralShareCard', () => {
  const mockFetch = jest.fn()
  const mockClipboardWrite = jest.fn()
  const mockWindowOpen = jest.fn()

  beforeEach(() => {
    mockFetch.mockReset()
    mockClipboardWrite.mockReset()
    mockWindowOpen.mockReset()

    global.fetch = mockFetch as unknown as typeof fetch

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: mockClipboardWrite,
      },
    })

    Object.defineProperty(window, 'open', {
      configurable: true,
      value: mockWindowOpen,
    })
  })

  it('should not call referral API on mount', () => {
    render(<ReferralShareCard />)

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should create referral only when copy is clicked', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'ABCD1234', url: 'https://example.com/auth/signup?ref=ABCD1234' }),
    })
    mockClipboardWrite.mockResolvedValue(undefined)

    render(<ReferralShareCard />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy invite link to clipboard' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/referral/create', { method: 'POST' })
    })

    await waitFor(() => {
      expect(mockClipboardWrite).toHaveBeenCalled()
    })
  })

  it('should create referral only when whatsapp share is clicked', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'ABCD1234', url: 'https://example.com/auth/signup?ref=ABCD1234' }),
    })

    render(<ReferralShareCard />)

    fireEvent.click(screen.getByRole('button', { name: 'Share invite link on WhatsApp' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/referral/create', { method: 'POST' })
    })

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalled()
    })
  })
})
