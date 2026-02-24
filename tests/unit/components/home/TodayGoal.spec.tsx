import React from 'react';
import { render, screen } from '@testing-library/react';
import TodayGoal from '@/components/home/TodayGoal';

describe('TodayGoal', () => {
  it('calculates and renders progress bar width correctly', () => {
    render(<TodayGoal targetMinutes={60} completedMinutes={30} streakDays={3} />);

    const bar = screen.getByRole('progressbar');
    // inner filled element is first child
    const filled = bar.querySelector('div');
    expect(filled).toBeTruthy();
    expect((filled as HTMLElement).style.width).toBe('50%');
  });
});
