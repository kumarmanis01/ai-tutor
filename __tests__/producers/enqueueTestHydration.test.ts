import { enqueueTestHydration } from '../../producers/enqueueTestHydration'

jest.mock('@/queues/contentQueue', () => ({
  getContentQueue: () => ({ add: jest.fn().mockResolvedValue({ id: 'jt' }) })
}))

describe('enqueueTestHydration', () => {
  test('enqueues a test job and returns job id', async () => {
    const id = await enqueueTestHydration('test-1')
    expect(id).toBeDefined()
  })
})
