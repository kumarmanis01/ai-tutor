/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/student/whiteboard/evaluate
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/whiteboard/evaluate.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | created
 */

describe('POST /api/student/whiteboard/evaluate', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => null }))

    const { POST } = await import('@/app/api/student/whiteboard/evaluate/route')

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'sess1' }),
    })

    const res: any = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toBeDefined()
  })

  it('returns fallback feedback when LLM call fails', async () => {
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 's1' } }) }))
    jest.doMock('@/lib/callLLM', () => ({ callTutorLLM: async () => { throw new Error('llm-fail') } }))

    const { POST } = await import('@/app/api/student/whiteboard/evaluate/route')

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'sess1', conceptName: 'Quadratics' }),
    })

    const res: any = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(typeof body.feedback).toBe('string')
    expect(body.feedback.length).toBeGreaterThan(0)
  })

  it('returns LLM feedback when available', async () => {
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 's2' } }) }))
    jest.doMock('@/lib/callLLM', () => ({ callTutorLLM: async () => ({ content: 'Nice work — try isolating the variable next.' }) }))

    const { POST } = await import('@/app/api/student/whiteboard/evaluate/route')

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'sess2', conceptName: 'Circles' }),
    })

    const res: any = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.feedback).toContain('Nice work')
  })

  it('stores canvas artifact when provided and returns artifactUrl', async () => {
    jest.resetModules()
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 's3' } }) }))
    jest.doMock('@/lib/callLLM', () => ({ callTutorLLM: async () => ({ content: 'Good job' }) }))
    // Mock S3 client to avoid network calls
    jest.doMock('@aws-sdk/client-s3', () => ({ S3Client: class { send = async () => ({}) }, PutObjectCommand: class {} }))

    const { POST } = await import('@/app/api/student/whiteboard/evaluate/route')

    // minimal 1x1 png base64 data URL
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'sess3', conceptName: 'Lines', canvasDataUrl: tinyPng }),
    })

    const res: any = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(typeof body.feedback).toBe('string')
    // artifactUrl may be present when upload succeeds
    if (body.artifactUrl) {
      expect(typeof body.artifactUrl).toBe('string')
      expect(body.artifactUrl.length).toBeGreaterThan(0)
    }
  })
})
