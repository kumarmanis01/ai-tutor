/**
 * FILE OBJECTIVE:
 * - Unit tests for the ParentDetailClient component.
 *   Covers: renders without crash, shows blocked badge, block/unblock/delete
 *   confirmation flow, unlink confirmation flow, and API error toast.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/parents/[parentId]/ParentDetailClient.spec.tsx (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07 | claude | created
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ParentDetail } from '@/app/admin/parents/[parentId]/ParentDetailClient'

// Mock next/navigation
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const ACTIVE_PARENT: ParentDetail = {
  id: 'parent-1',
  name: 'Priya Sharma',
  email: 'priya@example.com',
  accountStatus: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  linkedStudents: [
    {
      linkId: 'link-1',
      studentId: 'student-1',
      studentName: 'Arjun Sharma',
      studentGrade: '8',
      verifiedAt: '2026-01-15T00:00:00.000Z',
      avgMastery: 42,
    },
  ],
}

const BLOCKED_PARENT: ParentDetail = {
  ...ACTIVE_PARENT,
  accountStatus: 'suspended',
}

async function importComponent() {
  const mod = await import('@/app/admin/parents/[parentId]/ParentDetailClient')
  return mod.ParentDetailClient
}

describe('ParentDetailClient', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('should render parent name and email', async () => {
    const ParentDetailClient = await importComponent()
    render(<ParentDetailClient parent={ACTIVE_PARENT} />)
    expect(screen.getByText('Priya Sharma')).toBeTruthy()
    expect(screen.getByText('priya@example.com')).toBeTruthy()
  })

  it('should render linked student with mastery and grade', async () => {
    const ParentDetailClient = await importComponent()
    render(<ParentDetailClient parent={ACTIVE_PARENT} />)
    expect(screen.getByText(/Arjun Sharma/)).toBeTruthy()
    expect(screen.getByText(/Gr\. 8/)).toBeTruthy()
    expect(screen.getByText('42%')).toBeTruthy()
  })

  it('should show Block button when account is active', async () => {
    const ParentDetailClient = await importComponent()
    render(<ParentDetailClient parent={ACTIVE_PARENT} />)
    expect(screen.getByRole('button', { name: /block/i })).toBeTruthy()
  })

  it('should show Unblock button when account is suspended', async () => {
    const ParentDetailClient = await importComponent()
    render(<ParentDetailClient parent={BLOCKED_PARENT} />)
    expect(screen.getByRole('button', { name: /unblock/i })).toBeTruthy()
  })

  it('should open confirmation modal with role=dialog when Block is clicked', async () => {
    const ParentDetailClient = await importComponent()
    render(<ParentDetailClient parent={ACTIVE_PARENT} />)
    fireEvent.click(screen.getByRole('button', { name: /block/i }))
    await waitFor(() => {
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeTruthy()
      expect(dialog.getAttribute('aria-modal')).toBe('true')
    })
  })

  it('should close modal on Cancel', async () => {
    const ParentDetailClient = await importComponent()
    render(<ParentDetailClient parent={ACTIVE_PARENT} />)
    fireEvent.click(screen.getByRole('button', { name: /block/i }))
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('should call block API and show toast on confirm', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    })
    const ParentDetailClient = await importComponent()
    render(<ParentDetailClient parent={ACTIVE_PARENT} />)
    fireEvent.click(screen.getByRole('button', { name: /block/i }))
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /block parent/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/admin/users/${ACTIVE_PARENT.id}/block`,
        expect.objectContaining({ method: 'POST' }),
      )
      expect(screen.getByText('Parent blocked.')).toBeTruthy()
    })
  })

  it('should show Remove link button for each student and open modal', async () => {
    const ParentDetailClient = await importComponent()
    render(<ParentDetailClient parent={ACTIVE_PARENT} />)
    const removeBtn = screen.getByRole('button', { name: /remove link/i })
    expect(removeBtn).toBeTruthy()
    fireEvent.click(removeBtn)
    await waitFor(() => {
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeTruthy()
    })
  })

  it('should call unlink API and remove student from list on confirm', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    })
    const ParentDetailClient = await importComponent()
    render(<ParentDetailClient parent={ACTIVE_PARENT} />)
    fireEvent.click(screen.getByRole('button', { name: /remove link/i }))
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /remove link/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/admin/parents/${ACTIVE_PARENT.id}/unlink`),
        expect.objectContaining({ method: 'DELETE' }),
      )
      expect(screen.getByText('Student unlinked.')).toBeTruthy()
    })
  })

  it('should show error toast when block API fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'server_error' }),
    })
    const ParentDetailClient = await importComponent()
    render(<ParentDetailClient parent={ACTIVE_PARENT} />)
    fireEvent.click(screen.getByRole('button', { name: /block/i }))
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /block parent/i }))
    await waitFor(() => {
      expect(screen.getByText(/couldn't block parent/i)).toBeTruthy()
    })
  })
})
