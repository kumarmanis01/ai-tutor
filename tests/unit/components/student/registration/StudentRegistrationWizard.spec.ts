/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for StudentRegistrationWizard step transitions and key onboarding CTA content.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/registration/StudentRegistrationWizard.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created placeholder
 * - 2026-04-27T12:00:00Z | copilot | replace placeholder with core step navigation tests
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StudentRegistrationWizard from '@/components/student/registration/StudentRegistrationWizard';

describe('StudentRegistrationWizard', () => {
  it('renders role step initially with student and parent actions', () => {
    render(React.createElement(StudentRegistrationWizard));

    expect(screen.getByRole('button', { name: "I'm a Student" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "I'm a Parent" })).toBeInTheDocument();
  });

  it('moves to age gate when student action is selected', () => {
    render(React.createElement(StudentRegistrationWizard));

    fireEvent.click(screen.getByRole('button', { name: "I'm a Student" }));

    expect(screen.getByText('When were you born?')).toBeInTheDocument();
    expect(screen.getByLabelText('Day')).toBeInTheDocument();
    expect(screen.getByLabelText('Month')).toBeInTheDocument();
    expect(screen.getByLabelText('Year')).toBeInTheDocument();
  });
});
