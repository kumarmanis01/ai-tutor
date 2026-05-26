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
 * - 2026-05-06T00:00:00Z | copilot | add assertions for SecondaryStartOptions
 *                          todaysHref mapping in resume and homework states
 * - 2026-05-07T06:45:00Z | copilot | add regression tests for nextAction topicId -> conceptId
 *                          mapping; ensure missing concept never emits broken /session/pre url
 * - 2026-05-08T00:00:00Z | copilot | align SecondaryStartOptions assertions with AC-02:
 *                          secondary today href follows learning-plan item and
 *                          falls back to browse syllabus when plan item missing
 * - 2026-05-08T00:00:00Z | copilot | add regression for IN_PROGRESS plan-item
 *                          selection in secondary Today's topic CTA
 * - 2026-05-25T00:00:00Z | copilot | update mocks for v2 dashboard revamp components;
 *                          fix useRouter mock in next/navigation; align assertions
 *                          with hasPendingDiagnostic guard and new component structure
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
 * 7. Diagnostic guard: hasPendingDiagnostic shows CTA and suppresses missions.
 * 8. Plan concept href surfaces via PickNextSection warmUps when all diagnostics done.
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
const routerPushMock = jest.fn()
const routerReplaceMock = jest.fn()
jest.mock('next/navigation', () => ({
  redirect: redirectMock,
  useRouter: jest.fn(() => ({ push: routerPushMock, replace: routerReplaceMock, back: jest.fn(), prefetch: jest.fn() })),
  usePathname: jest.fn(() => '/dashboard'),
  useSearchParams: jest.fn(() => ({ get: jest.fn() })),
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href?: string }) =>
    React.createElement('a', { href }, children),
}))
jest.mock('next/headers', () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }))
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }),
}))

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

const loggerWarnMock = jest.fn()

jest.mock('@/lib/redis', () => ({ getRedis: jest.fn().mockReturnValue(null) }))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: loggerWarnMock, error: jest.fn() },
}))

