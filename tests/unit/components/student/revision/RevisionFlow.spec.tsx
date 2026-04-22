/** @jest-environment jsdom */

import React from 'react'
import { render, screen } from '@testing-library/react'
import RevisionFlow from '@/components/student/revision/RevisionFlow'

const SAMPLE_CARDS = [
  {
    conceptId: 'c1',
    conceptName: 'Addition basics',
    subjectName: 'Math',
    questionId: 'q1',
    prompt: 'What is 2 + 2?',
    choices: ['3', '4', '5'],
    correctAnswer: '1',
  },
]

describe('RevisionFlow', () => {
  test('renders the flow and shows header', () => {
    render(<RevisionFlow cards={SAMPLE_CARDS} totalDue={1} />)
    expect(screen.getByText(/Revision cards/i)).toBeTruthy()
  })
})
