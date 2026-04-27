/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/student/whiteboard/save
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/whiteboard/save.test.ts
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | created
 */

describe('POST /api/student/whiteboard/save', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => null }))

    const { POST } = await import('@/app/api/student/whiteboard/save/route')

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's1', canvasDataUrl: 'data:image/png;base64,AAA' }),
    })

    const res: any = await POST(req as any)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('uploads image and metadata to R2 and returns URLs', async () => {
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 'stu1' } }) }))
    jest.doMock('@/lib/storage/r2', () => ({ uploadBufferToR2: async (buf: Buffer, key: string) => `https://r2.test/${key}` }))

    const { POST } = await import('@/app/api/student/whiteboard/save/route')

    const samplePng = Buffer.from('PNGDATA').toString('base64')
    const canvasDataUrl = `data:image/png;base64,${samplePng}`

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'sess-1', conceptName: 'Linear eq', canvasDataUrl }),
    })

    const res: any = await POST(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.imageUrl).toBe('string')
    expect(typeof body.metadataUrl).toBe('string')
    expect(body.imageUrl).toContain('whiteboards/stu1/sess-1')
  })
})
