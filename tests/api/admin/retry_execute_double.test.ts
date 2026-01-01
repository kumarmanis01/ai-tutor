import { POST as POST_EXECUTE } from '../../../app/api/admin/retry-intents/[id]/execute/route'
import { requireAdminOrModerator } from '@/lib/auth'
import makeRetryService from '@/lib/regeneration/retryService'

jest.mock('@/lib/auth', () => ({ requireAdminOrModerator: jest.fn() }))
jest.mock('@/lib/regeneration/retryService')

const mockedRequire = requireAdminOrModerator as jest.MockedFunction<any>
const mockedMakeRetryService = makeRetryService as jest.MockedFunction<any>

describe('API retry execute double-run', () => {
  beforeEach(() => jest.resetAllMocks())

  test('second execute returns 409', async () => {
    mockedRequire.mockResolvedValue({ user: { id: 'admin1' } })

    // first call succeeds, second throws 'retry intent already executed'
    const createMock = jest.fn()
      .mockResolvedValueOnce({ id: 'job1' })
      .mockRejectedValueOnce(new Error('retry intent already executed'))

    mockedMakeRetryService.mockReturnValue({ createRetryJobFromIntent: createMock })

    // first execute
    const res1 = await POST_EXECUTE(new Request('http://localhost'), { params: { id: 'ri1' } } as any)
    expect([200, 400, 500]).toContain(res1.status)

    // second execute should map to 409
    const res2 = await POST_EXECUTE(new Request('http://localhost'), { params: { id: 'ri1' } } as any)
    expect(res2.status).toBe(409)
  })
})
