import { enqueueTopicHydration } from '../../producers/enqueueTopicHydration'

jest.mock('@/queues/contentQueue', () => ({
  getContentQueue: () => ({ add: jest.fn().mockResolvedValue({ id: 'jid' }) })
}))

describe('enqueueTopicHydration', () => {
  test('enqueues multiple jobs and returns job ids', async () => {
    const ids = await enqueueTopicHydration('topic-1')
    expect(Array.isArray(ids)).toBe(true)
    expect(ids.length).toBeGreaterThanOrEqual(1)
  })
})
