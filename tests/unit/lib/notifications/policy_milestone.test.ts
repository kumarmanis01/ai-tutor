import { jest } from '@jest/globals'

describe('notification policy weekly milestone cap', () => {
  let map: Map<string, string>
  const fakeRedis = {
    async get(k: string) { return map.get(k) ?? null },
    async set(k: string, v: string, ...args: any[]) {
      const nx = args.includes('NX')
      if (nx && map.has(k)) return null
      map.set(k, v)
      return 'OK'
    },
    async ttl(k: string) { return map.has(k) ? -1 : -2 },
    async expire(k: string) { return map.has(k) ? 1 : 0 },
    async incr(k: string) { const v = Number(map.get(k) ?? '0') + 1; map.set(k, String(v)); return v },
  }

  beforeEach(() => {
    map = new Map()
    jest.resetModules()
    jest.doMock('@/lib/redis', () => ({ getRedis: () => fakeRedis }))
  })

  it('allows up to the configured weekly cap for milestone and denies after', async () => {
    const { canSendNotification, recordSendNotification } = await import('@/lib/notifications/policy')
    const parentId = 'p-m1'

    // initial allowed
    const before = await canSendNotification(parentId, 'milestone')
    expect(before.allowed).toBe(true)

    // record sends up to cap (default 2)
    await recordSendNotification(parentId, 'milestone')
    const after1 = await canSendNotification(parentId, 'milestone')
    expect(after1.allowed).toBe(true)

    await recordSendNotification(parentId, 'milestone')
    const after2 = await canSendNotification(parentId, 'milestone')
    expect(after2.allowed).toBe(false)
  })

  it('does not count digest against milestone cap (digest remains allowed)', async () => {
    const { canSendNotification, recordSendNotification } = await import('@/lib/notifications/policy')
    const parentId = 'p-d1'

    // simulate two milestone sends
    await recordSendNotification(parentId, 'milestone')
    await recordSendNotification(parentId, 'milestone')

    // digest should still be allowed (digests are scheduled weekly by design)
    const digestCheck = await canSendNotification(parentId, 'digest')
    expect(digestCheck.allowed).toBe(true)
  })
})
