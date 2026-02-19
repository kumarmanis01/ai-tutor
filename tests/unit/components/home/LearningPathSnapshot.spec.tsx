import React from 'react';
import { render, screen } from '@testing-library/react';
import LearningPathSnapshot from '@/components/home/LearningPathSnapshot';

describe('LearningPathSnapshot', () => {
  it('renders at most 4 subjects', () => {
    const subjects = Array.from({ length: 6 }).map((_, i) => ({
      subjectId: `s${i}`,
      name: `Subject ${i}`,
      percentComplete: i * 10,
      mastery: i % 3 === 0 ? 'weak' : i % 3 === 1 ? 'improving' : 'strong',
    }));

    render(<LearningPathSnapshot subjects={subjects as any} />);

    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(4);
  });
});
