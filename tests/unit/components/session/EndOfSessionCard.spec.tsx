/**
 * FILE OBJECTIVE:
 * - Unit tests for EndOfSessionCard pricing display behavior and plan-data guardrail.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/session/EndOfSessionCard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T10:30:00Z | copilot | added coverage for standard monthly plan display and throw-on-missing-plan behavior
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import EndOfSessionCard from '@/components/session/EndOfSessionCard';
import { PLANS } from '@/lib/billing/plans';

const MISSING_PLAN_DISPLAY_ERROR = 'Missing billing plan display for standard_monthly';

describe('EndOfSessionCard', () => {
  const originalStandardDisplay = PLANS.standard_monthly.perMonthDisplay;

  beforeEach(() => {
    (global as typeof globalThis & { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockImplementation((url: RequestInfo | URL) => {
        const value = String(url);
        if (value.includes('/api/student/freemium/status')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                sessionsRemaining: 0,
                sessionsUsed: 3,
                periodStart: '2026-01-01T00:00:00Z',
              }),
          });
        }

        if (value.includes('/api/home/next-action')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ action: {} }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      }) as unknown as typeof fetch;

    PLANS.standard_monthly.perMonthDisplay = originalStandardDisplay;
  });

  afterEach(() => {
    PLANS.standard_monthly.perMonthDisplay = originalStandardDisplay;
    jest.resetAllMocks();
  });

  it('shows the standard monthly plan display from billing plans', async () => {
    render(<EndOfSessionCard topicName="Linear Equations" subject="Math" />);

    await waitFor(() => {
      expect(screen.getByText(new RegExp(`View plans -- ${PLANS.standard_monthly.perMonthDisplay}`))).toBeTruthy();
    });
  });

  it('throws when standard monthly plan display is missing', () => {
    PLANS.standard_monthly.perMonthDisplay = '';

    expect(() => {
      render(<EndOfSessionCard topicName="Linear Equations" subject="Math" />);
    }).toThrow(MISSING_PLAN_DISPLAY_ERROR);
  });
});
