/**
 * FILE OBJECTIVE:
 * - Verify the shared question interaction shell renders consistent answer controls and result feedback.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/questions/QuestionInteractionShell.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | create unit coverage for the shared question interaction shell
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';
import { QuestionInteractionShell } from '../../../../components/questions/QuestionInteractionShell';

describe('QuestionInteractionShell', () => {
  it('renders MCQ choices and emits the selected key', () => {
    const onChange = jest.fn();

    render(
      <QuestionInteractionShell
        prompt="Which option is correct?"
        questionNumber={1}
        totalQuestions={3}
        difficulty="easy"
        value=""
        onChange={onChange}
        choices={[
          { key: 'a', label: 'First' },
          { key: 'b', label: 'Second' },
        ]}
      />,
    );

    fireEvent.click(screen.getByText('Second'));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.getByText('Question 1 of 3')).toBeTruthy();
  });

  it('renders text input mode when no choices are provided', () => {
    const onChange = jest.fn();

    render(
      <QuestionInteractionShell
        prompt="Explain your answer"
        questionNumber={2}
        totalQuestions={5}
        value=""
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Type your answer here...'), {
      target: { value: 'Because it works' },
    });

    expect(onChange).toHaveBeenCalledWith('Because it works');
  });

  it('shows graded feedback when result props are provided', () => {
    render(
      <QuestionInteractionShell
        prompt="What is 2 + 2?"
        questionNumber={1}
        totalQuestions={1}
        value="a"
        onChange={jest.fn()}
        choices={[{ key: 'a', label: '3' }, { key: 'b', label: '4' }]}
        disabled
        showResult
        isCorrect={false}
        submittedAnswerLabel="3"
        correctAnswerLabel="4"
        explanation="Addition combines two quantities."
      />,
    );

    expect(screen.getByText('Needs review')).toBeTruthy();
    expect(screen.getByText('You answered: 3')).toBeTruthy();
    expect(screen.getByText('Correct answer: 4')).toBeTruthy();
    expect(screen.getByText('Addition combines two quantities.')).toBeTruthy();
  });
});