import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DoubtsTab } from '@/app/(student)/dashboard/components/doubts/DoubtsTab';

// Mock fetch for /api/doubts calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('DoubtsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        questionId: 'q1',
        response: 'Great question!',
        followUpQuestions: ['Want to know more?', 'Can you try an example now?'],
      }),
    });
  });

  it('renders header with encouraging message', () => {
    render(<DoubtsTab />);

    expect(screen.getByText('Ask a Question')).toBeInTheDocument();
    expect(screen.getByText(/No question is too small/i)).toBeInTheDocument();
  });

  it('renders subject selection buttons', () => {
    render(<DoubtsTab />);

    expect(screen.getByText('Math')).toBeInTheDocument();
    expect(screen.getByText('Science')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Social Studies')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
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

    const mathButton = screen.getByText('Math');
    fireEvent.click(mathButton);

    expect(mathButton).toHaveClass('ring-2');
  });

  it('allows deselecting a subject by clicking again', () => {
    render(<DoubtsTab />);

    const mathButton = screen.getByText('Math');
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

  it('calls onAskQuestion callback and fetches /api/doubts on submit', async () => {
    const mockOnAskQuestion = jest.fn();
    render(<DoubtsTab onAskQuestion={mockOnAskQuestion} />);

    const textarea = screen.getByPlaceholderText(/Type your question here/i);
    fireEvent.change(textarea, { target: { value: 'What is 2+2?' } });

    const submitButton = screen.getByText('Ask My Tutor');
    fireEvent.click(submitButton);

    expect(mockOnAskQuestion).toHaveBeenCalledWith('What is 2+2?', undefined);
    expect(mockFetch).toHaveBeenCalledWith('/api/doubts', expect.objectContaining({ method: 'POST' }));
  });

  it('renders follow-up bubbles and submits a clicked follow-up question', async () => {
    render(<DoubtsTab />);

    const textarea = screen.getByPlaceholderText(/Type your question here/i);
    fireEvent.change(textarea, { target: { value: 'Explain fractions' } });
    fireEvent.click(screen.getByText('Ask My Tutor'));

    const followUpButton = await screen.findByRole('button', {
      name: 'Ask follow-up: Want to know more?',
    });

    fireEvent.click(followUpButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/doubts',
      expect.objectContaining({
        body: expect.stringContaining('Want to know more?'),
      }),
    );
  });

  it('includes selected subject when submitting', () => {
    const mockOnAskQuestion = jest.fn();
    render(<DoubtsTab onAskQuestion={mockOnAskQuestion} />);

    fireEvent.click(screen.getByText('Math'));

    const textarea = screen.getByPlaceholderText(/Type your question here/i);
    fireEvent.change(textarea, { target: { value: 'What is 2+2?' } });

    fireEvent.click(screen.getByText('Ask My Tutor'));

    expect(mockOnAskQuestion).toHaveBeenCalledWith('What is 2+2?', 'math');
  });

  it('disables submit button when textarea is empty', () => {
    render(<DoubtsTab />);

    const submitButton = screen.getByText('Ask My Tutor');
    expect(submitButton).toBeDisabled();
  });

  it('clears textarea after submission', () => {
    render(<DoubtsTab />);

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
