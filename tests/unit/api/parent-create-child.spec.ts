/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock'
import '../../helpers/mockSession'

describe('Parent create-child API', () => {
  beforeEach(() => {
    resetPrismaMock()
    ;(global as any).__TEST_SESSION__ = { user: { id: 'parent-1', role: 'parent', email: 'parent@example.test' } }
  })

  it('returns 409 when parent already has 3 active children', async () => {
    prismaMock.parentStudent.count.mockResolvedValue(3)
    const { POST } = await import('@/app/api/parent/create-child/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ name: 'Child' }), headers: { 'Content-Type': 'application/json' } })
    const res = await POST(req as any) as any
    expect(res.status).toBe(409)
  })

  it('creates child and links when under cap', async () => {
    prismaMock.parentStudent.count.mockResolvedValue(0)
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock))
    prismaMock.user.create.mockResolvedValue({ id: 'child-1', name: 'Child Name' })
    prismaMock.parentStudent.create.mockResolvedValue({ id: 'link-1' })

    const { POST } = await import('@/app/api/parent/create-child/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ name: 'Child Name', email: 'child@example.test' }), headers: { 'Content-Type': 'application/json' } })
    const res = await POST(req as any) as any
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.child).toBeDefined()
    expect(prismaMock.user.create).toHaveBeenCalled()
  })
})
