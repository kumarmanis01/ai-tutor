/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  LessonSkeleton,
  CardSkeleton,
  ListSkeleton,
  QuestionSkeleton,
} from '@/components/UI/loaders/SkeletonLoaders';

describe('LessonSkeleton', () => {
  it('should render without crash', () => {
    render(<LessonSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should include sr-only loading text', () => {
    render(<LessonSkeleton />);
    expect(screen.getByText('Loading lesson content...')).toBeInTheDocument();
  });
});

describe('CardSkeleton', () => {
  it('should render without crash', () => {
    render(<CardSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should include sr-only loading text', () => {
    render(<CardSkeleton />);
    expect(screen.getByText('Loading card content...')).toBeInTheDocument();
  });
});

describe('ListSkeleton', () => {
  it('should render default 4 items', () => {
    const { container } = render(<ListSkeleton />);
    expect(container.querySelectorAll('li').length).toBe(4);
  });

  it('should render custom item count', () => {
    const { container } = render(<ListSkeleton count={3} />);
    expect(container.querySelectorAll('li').length).toBe(3);
  });

  it('should render without crash', () => {
    render(<ListSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should include sr-only loading text', () => {
    render(<ListSkeleton />);
    expect(screen.getByText('Loading list...')).toBeInTheDocument();
  });
});

describe('QuestionSkeleton', () => {
  it('should render without crash', () => {
    render(<QuestionSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should include sr-only loading text', () => {
    render(<QuestionSkeleton />);
    expect(screen.getByText('Loading question...')).toBeInTheDocument();
  });

  it('should render 4 option row placeholders', () => {
    const { container } = render(<QuestionSkeleton />);
    const optionRows = container.querySelectorAll('.flex.items-center.gap-3');
    expect(optionRows.length).toBe(4);
  });
});
