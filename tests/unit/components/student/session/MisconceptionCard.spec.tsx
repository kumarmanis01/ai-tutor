import React from 'react'
import { render, screen } from '@testing-library/react'
import MisconceptionCard from '@/components/student/session/MisconceptionCard'

describe('MisconceptionCard', () => {
  it('renders artifact fields', () => {
    const art = {
      misconceptionId: 'M-1',
      name: 'Sample conf',
      description: 'A common error',
      correction: 'Correct principle',
      whyWrong: 'Because of X',
      applyTip: 'Do Y',
      suggestedPractice: 'Try Z',
    }
    render(<MisconceptionCard artifact={art as any} />)
    expect(screen.getByText(/Common misconception/)).toBeInTheDocument()
    expect(screen.getByText(/Sample conf/)).toBeInTheDocument()
    expect(screen.getByText(/Correct principle/)).toBeInTheDocument()
    expect(screen.getByText(/Try Z/)).toBeInTheDocument()
  })
})
