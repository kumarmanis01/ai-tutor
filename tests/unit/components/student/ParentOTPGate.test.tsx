/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Validate ParentOTPGate channel selection behavior and channel-aware OTP verification request payloads.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/ParentOTPGate.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add unit tests for email/whatsapp channel selection and verification submission
 * - 2026-05-11T00:10:00Z | copilot | add WhatsApp-only auto-selection verification test
 */

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ParentOTPGate from '@/components/student/ParentOTPGate'

const refreshMock = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

describe('ParentOTPGate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('submits selected verification channel with OTP', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sent: true,
          sentTo: { email: 'parent@example.com', whatsapp: '9000000000' },
          verification: {
            accountVerified: false,
            email: { configured: true, verified: false, masked: 'p***t@example.com' },
            whatsapp: { configured: true, verified: false, masked: '+** *****0000' },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          verified: true,
          verification: {
            accountVerified: true,
            email: { configured: true, verified: false, masked: 'p***t@example.com' },
            whatsapp: { configured: true, verified: true, masked: '+** *****0000' },
          },
        }),
      })

    ;(global as any).fetch = fetchMock

    render(<ParentOTPGate maskedEmail="p***t@example.com" />)

    fireEvent.click(screen.getByRole('button', { name: /send otp to parent/i }))

    await waitFor(() => {
      expect(screen.getByText('Select verification channel')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /whatsapp/i }))

    const digitInputs = screen.getAllByRole('textbox')
    const otpDigits = ['1', '2', '3', '4', '5', '6']
    otpDigits.forEach((digit, index) => {
      fireEvent.change(digitInputs[index], { target: { value: digit } })
    })

    fireEvent.click(screen.getByRole('button', { name: /verify via whatsapp/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/student/verify-parent/confirm-otp',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ otp: '123456', channel: 'whatsapp' }),
        }),
      )
    })

    expect(refreshMock).toHaveBeenCalled()
  })

  it('auto-selects WhatsApp when email channel is unavailable', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sent: true,
          sentTo: { whatsapp: '9000000000' },
          verification: {
            accountVerified: false,
            email: { configured: false, verified: false, masked: null },
            whatsapp: { configured: true, verified: false, masked: '+** *****0000' },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          verified: true,
          verification: {
            accountVerified: true,
            email: { configured: false, verified: false, masked: null },
            whatsapp: { configured: true, verified: true, masked: '+** *****0000' },
          },
        }),
      })

    ;(global as any).fetch = fetchMock

    render(<ParentOTPGate maskedEmail="p***t@example.com" />)

    fireEvent.click(screen.getByRole('button', { name: /send otp to parent/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /verify via whatsapp/i })).toBeTruthy()
    })

    const digitInputs = screen.getAllByRole('textbox')
    const otpDigits = ['6', '5', '4', '3', '2', '1']
    otpDigits.forEach((digit, index) => {
      fireEvent.change(digitInputs[index], { target: { value: digit } })
    })

    fireEvent.click(screen.getByRole('button', { name: /verify via whatsapp/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/student/verify-parent/confirm-otp',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ otp: '654321', channel: 'whatsapp' }),
        }),
      )
    })

    expect(refreshMock).toHaveBeenCalled()
  })
})
