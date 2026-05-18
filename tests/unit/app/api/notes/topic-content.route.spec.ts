/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/notes/topic-content
 * - Covers: auth guard, cache hit, cache miss, preferred language, any-language fallback.
 *
 * LINKED UNIT TEST: (this file is the test)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-18 | claude | created
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    topicNote: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}))

jest.mock('@/lib/cache', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

import { GET } from '@/app/api/notes/topic-content/route'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { cacheGet, cacheSet } from '@/lib/cache'

const mockNote = {
  id: 'note-1',
  title: 'Integers',
  contentJson: { overview: 'test' },
  language: 'en',
  version: 1,
  topicId: 'topic-1',
}

function makeReq(params: Record<string, string>): Request {
  const url = new URL('http://localhost/api/notes/topic-content')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url.toString())
}

describe('GET /api/notes/topic-content', () => {
  beforeEach(() => jest.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeReq({ topicId: 'topic-1' }))
    expect(res.status).toBe(401)
  })

  test('returns 400 when topicId is missing', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    ;(cacheGet as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeReq({}))
    expect(res.status).toBe(400)
  })

  test('returns cached value on cache hit', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    const cached = { note: mockNote }
    ;(cacheGet as jest.Mock).mockResolvedValue(cached)
    const res = await GET(makeReq({ topicId: 'topic-1', language: 'en' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(cached)
    expect(prisma.topicNote.findFirst).not.toHaveBeenCalled()
  })

  test('queries DB and caches on cache miss (preferred language found)', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    ;(cacheGet as jest.Mock).mockResolvedValue(null)
    ;(prisma.topicNote.findFirst as jest.Mock).mockResolvedValueOnce(mockNote)
    const res = await GET(makeReq({ topicId: 'topic-1', language: 'en' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.note).toMatchObject({ id: 'note-1' })
    expect(cacheSet).toHaveBeenCalled()
    expect(prisma.topicNote.findFirst).toHaveBeenCalledTimes(1)
  })

  test('falls back to any language when preferred language note not found', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    ;(cacheGet as jest.Mock).mockResolvedValue(null)
    // First call (preferred language) returns null; second (any language) returns note
    ;(prisma.topicNote.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...mockNote, language: 'hi' })
    const res = await GET(makeReq({ topicId: 'topic-1', language: 'en' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.note?.language).toBe('hi')
    expect(prisma.topicNote.findFirst).toHaveBeenCalledTimes(2)
  })

  test('returns { note: null } when no approved note exists', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    ;(cacheGet as jest.Mock).mockResolvedValue(null)
    ;(prisma.topicNote.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeReq({ topicId: 'topic-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.note).toBeNull()
    expect(cacheSet).not.toHaveBeenCalled()
  })

  test('unsupported language code is silently coerced to en', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    ;(cacheGet as jest.Mock).mockResolvedValue(null)
    ;(prisma.topicNote.findFirst as jest.Mock).mockResolvedValueOnce(mockNote)
    const res = await GET(makeReq({ topicId: 'topic-1', language: 'fr' }))
    expect(res.status).toBe(200)
    // Prisma call uses 'en' (coerced), not 'fr'
    const firstCall = (prisma.topicNote.findFirst as jest.Mock).mock.calls[0][0]
    expect(firstCall.where.language).toBe('en')
  })
})
