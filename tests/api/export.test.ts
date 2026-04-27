describe('export API', () => {
  afterEach(() => jest.resetAllMocks())

  test('POST /api/export creates PDF and writes audit log', async () => {
    const mockPrisma: any = { auditLog: { create: jest.fn() } }
    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }

    const route = await import('../../app/api/export/route')
    const messages = [{ role: 'user', content: 'hello world' }]
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ title: 'T', messages, format: 'pdf' }), headers: { 'Content-Type': 'application/json' } })
    const res = await route.POST(req as any)
    expect(res.status).toBe(200)
    expect(mockPrisma.auditLog.create).toHaveBeenCalled()
  })

  test('rate limits rapid exports', async () => {
    const mockPrisma: any = { auditLog: { create: jest.fn() } }
    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'rateuser' } }

    const route = await import('../../app/api/export/route')
    const messages = [{ role: 'user', content: 'x' }]
    const reqFactory = () => new Request('http://localhost', { method: 'POST', body: JSON.stringify({ title: 'T', messages, format: 'pdf' }), headers: { 'Content-Type': 'application/json' } })

    // burst over limit (limit is 5) -- call 6 times
    for (let i = 0; i < 5; i++) {
      const res = await route.POST(reqFactory() as any)
      expect(res.status).toBe(200)
    }
    const blocked = await route.POST(reqFactory() as any)
    expect(blocked.status).toBe(429)
  })
})
