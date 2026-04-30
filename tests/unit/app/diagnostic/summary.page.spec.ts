/**
 * FILE OBJECTIVE:
 * - Unit tests for the diagnostic summary server page.
 *
 * LINKED UNIT TEST:
 * - tests/unit/diagnostic/summary.page.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-30T00:00:00Z | staff-engineer | created tests for diagnostic summary page
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Prisma mock
jest.mock('@/lib/prisma.js', () => ({ prisma: require('../../../helpers/prismaMock').prismaMock }))

// Next internals
const redirectMock = jest.fn()
jest.mock('next/navigation', () => ({ redirect: redirectMock }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: any) => children }))

// Auth
const requireActiveSessionMock = jest.fn()
jest.mock('@/lib/auth', () => ({ requireActiveSession: requireActiveSessionMock }))

// Services
const computeReadinessScoreMock = jest.fn()
jest.mock('@/lib/student/examReadiness', () => ({ computeReadinessScore: computeReadinessScoreMock }))
const getSubjectDiagnosticStatusMock = jest.fn()
jest.mock('@/lib/diagnostics/stateStore', () => ({ getSubjectDiagnosticStatus: getSubjectDiagnosticStatusMock }))

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

// UI component mock
jest.mock('@/components/student/dashboard/SubjectReadinessCard', () => ({
  SubjectReadinessCard: (props: any) => React.createElement('div', { 'data-testid': 'SubjectReadinessCard' }, props.subjectName),
}))

import { prismaMock, resetPrismaMock } from '../../../helpers/prismaMock'

const MOCK_USER_ID = 'user-test-1'
function makeSession() {
  return { user: { id: MOCK_USER_ID } }
}

describe('DiagnosticSummaryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetPrismaMock()
    redirectMock.mockImplementation(() => {
      throw new Error('REDIRECT')
    })
  })

  it('renders readiness rows for provided subject ids', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    computeReadinessScoreMock.mockResolvedValue({ score: 72 })
    getSubjectDiagnosticStatusMock.mockResolvedValue({ status: 'completed', retakeEligibleAt: null })

    prismaMock.subjectDef.findMany.mockResolvedValue([
      { id: 'sub-1', name: 'Mathematics' },
      { id: 'sub-2', name: 'Physics' },
    ])

    const { default: Page } = require('@/app/diagnostic/summary/page')
    const element = await Page({ searchParams: { subjects: 'sub-1,sub-2' } })
    const html = renderToStaticMarkup(element)

    expect(html).toContain('Mathematics')
    expect(html).toContain('Physics')
    expect(prismaMock.subjectDef.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['sub-1', 'sub-2'] } }, select: { id: true, name: true } })
    )
    expect(computeReadinessScoreMock).toHaveBeenCalledWith(MOCK_USER_ID, 'sub-1')
    expect(computeReadinessScoreMock).toHaveBeenCalledWith(MOCK_USER_ID, 'sub-2')
    expect(getSubjectDiagnosticStatusMock).toHaveBeenCalledTimes(2)
  })

  it('redirects to /dashboard when no subjects param provided', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    const { default: Page } = require('@/app/diagnostic/summary/page')
    await expect(Page({ searchParams: {} as any })).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })
})
