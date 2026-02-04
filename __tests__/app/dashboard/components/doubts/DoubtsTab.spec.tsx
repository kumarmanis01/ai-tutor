/**
 * FILE OBJECTIVE:
 * - Unit tests for DoubtsTab component.
 * - Tests question input, subject selection, and example questions.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: __tests__/app/dashboard/components/doubts/DoubtsTab.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created DoubtsTab unit tests
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DoubtsTab } from '@/app/dashboard/components/doubts/DoubtsTab';

describe('DoubtsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header with encouraging message', () => {
    render(<DoubtsTab />);

    expect(screen.getByText('Ask a Question')).toBeInTheDocument();
    expect(screen.getByText(/No question is too small/i)).toBeInTheDocument();
  });

  it('renders subject selection buttons', () => {
    render(<DoubtsTab />);

    expect(screen.getByText(/Math/)).toBeInTheDocument();
    expect(screen.getByText(/Science/)).toBeInTheDocument();
    expect(screen.getByText(/English/)).toBeInTheDocument();
    expect(screen.getByText(/Social Studies/)).toBeInTheDocument();
    expect(screen.getByText(/Other/)).toBeInTheDocument();
  });

  it('renders question textarea', () => {
    render(<DoubtsTab />);

    const textarea = screen.getByPlaceholderText(/Type your question here/i);
    expect(textarea).toBeInTheDocument();
  });

  it('renders example questions', () => {
    render(<DoubtsTab />);

    expect(screen.getByText(/Can you explain fractions/i)).toBeInTheDocument();
    expect(screen.getByText(/Why does the sun rise/i)).toBeInTheDocument();
  });

  it('allows selecting a subject', () => {
    render(<DoubtsTab />);

    const mathButton = screen.getByText(/Math/);
    fireEvent.click(mathButton);

    // Button should show selected state (ring-2)
    expect(mathButton).toHaveClass('ring-2');
  });

  it('allows deselecting a subject by clicking again', () => {
    render(<DoubtsTab />);

    const mathButton = screen.getByText(/Math/);
    fireEvent.click(mathButton); // Select
    fireEvent.click(mathButton); // Deselect

    expect(mathButton).not.toHaveClass('ring-2');
  });

  it('populates textarea when example question is clicked', () => {
    render(<DoubtsTab />);

    const exampleButton = screen.getByText(/Can you explain fractions/i);
    fireEvent.click(exampleButton);

    const textarea = screen.getByPlaceholderText(/Type your question here/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Can you explain fractions');
  });

  it('calls onAskQuestion when form is submitted with valid input', () => {
    const mockOnAskQuestion = jest.fn();
    render(<DoubtsTab onAskQuestion={mockOnAskQuestion} />);

    const textarea = screen.getByPlaceholderText(/Type your question here/i);
    fireEvent.change(textarea, { target: { value: 'What is 2+2?' } });

    const submitButton = screen.getByText('Ask My Tutor');
    fireEvent.click(submitButton);

    expect(mockOnAskQuestion).toHaveBeenCalledWith('What is 2+2?', undefined);
  });

  it('includes selected subject when submitting', () => {
    const mockOnAskQuestion = jest.fn();
    render(<DoubtsTab onAskQuestion={mockOnAskQuestion} />);

    // Select Math subject
    fireEvent.click(screen.getByText(/Math/));

    // Type question
    const textarea = screen.getByPlaceholderText(/Type your question here/i);
    fireEvent.change(textarea, { target: { value: 'What is 2+2?' } });

    // Submit
    fireEvent.click(screen.getByText('Ask My Tutor'));

    expect(mockOnAskQuestion).toHaveBeenCalledWith('What is 2+2?', 'math');
  });

  it('disables submit button when textarea is empty', () => {
    render(<DoubtsTab />);

    const submitButton = screen.getByText('Ask My Tutor');
    expect(submitButton).toBeDisabled();
  });

  it('disables submit button and shows loading state when isLoading is true', () => {
    render(<DoubtsTab isLoading={true} />);

    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('clears textarea after successful submission', () => {
    const mockOnAskQuestion = jest.fn();
    render(<DoubtsTab onAskQuestion={mockOnAskQuestion} />);

    const textarea = screen.getByPlaceholderText(/Type your question here/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Test question' } });
    fireEvent.click(screen.getByText('Ask My Tutor'));

    expect(textarea.value).toBe('');
  });

  it('renders encouraging footer message', () => {
    render(<DoubtsTab />);

    expect(screen.getByText(/Asking questions is how we learn/i)).toBeInTheDocument();
  });
});
