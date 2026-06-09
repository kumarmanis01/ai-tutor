import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ParentUpgradeFlow from '@/components/parent/subscription/ParentUpgradeFlow'

beforeAll(() => {
  // Mock IntersectionObserver used by PaymentConfirmation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(global as any).IntersectionObserver = class {
    constructor() {}
    observe() {}
    disconnect() {}
    unobserve() {}
  }
})

describe('ParentUpgradeFlow', () => {
  it('navigates select → plan → method → confirm and shows order summary', () => {
    const childrenList = [
      { studentId: 'c1', name: 'Rohan', grade: '10', board: 'CBSE' },
    ]

    render(<ParentUpgradeFlow childrenList={childrenList} />)

    // initial: child visible
    expect(screen.getByText(/Rohan/)).toBeInTheDocument()

    // select step -> continue to plan
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    // plan step shows family pricing label and Choose payment button
    expect(screen.getByText(/Use family pricing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Choose payment/i })).toBeInTheDocument()

    // move to payment method step
    fireEvent.click(screen.getByRole('button', { name: /Choose payment/i }))
    expect(screen.getByRole('button', { name: /UPI/i })).toBeInTheDocument()

    // proceed to confirm
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    // confirm step shows order summary and a disabled confirm button (terms not scrolled)
    expect(screen.getByText(/Order summary/i)).toBeInTheDocument()
    const confirmBtn = screen.getByRole('button', { name: /Confirm & pay/i })
    expect(confirmBtn).toBeInTheDocument()
    expect(confirmBtn).toBeDisabled()
  })
})
