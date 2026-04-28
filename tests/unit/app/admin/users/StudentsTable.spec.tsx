/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for admin StudentsTable status filter options and behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/users/StudentsTable.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T13:45:00Z | copilot | add test for deterministic pending consent filter value
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StudentsTable, type StudentRowData } from '@/app/admin/users/StudentsTable';

const rows: StudentRowData[] = [
  {
    id: 's-1',
    name: 'Pending Student',
    email: 'pending@example.com',
    grade: '6',
    board: 'cbse',
    age: 11,
    isAdult: false,
    accountStatus: 'pending_parent_verification',
    subscriptionStatus: 'free',
    totalXp: 0,
    level: 1,
    lastSessionDate: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 's-2',
    name: 'Active Student',
    email: 'active@example.com',
    grade: '8',
    board: 'icse',
    age: 14,
    isAdult: false,
    accountStatus: 'active',
    subscriptionStatus: 'free',
    totalXp: 100,
    level: 2,
    lastSessionDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

describe('StudentsTable status filter', () => {
  it('filters deterministically for awaiting parent consent option', () => {
    render(<StudentsTable students={rows} />);

    const select = screen.getByDisplayValue('All statuses') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'awaiting-parent-consent' } });

    expect(screen.getByText('Pending Student')).toBeInTheDocument();
    expect(screen.queryByText('Active Student')).not.toBeInTheDocument();
  });
});
