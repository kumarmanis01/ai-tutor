/**
 * @jest-environment jsdom
 *
 * FILE OBJECTIVE:
 * - Unit tests for StudyBuddyGreeting component (S2.1 top-bar avatar).
 *   Covers import/export contract, open/close toggle on click, greeting popover
 *   content, and click-outside dismissal behaviour.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/learning-map/StudyBuddyGreeting.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | claude | created with jsdom RTL tests for open/close + click-outside
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudyBuddyGreeting } from '@/components/student/learning-map/StudyBuddyGreeting';

describe('StudyBuddyGreeting module', () => {
  it('should import without throwing', () => {
    expect(() => require('@/components/student/learning-map/StudyBuddyGreeting')).not.toThrow();
  });

  it('should export default and named export', () => {
    const mod = require('@/components/student/learning-map/StudyBuddyGreeting');
    expect(typeof mod.default).toBe('function');
    expect(typeof mod.StudyBuddyGreeting).toBe('function');
  });
});

describe('StudyBuddyGreeting behaviour', () => {
  const defaultProps = { xp: 120, streak: 3, avatarName: 'Vidya' };

  it('should render the trigger button with correct aria-label', () => {
    render(<StudyBuddyGreeting {...defaultProps} />);
    expect(screen.getByRole('button', { name: /vidya study buddy/i })).toBeInTheDocument();
  });

  it('should show XP and streak in trigger button', () => {
    render(<StudyBuddyGreeting {...defaultProps} />);
    expect(screen.getByText(/120 XP/)).toBeInTheDocument();
    expect(screen.getByText(/3-day streak/)).toBeInTheDocument();
  });

  it('should show "Start your streak today!" when streak is 0', () => {
    render(<StudyBuddyGreeting xp={0} streak={0} />);
    expect(screen.getByText(/Start your streak today!/)).toBeInTheDocument();
  });

  it('should not show greeting popover before the button is clicked', () => {
    render(<StudyBuddyGreeting {...defaultProps} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should open the greeting popover when the button is clicked', () => {
    render(<StudyBuddyGreeting {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /vidya study buddy/i }));
    expect(screen.getByRole('dialog', { name: /Study Buddy greeting/i })).toBeInTheDocument();
  });

  it('should display avatar name inside the popover', () => {
    render(<StudyBuddyGreeting {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /vidya study buddy/i }));
    expect(screen.getByText('Vidya says:')).toBeInTheDocument();
  });

  it(`should close the popover when the "Let's go!" button is clicked`, () => {
    render(<StudyBuddyGreeting {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /vidya study buddy/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /let.*s go/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should close the popover when clicking outside the widget', () => {
    render(
      <div>
        <StudyBuddyGreeting {...defaultProps} />
        <div data-testid="outside">outside</div>
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /vidya study buddy/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should toggle closed when the trigger is clicked while open', () => {
    render(<StudyBuddyGreeting {...defaultProps} />);
    const trigger = screen.getByRole('button', { name: /vidya study buddy/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
