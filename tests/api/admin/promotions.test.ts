import { POST as POST_CREATE } from '../../../app/api/admin/promotions/candidates/route'
import { GET as GET_LIST } from '../../../app/api/admin/promotions/route'
import { POST as POST_APPROVE } from '../../../app/api/admin/promotions/[id]/approve/route'
import { POST as POST_REJECT } from '../../../app/api/admin/promotions/[id]/reject/route'
import { requireAdminOrModerator } from '@/lib/auth'

jest.mock('@/lib/auth', () => ({ requireAdminOrModerator: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

const mockedRequire = requireAdminOrModerator as jest.MockedFunction<any>

describe('admin promotions API', () => {
  beforeEach(() => jest.clearAllMocks())

  test('POST create returns 403 when unauthorized', async () => {
    mockedRequire.mockRejectedValue(new Error('Unauthorized'))
    const res = await POST_CREATE(new Request('http://localhost'))
    expect(res.status).toBe(403)
  })

  test('GET list returns 403 when unauthorized', async () => {
    mockedRequire.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET_LIST(new Request('http://localhost'))
    expect(res.status).toBe(403)
  })

  test('approve returns 403 when unauthorized', async () => {
    mockedRequire.mockRejectedValue(new Error('Unauthorized'))
    const res = await POST_APPROVE(new Request('http://localhost'), { params: { id: 'pc1' } } as any)
    expect(res.status).toBe(403)
  })

  test('reject returns 403 when unauthorized', async () => {
    mockedRequire.mockRejectedValue(new Error('Unauthorized'))
    const res = await POST_REJECT(new Request('http://localhost'), { params: { id: 'pc1' } } as any)
    expect(res.status).toBe(403)
  })
})
