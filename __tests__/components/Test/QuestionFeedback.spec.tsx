/**
 * FILE OBJECTIVE:
 * - Unit tests for QuestionFeedback component.
 *
 * LINKED UNIT TEST:
 * - (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created for MVP instant feedback
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import QuestionFeedback, { QuestionFeedbackProps } from '@/components/Test/QuestionFeedback';

describe('QuestionFeedback', () => {
  const defaultProps: QuestionFeedbackProps = {
    questionNumber: 1,
    questionText: 'What is 2 + 2?',
    userAnswer: '4',
    correctAnswer: '4',
    isCorrect: true,
  };

  it('renders question number and text', () => {
    render(<QuestionFeedback {...defaultProps} />);
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
  });

  it('shows correct status when answer is correct', () => {
    render(<QuestionFeedback {...defaultProps} />);
    expect(screen.getByText('Correct!')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows incorrect status when answer is wrong', () => {
    render(
      <QuestionFeedback
        {...defaultProps}
        userAnswer="3"
        isCorrect={false}
      />
    );
    expect(screen.getByText('Incorrect')).toBeInTheDocument();
    expect(screen.getByText('✗')).toBeInTheDocument();
  });

  it('shows partial status when answer is partially correct', () => {
    render(
      <QuestionFeedback
        {...defaultProps}
        isCorrect={false}
        isPartial={true}
      />
    );
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByText('◐')).toBeInTheDocument();
  });

  it('displays user answer', () => {
    render(<QuestionFeedback {...defaultProps} userAnswer="4" />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('displays correct answer when incorrect', () => {
    render(
      <QuestionFeedback
        {...defaultProps}
        userAnswer="3"
        correctAnswer="4"
        isCorrect={false}
      />
    );
    expect(screen.getByText('Correct answer:')).toBeInTheDocument();
  });

  it('does not show correct answer when already correct', () => {
    render(<QuestionFeedback {...defaultProps} isCorrect={true} />);
    expect(screen.queryByText('Correct answer:')).not.toBeInTheDocument();
  });

  it('displays explanation when provided', () => {
    render(
      <QuestionFeedback
        {...defaultProps}
        explanation="Addition of two even numbers results in an even number."
      />
    );
    expect(screen.getByText('Explanation')).toBeInTheDocument();
    expect(
      screen.getByText('Addition of two even numbers results in an even number.')
    ).toBeInTheDocument();
  });

  it('does not show explanation section when not provided', () => {
    render(<QuestionFeedback {...defaultProps} />);
    expect(screen.queryByText('Explanation')).not.toBeInTheDocument();
  });

  it('handles no answer gracefully', () => {
    render(<QuestionFeedback {...defaultProps} userAnswer={undefined} />);
    expect(screen.getByText('(no answer)')).toBeInTheDocument();
  });

  it('formats MCQ choices correctly', () => {
    render(
      <QuestionFeedback
        {...defaultProps}
        type="mcq"
        correctAnswer="B"
        isCorrect={false}
        userAnswer="A"
        choices={[
          { key: 'A', label: 'Option A' },
          { key: 'B', label: 'Option B' },
        ]}
      />
    );
    expect(screen.getByText(/B: Option B/)).toBeInTheDocument();
  });
});
