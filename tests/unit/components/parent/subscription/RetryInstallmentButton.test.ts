import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import RetryInstallmentButton from '@/components/parent/subscription/RetryInstallmentButton'

const toastMock = jest.fn()

jest.mock('@/lib/toast', () => ({
  toast: (message: string) => toastMock(message),
}))

describe('RetryInstallmentButton', () => {
  beforeEach(() => {
    toastMock.mockReset()
    ;(global as any).fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    })
  })

  it('shows inline success banner and triggers toast when retry succeeds', async () => {
    render(React.createElement(RetryInstallmentButton, { installmentId: 'inst-1' }))

    fireEvent.click(screen.getByRole('button', { name: /retry now/i }))
    const actionButtons = screen.getAllByRole('button', { name: /retry now/i })
    fireEvent.click(actionButtons[actionButtons.length - 1])

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith('Retry request submitted. We will attempt to charge the installment shortly.')
    })

    expect(screen.getByText(/Retry request submitted/i)).toBeTruthy()
  })
})
