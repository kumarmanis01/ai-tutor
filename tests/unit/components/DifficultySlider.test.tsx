/**
 * FILE OBJECTIVE:
 * - Unit tests for DifficultySlider component: default state, band labels,
 *   onChange emission, and collapsed-by-default behaviour.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial creation for difficulty parameter feature
 */

/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DifficultySlider from '@/components/dashboard/components/DifficultySlider';

describe('DifficultySlider', () => {
  it('should render at default level 5', () => {
    render(<DifficultySlider onChange={() => {}} />);
    expect(screen.getByText('Difficulty: 5')).toBeInTheDocument();
  });

  it('should show Easier label for level 1-3', () => {
    render(<DifficultySlider value={2} onChange={() => {}} />);
    // Open the panel first
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    // The pill shows "Level 2 -- Easier" (exact text in the component)
    expect(screen.getByText('Level 2 -- Easier')).toBeInTheDocument();
  });

  it('should show Challenge label for level 7-10', () => {
    render(<DifficultySlider value={8} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('Level 8 -- Challenge')).toBeInTheDocument();
  });

  it('should call onChange with integer value when slider moves', () => {
    const onChange = jest.fn();
    render(<DifficultySlider value={5} onChange={onChange} />);
    // Expand
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith(7);
    expect(typeof onChange.mock.calls[0][0]).toBe('number');
  });

  it('should be collapsed by default (slider not visible)', () => {
    render(<DifficultySlider value={5} onChange={() => {}} />);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
});
