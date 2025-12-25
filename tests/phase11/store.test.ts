import { saveSuggestions, updateSuggestionStatus } from '@/insights/store'

describe('ContentSuggestion store', () => {
  const mockDb: any = {
    contentSuggestion: {
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'new', ...data })),
      findUnique: jest.fn().mockResolvedValue({ id: 'new', courseId: 'c1' }),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }))
    }
  }

  it('saves suggestions and audits', async () => {
    const suggestions = [{
      courseId: 'c1',
      scope: 'LESSON',
      targetId: 'l1',
      type: 'LOW_COMPLETION',
      severity: 'HIGH',
      message: 'test',
      evidenceJson: { x: 1 }
    }]
    const created = await saveSuggestions(mockDb, suggestions as any, 'actor1')
    expect(created.length).toBe(1)
    expect(mockDb.contentSuggestion.create).toHaveBeenCalled()
  })

  it('updates status only', async () => {
    const updated = await updateSuggestionStatus(mockDb, 'new', 'ACCEPTED', 'admin1')
    expect(updated.status).toBe('ACCEPTED')
    expect(mockDb.contentSuggestion.update).toHaveBeenCalled()
    // ensure only the status field is sent in the update payload
    const callArg = mockDb.contentSuggestion.update.mock.calls[0][0]
    expect(callArg).toHaveProperty('where')
    expect(callArg).toHaveProperty('data')
    expect(Object.keys(callArg.data)).toEqual(['status'])
  })
})
