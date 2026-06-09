/**
 * FILE OBJECTIVE:
 * - Unit tests for the ConceptSelector component: option ordering, summary display,
 *   skeleton loading state, and graceful empty-array fallback.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial tests for demand-pull generate flow (task S3)
 */

/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, jest } from '@jest/globals';
import { ConceptSelector } from '@/components/session/ConceptSelector';

const SAMPLE_CONCEPTS = [
  { id: '1', title: 'Balanced Diet', summary: 'A balanced diet contains all nutrients in correct proportions.' },
  { id: '2', title: 'Carbohydrates', summary: 'Carbohydrates are the primary source of energy for the body.' },
  { id: '3', title: 'Proteins', summary: 'Proteins help the body grow and repair tissues.' },
];

describe('ConceptSelector', () => {
  it('should render All concepts option first', () => {
    render(<ConceptSelector concepts={SAMPLE_CONCEPTS} value={null} onChange={() => {}} />);
    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');
    expect(options[0].textContent).toBe('All concepts (mixed)');
  });

  it('should list all supplied concepts after the mixed option', () => {
    render(<ConceptSelector concepts={SAMPLE_CONCEPTS} value={null} onChange={() => {}} />);
    expect(screen.getByRole('option', { name: 'Balanced Diet' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Carbohydrates' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Proteins' })).toBeInTheDocument();
  });

  it('should show concept summary when concept selected', () => {
    render(<ConceptSelector concepts={SAMPLE_CONCEPTS} value="Balanced Diet" onChange={() => {}} />);
    expect(screen.getByText('A balanced diet contains all nutrients in correct proportions.')).toBeInTheDocument();
  });

  it('should not show summary when value is null (mixed)', () => {
    render(<ConceptSelector concepts={SAMPLE_CONCEPTS} value={null} onChange={() => {}} />);
    expect(screen.queryByText('A balanced diet contains all nutrients in correct proportions.')).not.toBeInTheDocument();
  });

  it('should call onChange with null when All concepts selected', () => {
    const onChange = jest.fn();
    render(<ConceptSelector concepts={SAMPLE_CONCEPTS} value="Balanced Diet" onChange={onChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '__mixed__' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('should call onChange with title string when a specific concept selected', () => {
    const onChange = jest.fn();
    render(<ConceptSelector concepts={SAMPLE_CONCEPTS} value={null} onChange={onChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Carbohydrates' } });
    expect(onChange).toHaveBeenCalledWith('Carbohydrates');
  });

  it('should render skeleton when loading', () => {
    const { container } = render(
      <ConceptSelector concepts={SAMPLE_CONCEPTS} value={null} onChange={() => {}} loading={true} />,
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('should render nothing when concepts array is empty', () => {
    const { container } = render(<ConceptSelector concepts={[]} value={null} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
