/** @jest-environment jsdom */

/**
 * FILE OBJECTIVE:
 * - Unit tests for admin topbar status chips, including 403 auth-required mapping.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/AdminTopbar.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-01T00:00:00Z | copilot | add tests covering 403 status mapping for redis and worker chips
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AdminTopbar } from '@/components/admin/AdminTopbar';

describe('AdminTopbar status chips', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('shows auth required chips when redis and worker endpoints return 403', async () => {
    (global as any).fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/admin/content-engine/redis')) {
        return Promise.resolve({ status: 403, ok: false, json: async () => ({}) });
      }
      if (url.includes('/api/admin/system/worker-status')) {
        return Promise.resolve({ status: 403, ok: false, json: async () => ({}) });
      }
      return Promise.resolve({ status: 200, ok: true, json: async () => ({}) });
    });

    render(<AdminTopbar title="Admin" runningJobs={0} />);

    await waitFor(() => {
      expect(screen.getByText('Redis auth required')).toBeInTheDocument();
      expect(screen.getByText('Worker auth required')).toBeInTheDocument();
    });

    expect(screen.queryByText('Redis down')).not.toBeInTheDocument();
    expect(screen.queryByText('Worker down')).not.toBeInTheDocument();
  });

  it('shows down chips for non-403 failures', async () => {
    (global as any).fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/admin/content-engine/redis')) {
        return Promise.resolve({ status: 500, ok: false, json: async () => ({}) });
      }
      if (url.includes('/api/admin/system/worker-status')) {
        return Promise.resolve({ status: 500, ok: false, json: async () => ({}) });
      }
      return Promise.resolve({ status: 200, ok: true, json: async () => ({}) });
    });

    render(<AdminTopbar title="Admin" runningJobs={0} />);

    await waitFor(() => {
      expect(screen.getByText('Redis down')).toBeInTheDocument();
      expect(screen.getByText('Worker down')).toBeInTheDocument();
    });
  });
});
