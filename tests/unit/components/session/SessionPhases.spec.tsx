/**
 * FILE OBJECTIVE:
 * - Verify session phase components render resolved content and progress callbacks
 *   correctly so session tabs do not appear blank.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/session/SessionPhases.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | created tests for overview, explanation, practice, test, and homework phases
 * - 2026-05-07T00:30:00Z | copilot | aligned assertions with current phase implementations and interaction flows
 * - 2026-05-09T00:00:00Z | copilot | added regression coverage for practice instant feedback when correctAnswer is stored as option text
 * - 2026-05-09T00:00:00Z | copilot | remove temporary blank-correctAnswer suppression test after API flow fix
 * - 2026-05-11T13:30:00Z | copilot | add test coverage for "practice more" button in results screen
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SubmitActionResult } from '../../../../lib/session/sessionActions';
import { OverviewPhase } from '../../../../components/session/phases/OverviewPhase';
import { ExplanationPhase } from '../../../../components/session/phases/ExplanationPhase';
import { PracticePhase } from '../../../../components/session/phases/PracticePhase';
import { TestPhase } from '../../../../components/session/phases/TestPhase';
import { HomeworkPhase } from '../../../../components/session/phases/HomeworkPhase';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe('Session phase components', () => {
  beforeEach(() => {
    jest.useRealTimers();
    pushMock.mockReset();
  });

  it('renders overview data and objectives', () => {
    const onReady = jest.fn();

    render(
      <OverviewPhase
        onReadyToProceed={onReady}
        content={{
          type: 'overview',
          topicName: 'Introduction to Integers',
          subject: 'Mathematics',
          chapter: 'Integers',
          summary: 'Learn positive and negative numbers.',
          objectives: ['Identify integers', 'Compare integers'],
          upcomingPhases: ['Learn', 'Practice', 'Quick Test', 'Homework'],
        }}
      />,
    );

    expect(screen.getByText('Introduction to Integers')).toBeTruthy();
    expect(screen.getByText('Session steps')).toBeTruthy();
    expect(screen.getByText('Identify integers')).toBeTruthy();
    expect(
      screen.getByText('Pay attention to the example -- it will help during practice.')
    ).toBeTruthy();
    expect(screen.getByText('Practice')).toBeTruthy();
    expect(onReady).toHaveBeenCalledWith(true);
  });

  it('renders explanation sections from contentJson', () => {
    const onReady = jest.fn();

    render(
      <ExplanationPhase
        topicName="Introduction to Integers"
        onReadyToProceed={onReady}
        content={{
          type: 'explanation',
          noteId: 'note-1',
          title: 'Integers',
          contentJson: {
            summary: 'Integers include negative and positive whole numbers.',
            sections: [{ title: 'Key Point', body: 'Zero is an integer.' }],
          },
        }}
      />,
    );

    expect(screen.getByText('Integers include negative and positive whole numbers.')).toBeTruthy();
    expect(screen.getByText('Zero is an integer.')).toBeTruthy();
    expect(screen.getByText('Teacher Vidya')).toBeTruthy();
    expect(onReady).toHaveBeenCalledWith(true);
  });

  it('shows correct instant feedback when correctAnswer is option text and choice key is submitted', () => {
    jest.useFakeTimers();

    const onSubmit = jest
      .fn<(answers: { questionId: string; answer: string }[]) => Promise<SubmitActionResult | null>>()
      .mockResolvedValue(null);

    render(
      <PracticePhase
        topicName="Introduction to Integers"
        onReadyToProceed={jest.fn()}
        onSubmit={onSubmit}
        content={{
          type: 'practice',
          questions: [
            {
              id: 'q1',
              type: 'mcq',
              prompt: 'What is 2 + 2?',
              choices: ['4', '5'],
              difficulty: 'easy',
              correctAnswer: '4',
            },
            {
              id: 'q2',
              type: 'mcq',
              prompt: 'What is 1 + 1?',
              choices: ['2', '3'],
              difficulty: 'easy',
              correctAnswer: '2',
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByText('4'));

    expect(screen.getByText('Great job!')).toBeTruthy();
  });

  it('submits practice answers after final question and unlocks continuation', async () => {
    jest.useFakeTimers();

    const onReady = jest.fn();
    const onSubmit = jest
      .fn<(answers: { questionId: string; answer: string }[]) => Promise<SubmitActionResult | null>>()
      .mockResolvedValue({
      score: 2,
      percentage: 100,
      correctAnswers: 2,
      totalAnswers: 2,
      results: [],
    });

    render(
      <PracticePhase
        topicName="Introduction to Integers"
        onReadyToProceed={onReady}
        onSubmit={onSubmit}
        content={{
          type: 'practice',
          questions: [
            {
              id: 'q1',
              type: 'mcq',
              prompt: 'Which is an integer?',
              choices: ['-3', '1/2'],
              difficulty: 'easy',
              correctAnswer: 'a',
            },
            {
              id: 'q2',
              type: 'mcq',
              prompt: 'Is 0 an integer?',
              choices: ['Yes', 'No'],
              difficulty: 'easy',
              correctAnswer: 'a',
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByText('-3'));

    act(() => {
      jest.advanceTimersByTime(500);
    });

    fireEvent.click(screen.getByText('Yes'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith([
      { questionId: 'q1', answer: 'a' },
      { questionId: 'q2', answer: 'a' },
    ]);
    await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(true));
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('registers test submit handler and updates state when submitted', async () => {
    const onSubmit = jest
      .fn<(answers: { questionId: string; answer: string }[]) => Promise<SubmitActionResult | null>>()
      .mockResolvedValue({
      score: 1,
      percentage: 50,
      correctAnswers: 1,
      totalAnswers: 2,
      results: [],
    });
    const onRegister = jest.fn();
    const onState = jest.fn();

    render(
      <TestPhase
        topicName="Introduction to Integers"
        onSubmit={onSubmit}
        onReadyToProceed={jest.fn()}
        onRegisterTestSubmit={onRegister}
        onTestStateChange={onState}
        content={{
          type: 'test',
          testId: 't1',
          title: 'Quick Test',
          difficulty: 'medium',
          questions: [
            {
              id: 'tq1',
              type: 'mcq',
              question: 'Choose an integer',
              options: ['5', '2.5'],
              explanation: null,
            },
            {
              id: 'tq2',
              type: 'mcq',
              question: 'Choose a non-integer',
              options: ['-4', '1.2'],
              explanation: null,
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('1.2'));

    const submitHandler = onRegister.mock.calls[onRegister.mock.calls.length - 1]?.[0] as (() => Promise<void>) | null;
    expect(typeof submitHandler).toBe('function');

    await act(async () => {
      await submitHandler?.();
    });

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith([
      { questionId: 'tq1', answer: 'a' },
      { questionId: 'tq2', answer: 'b' },
    ]);
    await waitFor(() => {
      const finalCall = onState.mock.calls[onState.mock.calls.length - 1];
      expect(finalCall).toEqual([true, true]);
    });
    expect(screen.getByText('1 of 2 correct')).toBeTruthy();
  });

  it('shows practice more button in results for paid users', async () => {
    jest.useFakeTimers();

    const onSubmit = jest
      .fn<(answers: { questionId: string; answer: string }[]) => Promise<SubmitActionResult | null>>()
      .mockResolvedValue({
      score: 0.8,
      percentage: 80,
      correctAnswers: 4,
      totalAnswers: 5,
      results: [
        { questionId: 'q1', isCorrect: true, correctAnswer: 'a' },
        { questionId: 'q2', isCorrect: true, correctAnswer: 'b' },
      ],
    });
    const onPracticeMore = jest.fn();

    render(
      <PracticePhase
        topicName="Introduction to Integers"
        onReadyToProceed={jest.fn()}
        onSubmit={onSubmit}
        onPracticeMore={onPracticeMore}
        practiceMoreLoading={false}
        practiceMoreError={null}
        content={{
          type: 'practice',
          questions: [
            {
              id: 'q1',
              type: 'mcq',
              prompt: 'Which is an integer?',
              choices: ['-3', '1/2'],
              difficulty: 'easy',
              correctAnswer: 'a',
            },
            {
              id: 'q2',
              type: 'mcq',
              prompt: 'Is 0 an integer?',
              choices: ['Yes', 'No'],
              difficulty: 'easy',
              correctAnswer: 'a',
            },
          ],
        }}
      />,
    );

    // Complete the practice
    fireEvent.click(screen.getByText('-3'));
    act(() => {
      jest.advanceTimersByTime(500);
    });
    fireEvent.click(screen.getByText('Yes'));

    // Wait for results screen and find practice more button
    await waitFor(() => expect(screen.getByText('Practice more')).toBeTruthy());

    const practiceMoreButton = screen.getByText('Practice more');
    expect(practiceMoreButton).not.toHaveAttribute('disabled');
    expect(screen.getByText(/available once per day/i)).toBeTruthy();

    fireEvent.click(practiceMoreButton);
    expect(onPracticeMore).toHaveBeenCalled();
  });

  it('renders homework assignment details', () => {
    const onReady = jest.fn();

    render(
      <HomeworkPhase
        onReadyToProceed={onReady}
        content={{
          type: 'homework',
          assignmentId: 'hw-1',
          status: 'PENDING',
          dueDate: '2026-05-09T00:00:00.000Z',
          score: null,
          questions: [{ id: 'h1' }, { id: 'h2' }],
        }}
      />,
    );

    expect(screen.getByText('Homework assigned!')).toBeTruthy();
    expect(screen.getByText('2 questions')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    fireEvent.click(screen.getByText('Start Homework Now'));
    expect(pushMock).toHaveBeenCalledWith('/homework/hw-1');
    expect(onReady).toHaveBeenCalledWith(true);
  });
});