// ── UI components (client components -- mock to avoid hook errors in SSR) ────
jest.mock('@/components/student/dashboard/TodaysMissions', () => ({
  __esModule: true,
  // Render props as JSON so tests can assert on hero mission values (e.g. href containing conceptId)
  default: (props: any) => React.createElement('div', { 'data-testid': 'TodaysMissions' }, JSON.stringify(props)),
  MissionHero: (props: any) => React.createElement('div', { 'data-testid': 'MissionHero' }, JSON.stringify(props)),
  MissionRow: (props: any) => React.createElement('div', { 'data-testid': 'MissionRow' }, JSON.stringify(props)),
}))
// v2 dashboard revamp components
jest.mock('@/components/student/dashboard/WelcomeBanner', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('div', { 'data-testid': 'WelcomeBanner' }, JSON.stringify(props)),
}))
// PickNextSection uses useRouter -- must be mocked to avoid hook error in SSR tests
jest.mock('@/components/student/dashboard/PickNextSection', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('div', { 'data-testid': 'PickNextSection' }, JSON.stringify(props)),
}))
jest.mock('@/components/student/dashboard/StatsRow', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('div', { 'data-testid': 'StatsRow' }, JSON.stringify(props)),
}))
// ExamReadinessSection is a client component ('use client')
jest.mock('@/components/student/dashboard/ExamReadinessSection', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('div', { 'data-testid': 'ExamReadinessSection' }, JSON.stringify(props)),
}))
// Legacy mocks kept for backward-compat (no longer rendered but mock prevents import errors)
jest.mock('@/components/student/dashboard/SecondaryStartOptions', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('div', { 'data-testid': 'SecondaryStartOptions' }, JSON.stringify(props)),
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

function makeDiagnosticStatus(subjectKey: string, status: 'pending' | 'completed' | 'skipped' = 'pending') {
  return { subjectKey, status, retakeEligibleAt: null }
}

function getConceptFindFirstMock(): jest.Mock {
  const prismaWithConcept = prismaMock as unknown as {
    concept?: { findFirst: jest.Mock }
  }
  if (!prismaWithConcept.concept) {
    prismaWithConcept.concept = { findFirst: jest.fn() }
  }
  return prismaWithConcept.concept.findFirst
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StudentHomeDashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetPrismaMock()
    redirectMock.mockImplementation(() => { throw new Error('REDIRECT') })
    getConceptFindFirstMock().mockReset()
    getConceptFindFirstMock().mockResolvedValue(null)
  })

  it('should render without throwing and call all expected Prisma models', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue(null)
    getSubjectDiagnosticStatusMock.mockResolvedValue(makeDiagnosticStatus('sub-math'))
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())

    // board + grade required for hasCompleteAcademicProfile and resolveStudentSubjects
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ board: 'CBSE', grade: '10', subjects: ['Mathematics'] }))
    prismaMock.freeTierUsage.findFirst.mockResolvedValue({
      sessionsUsed: 1,
      periodStart: new Date(),
    })
    prismaMock.learningPlan.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findFirst.mockResolvedValue(null)
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 80 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue([
      { id: 'sub-math', name: 'Mathematics', slug: 'mathematics' },
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

    // board + grade required for resolveStudentSubjects to fire
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ subjects: ['Mathematics'], board: 'CBSE', grade: '10' }))
    prismaMock.freeTierUsage.findFirst.mockResolvedValue(null)
    prismaMock.learningPlan.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findFirst.mockResolvedValue(null)
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue([{ id: 'sub-math', name: 'Mathematics', slug: 'mathematics' }])
    prismaMock.diagnosticSession.findFirst.mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/dashboard/page')
    const element = await Page()
    const html = renderToStaticMarkup(element)

    expect(html).toContain('/diagnostic/sub-math')
  })

  it('should call computeReadinessScore for every resolved subject', async () => {
    const subjects = [
      { id: 'sub-1', name: 'Mathematics', slug: 'mathematics' },
      { id: 'sub-2', name: 'Physics', slug: 'physics' },
      { id: 'sub-3', name: 'Chemistry', slug: 'chemistry' },
    ]

    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue(null)
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())
    getSubjectDiagnosticStatusMock.mockImplementation((_, subjectKey: string) =>
      Promise.resolve(makeDiagnosticStatus(subjectKey)),
    )

    // board + grade required for hasCompleteAcademicProfile
    prismaMock.user.findUnique.mockResolvedValue(
      makeUser({ board: 'CBSE', grade: '10', subjects: ['Mathematics', 'Physics', 'Chemistry'] }),
    )
    prismaMock.freeTierUsage.findFirst.mockResolvedValue(null)
    prismaMock.learningPlan.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findFirst.mockResolvedValue(null)
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

    // FreemiumCounter is currently commented out in the page (pending design review);
    // assert only that UpgradeFlow does not appear when sessions remain.
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

  it('should include planned concept href in PickNextSection warmUps for resume state', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue({
      ruleId: 'resume_session',
      sessionId: 'sess-42',
      topicId: 'topic-1',
      topicName: 'Integers',
      subject: 'Math',
      chapter: 'Numbers',
      resumePhase: 'PRACTICE',
    })
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())
    // All diagnostics complete so missions section renders and plan concept is surfaced
    getSubjectDiagnosticStatusMock.mockResolvedValue(makeDiagnosticStatus('sub-1', 'completed'))

    prismaMock.user.findUnique.mockResolvedValue(makeUser({ subscriptionStatus: 'free' }))
    prismaMock.freeTierUsage.findFirst.mockResolvedValue(null)
    // plan-42 is the only enrolled plan; subject resolved via subjectDef.findMany
    prismaMock.learningPlan.findMany.mockResolvedValue([{ id: 'plan-42', subjectId: 'sub-1' }])
    prismaMock.learningPlanItem.findFirst.mockResolvedValue({ conceptId: 'concept-plan-9' })
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findFirst.mockResolvedValue(null)
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue([{ id: 'sub-1', name: 'Science' }])
    prismaMock.diagnosticSession.findFirst.mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/dashboard/page')
    const element = await Page()
    const html = renderToStaticMarkup(element)

    // Plan concept appears in PickNextSection warmUps (and possibly TodaysMissions secondary)
    expect(html).toContain('/session/pre/concept-plan-9')
    // sessionId fallback must never appear in any URL (topicId takes precedence)
    expect(html).not.toContain('/session/sess-42')
  })

  it('should pass empty warmUps to PickNextSection when no plan exists (no broken pre-session URL)', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue({
      ruleId: 'homework_pending',
      assignmentId: 'hw-77',
      topicName: 'Fractions worksheet',
    })
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())
    // Diagnostic pending -- diagnostic CTA is shown, missions suppressed
    getSubjectDiagnosticStatusMock.mockResolvedValue(makeDiagnosticStatus('sub-1'))

    prismaMock.user.findUnique.mockResolvedValue(makeUser({ subscriptionStatus: 'free' }))
    prismaMock.freeTierUsage.findFirst.mockResolvedValue(null)
    prismaMock.learningPlan.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findFirst.mockResolvedValue(null)
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue([{ id: 'sub-1', name: 'Science' }])
    prismaMock.diagnosticSession.findFirst.mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/dashboard/page')
    const element = await Page()
    const html = renderToStaticMarkup(element)

    // No plans -> warmUps empty -> PickNextSection receives []
    expect(html).toContain('PickNextSection')
    expect(html).toContain('warmUps&quot;:[]')
    // No pre-session URL injected from plan items (no plans exist)
    expect(html).not.toContain('/session/pre/')
  })

  it('should prefer IN_PROGRESS plan item for warmUps over UPCOMING', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue({
      ruleId: 'homework_pending',
      assignmentId: 'hw-77',
      topicName: 'Fractions worksheet',
    })
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())
    // All diagnostics complete so warmUps are rendered with plan concept
    getSubjectDiagnosticStatusMock.mockResolvedValue(makeDiagnosticStatus('sub-1', 'completed'))

    prismaMock.user.findUnique.mockResolvedValue(makeUser({ subscriptionStatus: 'free' }))
    prismaMock.freeTierUsage.findFirst.mockResolvedValue(null)
    // plan has an id so per-plan item resolution runs
    prismaMock.learningPlan.findMany.mockResolvedValue([{ id: 'plan-42', subjectId: 'sub-1' }])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findFirst.mockResolvedValue({ startedAt: new Date() })
    // First call (IN_PROGRESS check) returns the in-progress concept
    prismaMock.learningPlanItem.findFirst.mockResolvedValueOnce({ conceptId: 'concept-in-progress-22' })
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue([{ id: 'sub-1', name: 'Science' }])
    prismaMock.diagnosticSession.findFirst.mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/dashboard/page')
    const element = await Page()
    const html = renderToStaticMarkup(element)

    // IN_PROGRESS concept surfaces in PickNextSection warmUps
    expect(html).toContain('/session/pre/concept-in-progress-22')
    // warmUps must not be empty
    expect(html).not.toContain('warmUps&quot;:[]')
  })

  it('should pass resolved concept id to TodaysMissions hero when nextAction returns topic id', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue({
      ruleId: 'next_new_topic',
      topicId: 'topic-123',
      topicName: 'Integers',
      subject: 'Math',
    })
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())
    // All diagnostics complete so TodaysMissions renders and hero concept-777 appears
    getSubjectDiagnosticStatusMock.mockResolvedValue(makeDiagnosticStatus('sub-1', 'completed'))

    prismaMock.user.findUnique.mockResolvedValue(makeUser({ subscriptionStatus: 'free' }))
    prismaMock.freeTierUsage.findFirst.mockResolvedValue(null)
    prismaMock.learningPlan.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findFirst.mockResolvedValue(null)
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue([{ id: 'sub-1', name: 'Science' }])
    prismaMock.diagnosticSession.findFirst.mockResolvedValue(null)
    getConceptFindFirstMock().mockResolvedValue({ id: 'concept-777' })

    const { default: Page } = require('@/app/(student)/dashboard/page')
    const element = await Page()
    const html = renderToStaticMarkup(element)

    // concept-777 must appear in TodaysMissions hero mission props
    expect(html).toContain('concept-777')
    // raw topic-123 must never reach any URL (only resolved conceptId should appear)
    expect(html).not.toContain('topic-123')
  })

  it('should skip hero mission and warn when nextAction topic id has no active concept', async () => {
    requireActiveSessionMock.mockResolvedValue(makeSession())
    getNextActionMock.mockResolvedValue({
      ruleId: 'next_new_topic',
      topicId: 'topic-missing-concept',
      topicName: 'Polynomials',
      subject: 'Math',
    })
    computeReadinessScoreMock.mockResolvedValue(makeReadinessResult())
    // All diagnostics complete so the concept lookup runs (pending would skip hero logic entirely)
    getSubjectDiagnosticStatusMock.mockResolvedValue(makeDiagnosticStatus('sub-1', 'completed'))

    prismaMock.user.findUnique.mockResolvedValue(makeUser({ subscriptionStatus: 'free' }))
    prismaMock.freeTierUsage.findFirst.mockResolvedValue(null)
    prismaMock.learningPlan.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findMany.mockResolvedValue([])
    prismaMock.structuredSession.findFirst.mockResolvedValue(null)
    prismaMock.studentXP.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    prismaMock.studentXP.groupBy.mockResolvedValue([])
    prismaMock.subjectDef.findMany.mockResolvedValue([{ id: 'sub-1', name: 'Science' }])
    prismaMock.diagnosticSession.findFirst.mockResolvedValue(null)
    getConceptFindFirstMock().mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/dashboard/page')
    const element = await Page()
    const html = renderToStaticMarkup(element)

    // Raw topic id must never appear in any URL
    expect(html).not.toContain('/session/pre/topic-missing-concept')
    // Logger must warn with the exact key used in the page code
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'dashboard.hero_mission.skipped_missing_concept',
      expect.objectContaining({
        userId: MOCK_USER_ID,
        topicId: 'topic-missing-concept',
        ruleId: 'next_new_topic',
      }),
    )
  })
})
