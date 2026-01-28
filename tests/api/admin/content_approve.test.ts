describe('admin content approve route', () => {
  afterEach(() => jest.resetAllMocks())

  test('creates audit log with resolved user id when DB user exists', async () => {
    const mockPrisma: any = {
      user: { findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where?.id === 'u1' || where?.email === 'alice@example.com') return { id: 'u1' }
        return null
      }) },
      topicDef: { update: jest.fn().mockResolvedValue({ id: 't1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
    }
    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1', email: 'alice@example.com', role: 'admin' } }

    const route = await import('../../../app/api/admin/content/approve/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ type: 'topic', id: 't1', action: 'approve' }), headers: { 'Content-Type': 'application/json' } })
    const res = await route.POST(req as any)
    expect(res.status).toBe(200)
    expect(mockPrisma.topicDef.update).toHaveBeenCalled()
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', action: 'approve_topic' }) }))
  })

  test('falls back to null userId when session user not in DB', async () => {
    const mockPrisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      topicDef: { update: jest.fn().mockResolvedValue({ id: 't2' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'a2' }) },
    }
    ;(global as any).__TEST_PRISMA__ = mockPrisma
    ;(global as any).__TEST_SESSION__ = { user: { id: 'ghost', email: 'ghost@example.com', role: 'admin' } }

    const route = await import('../../../app/api/admin/content/approve/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ type: 'topic', id: 't2', action: 'approve' }), headers: { 'Content-Type': 'application/json' } })
    const res = await route.POST(req as any)
    expect(res.status).toBe(200)
    expect(mockPrisma.topicDef.update).toHaveBeenCalled()
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: null, action: 'approve_topic' }) }))
  })
})
