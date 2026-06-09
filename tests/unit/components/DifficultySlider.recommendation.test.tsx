/**
 * FILE OBJECTIVE:
 * - Unit tests for the DifficultySlider recommendation badge feature:
 *   badge visibility, initial value, and dim-on-drag behaviour.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | S2-3a: initial creation
 */

/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DifficultySlider from '@/components/dashboard/components/DifficultySlider';

const REC = { toughness: 3, label: 'Easy', reason: 'Start here -- build confidence first' };

describe('DifficultySlider recommendation badge', () => {
  it('should render AI recommends badge when recommendation prop provided', () => {
    render(<DifficultySlider value={3} onChange={() => {}} recommendation={REC} />);
    expect(screen.getByTestId('recommendation-badge')).toBeInTheDocument();
    expect(screen.getByText(/AI recommends/)).toBeInTheDocument();
    expect(screen.getByText(/toughness 3/)).toBeInTheDocument();
  });

  it('should not render badge when recommendation prop absent', () => {
    render(<DifficultySlider value={5} onChange={() => {}} />);
    expect(screen.queryByTestId('recommendation-badge')).not.toBeInTheDocument();
  });

  it('should set initial value to recommended toughness when no value prop given', () => {
    render(<DifficultySlider onChange={() => {}} recommendation={REC} />);
    // Chip shows the effective value derived from recommendation.toughness
    expect(screen.getByText('Difficulty: 3')).toBeInTheDocument();
  });

  it('should show full opacity badge when slider is at recommended toughness', () => {
    render(<DifficultySlider value={3} onChange={() => {}} recommendation={REC} />);
    const badge = screen.getByTestId('recommendation-badge');
    expect(badge.className).toContain('opacity-100');
    expect(badge.className).not.toContain('opacity-50');
  });

  it('should dim badge when slider moved away from recommendation', () => {
    const onChange = jest.fn();
    render(<DifficultySlider value={7} onChange={onChange} recommendation={REC} />);
    const badge = screen.getByTestId('recommendation-badge');
    // value 7 != recommendation.toughness 3 -- badge should be dimmed
    expect(badge.className).toContain('opacity-50');
  });

  it('should render the reason text below the badge', () => {
    render(<DifficultySlider value={3} onChange={() => {}} recommendation={REC} />);
    expect(screen.getByText(REC.reason)).toBeInTheDocument();
  });
});
