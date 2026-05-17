import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SubjectChip, SubjectGlyph, subjectMeta } from '@/components/UI/design-system/SubjectChip';

describe('SubjectChip', () => {
  it.each([
    'mathematics', 'physics', 'chemistry', 'biology',
    'science', 'english', 'social', 'hindi',
  ] as const)(
    'renders subject %s',
    (id) => {
      render(<SubjectChip subjectId={id} />);
      const meta = subjectMeta(id);
      expect(screen.getByText(meta.short)).toBeInTheDocument();
    },
  );

  it('renders sm size without crash', () => {
    render(<SubjectChip subjectId="mathematics" size="sm" />);
    expect(screen.getByText('Math')).toBeInTheDocument();
  });
});

describe('SubjectGlyph', () => {
  it('renders without crash', () => {
    const { container } = render(<SubjectGlyph subjectId="mathematics" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders with custom size', () => {
    const { container } = render(<SubjectGlyph subjectId="physics" size={48} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('48px');
  });
});

describe('subjectMeta', () => {
  it('returns correct meta for mathematics', () => {
    const m = subjectMeta('mathematics');
    expect(m.name).toBe('Mathematics');
    expect(m.textClass).toContain('text-subject-mathematics');
    expect(m.bgClass).toContain('bg-subject-mathematics-bg');
  });

  it('returns correct meta for hindi', () => {
    const m = subjectMeta('hindi');
    expect(m.name).toBe('Hindi');
    expect(m.textClass).toContain('text-subject-hindi');
  });
});
