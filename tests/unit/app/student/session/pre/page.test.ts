/**
 * FILE OBJECTIVE:
 * - Unit tests for the pre-session server page, including TopicDef.id fallback
 *   resolution to Concept.id to prevent dashboard bounce redirects.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/session/pre/page.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | add regression tests for concept/topic id resolution
 */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const redirectMock = jest.fn()
const getServerSessionForHandlersMock = jest.fn()
const conceptFindUniqueMock = jest.fn()
const conceptFindFirstMock = jest.fn()
const conceptFindManyMock = jest.fn()
const studentConceptStateFindManyMock = jest.fn()
const structuredSessionFindFirstMock = jest.fn()
const learningPlanItemFindFirstMock = jest.fn()

jest.mock('next/navigation', () => ({ redirect: redirectMock }))
jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: getServerSessionForHandlersMock,
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    concept: {
      findUnique: conceptFindUniqueMock,
      findFirst: conceptFindFirstMock,
      findMany: conceptFindManyMock,
    },
    studentConceptState: {
      findMany: studentConceptStateFindManyMock,
    },
    structuredSession: {
      findFirst: structuredSessionFindFirstMock,
    },
    learningPlanItem: {
      findFirst: learningPlanItemFindFirstMock,
    },
  },
}))
jest.mock('@/components/student/session/PreSessionScreen', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'PreSessionScreen' }, JSON.stringify(props)),
}))

describe('PreSessionPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    redirectMock.mockImplementation(() => {
      throw new Error('REDIRECT')
    })

    getServerSessionForHandlersMock.mockResolvedValue({ user: { id: 'student-1' } })
    conceptFindUniqueMock.mockResolvedValue(null)
    conceptFindFirstMock.mockResolvedValue(null)
    conceptFindManyMock.mockResolvedValue([])
    studentConceptStateFindManyMock.mockResolvedValue([])
    structuredSessionFindFirstMock.mockResolvedValue(null)
    learningPlanItemFindFirstMock.mockResolvedValue(null)
  })

  it('should redirect to signin when session is missing', async () => {
    getServerSessionForHandlersMock.mockResolvedValue(null)

    const { default: Page } = require('@/app/(student)/session/pre/[conceptId]/page')

    await expect(Page({ params: Promise.resolve({ conceptId: 'topic-123' }) })).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/auth/login?callbackUrl=/session/pre/topic-123')
  })

  it('should resolve TopicDef id to first active concept and render pre-session screen', async () => {
    conceptFindFirstMock.mockResolvedValue({
      id: 'concept-1',
      name: 'Linear Equations Basics',
      irt_b: 0,
      prerequisiteConceptIds: [],
      topicId: 'topic-123',
      subjectId: 'subject-1',
      topic: {
        id: 'topic-123',
        name: 'Linear Equations',
        chapter: {
          id: 'chapter-1',
          name: 'Algebra',
          boardChapterWeights: [{ weightMarks: 10 }],
          subject: { id: 'subject-1', name: 'Mathematics' },
        },
      },
    })

    const { default: Page } = require('@/app/(student)/session/pre/[conceptId]/page')
    const element = await Page({ params: Promise.resolve({ conceptId: 'topic-123' }) })
    const html = renderToStaticMarkup(element)

    expect(conceptFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'topic-123' } }),
    )
    expect(conceptFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { topicId: 'topic-123', isSuspended: false } }),
    )
    expect(learningPlanItemFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ conceptId: 'concept-1' }) }),
    )
    expect(html).toContain('concept-1')
    expect(html).toContain('Linear Equations Basics')
  })

  it('should redirect to dashboard when no concept can be resolved', async () => {
    const { default: Page } = require('@/app/(student)/session/pre/[conceptId]/page')

    await expect(Page({ params: Promise.resolve({ conceptId: 'unknown-id' }) })).rejects.toThrow('REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/dashboard')
  })
})
