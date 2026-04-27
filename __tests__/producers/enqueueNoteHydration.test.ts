import { enqueueNoteHydration } from '../../producers/enqueueNoteHydration'

jest.mock('@/queues/contentQueue', () => ({
  getContentQueue: () => ({ add: jest.fn().mockResolvedValue({ id: 'jn' }) })
}))

describe('enqueueNoteHydration', () => {
  test('enqueues a note job and returns job id', async () => {
    const id = await enqueueNoteHydration('note-1')
    expect(id).toBeDefined()
  })
})
