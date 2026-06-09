/**
 * FILE OBJECTIVE:
 * - Unit tests for GenerateControls: default count, stepper boundary disabling,
 *   difficulty initialisation from recommendation, onGenerate payload, and
 *   Generating... disabled state.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial tests for demand-pull generate flow (task S3)
 */

/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GenerateControls } from '@/components/session/GenerateControls';
import type { GenerateParams } from '@/components/session/GenerateControls';

const SAMPLE_CONCEPTS = [
  { id: '1', title: 'Balanced Diet', summary: 'A balanced diet contains all nutrients.' },
];

const RECOMMENDATION = { toughness: 6, label: 'Challenge', reason: 'Push harder' };

const BASE_PROPS = {
  concepts: SAMPLE_CONCEPTS,
  contentType: 'examples' as const,
  topicSlug: 'food-and-nutrition',
  subject: 'science',
  grade: '6',
  board: 'CBSE',
  recommendation: RECOMMENDATION,
  onGenerate: jest.fn(),
  isGenerating: false,
};

describe('GenerateControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should default count to 5', () => {
    render(<GenerateControls {...BASE_PROPS} />);
    expect(screen.getByText('Generate 5 Examples')).toBeInTheDocument();
  });

  it('should disable minus button at count 1', () => {
    render(<GenerateControls {...BASE_PROPS} />);
    const minus = screen.getByRole('button', { name: 'Decrease count' });
    for (let i = 0; i < 4; i++) fireEvent.click(minus);
    expect(minus).toBeDisabled();
  });

  it('should disable plus button at count 10', () => {
    render(<GenerateControls {...BASE_PROPS} />);
    const plus = screen.getByRole('button', { name: 'Increase count' });
    for (let i = 0; i < 5; i++) fireEvent.click(plus);
    expect(plus).toBeDisabled();
  });

  it('should default difficulty to recommendation toughness', () => {
    render(<GenerateControls {...BASE_PROPS} />);
    expect(screen.getByText('Difficulty: 6')).toBeInTheDocument();
  });

  it('should call onGenerate with correct params', () => {
    const onGenerate = jest.fn<(p: GenerateParams) => void>();
    render(<GenerateControls {...BASE_PROPS} onGenerate={onGenerate} />);
    fireEvent.click(screen.getByText('Generate 5 Examples'));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const [params] = (onGenerate as jest.MockedFunction<typeof onGenerate>).mock.calls[0];
    expect(params.topicSlug).toBe('food-and-nutrition');
    expect(params.subject).toBe('science');
    expect(params.grade).toBe('6');
    expect(params.board).toBe('CBSE');
    expect(params.contentType).toBe('examples');
    expect(params.count).toBe(5);
    expect(params.difficulty).toBe(6);
    expect(params.conceptTitle).toBeNull();
  });

  it('should show Generating... when isGenerating', () => {
    render(<GenerateControls {...BASE_PROPS} isGenerating={true} />);
    expect(screen.getByText('Generating...')).toBeInTheDocument();
    expect(screen.getByText('Generating...')).toBeDisabled();
  });

  it('should disable stepper buttons when generating', () => {
    render(<GenerateControls {...BASE_PROPS} isGenerating={true} />);
    expect(screen.getByRole('button', { name: 'Decrease count' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase count' })).toBeDisabled();
  });
});
