/**
 * FILE OBJECTIVE:
 * - Smoke tests for the StudentHomeDashboardPage server component.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/dashboard/page.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-21T12:00:00Z | staff-engineer | added tests for grade parsing, dedup preference, and diagnosticHref
 */
/**
 * Tests verify:
 * 1. Happy path: page renders without throwing, all Prisma models queried.
 * 2. Auth gate: redirect('/') is called when session is null.
 * 3. Missing user: redirect('/') is called when user row not found.
 * 4. computeReadinessScore is called for every subject in the resolved list,
 *    confirming the concurrent-batch loop runs correctly.
 * 5. Freemium counter data path: sessionsUsed < cap exposes sessionsRemaining.
 * 6. Session cap hit: sessionsRemaining === 0 when sessionsUsed === cap.
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// ── Prisma mock (must be first, before any module that imports prisma) ─────────
jest.mock('@/lib/prisma.js', () => ({
  prisma: require('../../../../helpers/prismaMock').prismaMock,
}))

// ── Next.js internals ─────────────────────────────────────────────────────────
const redirectMock = jest.fn()
jest.mock('next/navigation', () => ({ redirect: redirectMock }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('next/headers', () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }))

// ── Auth ──────────────────────────────────────────────────────────────────────
const requireActiveSessionMock = jest.fn()
jest.mock('@/lib/auth', () => ({ requireActiveSession: requireActiveSessionMock }))

// ── Service layer ─────────────────────────────────────────────────────────────
const getNextActionMock = jest.fn()
jest.mock('@/lib/homeEngine/getNextAction', () => ({ getNextAction: getNextActionMock }))

const computeReadinessScoreMock = jest.fn()
jest.mock('@/lib/student/examReadiness', () => ({
  computeReadinessScore: computeReadinessScoreMock,
}))

const getSubjectDiagnosticStatusMock = jest.fn()
jest.mock('@/lib/diagnostics/stateStore', () => ({
  getSubjectDiagnosticStatus: getSubjectDiagnosticStatusMock,
}))

jest.mock('@/lib/redis', () => ({ getRedis: jest.fn().mockReturnValue(null) }))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

// ── UI components (client components -- mock to avoid hook errors in SSR) ────
jest.mock('@/components/student/dashboard/TodaysLearningCard', () => ({
  __esModule: true,
  // Render props as JSON inside the mock so tests can assert on values
  // such as `diagnosticHref` without coupling to the real component.
  default: (props: any) => React.createElement('div', { 'data-testid': 'TodaysLearningCard' }, JSON.stringify(props)),
}))
jest.mock('@/components/student/dashboard/SecondaryStartOptions', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'SecondaryStartOptions' }),
}))
jest.mock('@/components/student/dashboard/XPWidget', () => ({
  XPWidget: () => React.createElement('div', { 'data-testid': 'XPWidget' }),
}))
jest.mock('@/components/student/dashboard/WeeklyStudyStrip', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'WeeklyStudyStrip' }),
}))
jest.mock('@/components/student/dashboard/RevisionWidget', () => ({
  RevisionWidget: () => React.createElement('div', { 'data-testid': 'RevisionWidget' }),
}))
jest.mock('@/components/student/dashboard/SubjectReadinessCard', () => ({
  SubjectReadinessCard: () =>
    React.createElement('div', { 'data-testid': 'SubjectReadinessCard' }),
}))
jest.mock('@/components/student/dashboard/FreemiumCounter', () => ({
  FreemiumCounter: () =>
    React.createElement('div', { 'data-testid': 'FreemiumCounter' }),
}))
jest.mock('@/components/student/subscription/UpgradeFlow', () => ({
  UpgradeFlow: () => React.createElement('div', { 'data-testid': 'UpgradeFlow' }),
}))
jest.mock('@/components/student/dashboard/CrunchModeToggle', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'CrunchModeToggle' }),
}))

// ── Test helpers ──────────────────────────────────────────────────────────────
import {
  prismaMock,
  resetPrismaMock,
} from '../../../../helpers/prismaMock'

const MOCK_USER_ID = 'user-test-1'

function makeSession() {
  return { user: { id: MOCK_USER_ID } }
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Student',
    email: 'student@example.com',
    totalXp: 200,
    level: 3,
    subscriptionStatus: 'free',
    subjects: [],
    learningPlans: [],
    preferences: null,
    ...overrides,
  }
}

function makeReadinessResult() {
  return { score: 55, label: 'needs_work', chapters: [] }
}

function makeDiagnosticStatus(subjectKey: string) {
  return { subjectKey, status: 'pending', retakeEligibleAt: null }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StudentHomeDashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetPrismaMock()
    redirectMock.mockImplementation(() => { throw new Error('REDIRECT') })
  })

  it('should render without throwing and call all expected Prisma models', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue(null)
    getSubjectDiagnosticStatusMock.mockResolvedValue(makeDiagnosticStatus('sub-math'))
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())

    prismaMock.user.findUnique.mockResolvedValue(makeUser())
    prismaMock.freeTierUsage.findFirst.mockResolvedValue({
      sessionsUsed: 1,
      periodStart: new Date(),
    })
    prismaMock.learningPlan.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 80 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue([
      { id: 'sub-math', name: 'Mathematics' },
    ])
    prismaMock.diagnosticSession.findFirst.mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/dashboard/page')
    const element = await Page()
    const html = renderToStaticMarkup(element)

    expect(html).toBeTruthy()
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: MOCK_USER_ID } }),
    )
    expect(prismaMock.structuredSession.findMany).toHaveBeenCalled()
    expect(prismaMock.studentXP.aggregate).toHaveBeenCalled()
    expect(prismaMock.studentXP.groupBy).toHaveBeenCalled()
    expect(prismaMock.subjectDef.findMany).toHaveBeenCalled()
    expect(computeReadinessScoreMock).toHaveBeenCalledWith(MOCK_USER_ID, 'sub-math')
    expect(prismaMock.diagnosticSession.findFirst).not.toHaveBeenCalled()
    expect(getSubjectDiagnosticStatusMock).toHaveBeenCalledWith(MOCK_USER_ID, 'sub-math')
  })

  it('should scope subject query to parsed integer grade when board and grade present', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue(null)
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())
    getSubjectDiagnosticStatusMock.mockResolvedValue(makeDiagnosticStatus('sub-math'))

    prismaMock.user.findUnique.mockResolvedValue(
      makeUser({ board: 'CBSE', grade: '10', subjects: ['Mathematics'] }),
    )
    prismaMock.freeTierUsage.findFirst.mockResolvedValue(null)
    prismaMock.learningPlan.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue([{ id: 'sub-math', name: 'Mathematics' }])
    prismaMock.diagnosticSession.findFirst.mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/dashboard/page')
    await Page()

    expect(prismaMock.subjectDef.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          class: expect.objectContaining({
            grade: 10,
            board: expect.objectContaining({ slug: expect.objectContaining({ equals: 'CBSE' }) }),
          }),
        }),
      }),
    )
  })

  it('should prefer subject from learning plan when deduplicating by name', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue(null)
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())
    getSubjectDiagnosticStatusMock.mockResolvedValue(makeDiagnosticStatus('plan-sub-math'))

    prismaMock.user.findUnique.mockResolvedValue(
      makeUser({ board: 'CBSE', grade: '10', subjects: ['Mathematics'] }),
    )
    prismaMock.freeTierUsage.findFirst.mockResolvedValue(null)
    prismaMock.learningPlan.findMany.mockResolvedValue([{ subjectId: 'plan-sub-math' }])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue([
      { id: 'other-sub', name: 'Mathematics' },
      { id: 'plan-sub-math', name: 'Mathematics' },
    ])
    prismaMock.diagnosticSession.findFirst.mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/dashboard/page')
    await Page()

    // computeReadinessScore should be called for the plan subject id, not the other duplicate
    expect(computeReadinessScoreMock).toHaveBeenCalledWith(MOCK_USER_ID, 'plan-sub-math')
    expect(computeReadinessScoreMock).not.toHaveBeenCalledWith(MOCK_USER_ID, 'other-sub')
  })

  it('should set diagnosticHref to /diagnostic/[subjectId] when a subject exists', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue(null)
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())
    getSubjectDiagnosticStatusMock.mockResolvedValue(makeDiagnosticStatus('sub-math'))

    prismaMock.user.findUnique.mockResolvedValue(makeUser({ subjects: ['Mathematics'] }))
    prismaMock.freeTierUsage.findFirst.mockResolvedValue(null)
    prismaMock.learningPlan.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue([{ id: 'sub-math', name: 'Mathematics' }])
    prismaMock.diagnosticSession.findFirst.mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/dashboard/page')
    const element = await Page()
    const html = renderToStaticMarkup(element)

    expect(html).toContain('/diagnostic/sub-math')
  })

  it('should call computeReadinessScore for every resolved subject', async () => {
    const subjects = [
      { id: 'sub-1', name: 'Mathematics' },
      { id: 'sub-2', name: 'Physics' },
      { id: 'sub-3', name: 'Chemistry' },
    ]

    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue(null)
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())
    getSubjectDiagnosticStatusMock.mockImplementation((_, subjectKey: string) =>
      Promise.resolve(makeDiagnosticStatus(subjectKey)),
    )

    prismaMock.user.findUnique.mockResolvedValue(makeUser())
    prismaMock.freeTierUsage.findFirst.mockResolvedValue(null)
    prismaMock.learningPlan.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue(subjects)
    prismaMock.diagnosticSession.findFirst.mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/dashboard/page')
    await Page()

    expect(computeReadinessScoreMock).toHaveBeenCalledTimes(3)
    for (const sub of subjects) {
      expect(computeReadinessScoreMock).toHaveBeenCalledWith(MOCK_USER_ID, sub.id)
    }
    expect(getSubjectDiagnosticStatusMock).toHaveBeenCalledTimes(3)
  })

  it('should redirect to "/" when session is null', async () => {
    requireActiveSessionMock.mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/dashboard/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/')
  })

  it('should redirect to "/" when user row is not found', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue(null)

    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.freeTierUsage.findFirst.mockResolvedValue(null)
    prismaMock.learningPlan.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])

    const { default: Page } = require('@/app/(student)/dashboard/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/')
  })

  it('should reflect sessionsRemaining correctly for free-tier student', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue(null)
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())
    getSubjectDiagnosticStatusMock.mockResolvedValue(makeDiagnosticStatus('sub-1'))

    prismaMock.user.findUnique.mockResolvedValue(makeUser({ subscriptionStatus: 'free' }))
    // 1 session used out of 3 cap => 2 remaining
    prismaMock.freeTierUsage.findFirst.mockResolvedValue({
      sessionsUsed: 1,
      periodStart: new Date(),
    })
    prismaMock.learningPlan.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue([{ id: 'sub-1', name: 'Science' }])
    prismaMock.diagnosticSession.findFirst.mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/dashboard/page')
    const element = await Page()
    const html = renderToStaticMarkup(element)

    // FreemiumCounter should render (sessionsRemaining > 0)
    expect(html).toContain('FreemiumCounter')
    // UpgradeFlow should NOT render
    expect(html).not.toContain('UpgradeFlow')
  })

  it('should show UpgradeFlow when session cap is hit', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue(null)
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())
    getSubjectDiagnosticStatusMock.mockResolvedValue(makeDiagnosticStatus('sub-1'))

    prismaMock.user.findUnique.mockResolvedValue(makeUser({ subscriptionStatus: 'free' }))
    // 3 sessions used = cap reached => 0 remaining
    prismaMock.freeTierUsage.findFirst.mockResolvedValue({
      sessionsUsed: 3,
      periodStart: new Date(),
    })
    prismaMock.learningPlan.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue([{ id: 'sub-1', name: 'Science' }])
    prismaMock.diagnosticSession.findFirst.mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/dashboard/page')
    const element = await Page()
    const html = renderToStaticMarkup(element)

    // UpgradeFlow should render (cap hit)
    expect(html).toContain('UpgradeFlow')
    // FreemiumCounter should NOT render
    expect(html).not.toContain('FreemiumCounter')
  })
})
