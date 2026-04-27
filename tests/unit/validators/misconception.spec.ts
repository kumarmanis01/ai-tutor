import { MisconceptionCreateSchema, MisconceptionPatchSchema } from '../../../lib/validators/misconception'

describe('misconception validators', () => {
  test('create schema rejects missing fields', () => {
    const res = MisconceptionCreateSchema.safeParse({ name: 'x' })
    expect(res.success).toBe(false)
  })

  test('create schema rejects small triggerPatterns', () => {
    const res = MisconceptionCreateSchema.safeParse({ name: 'n', correction: 'c', triggerPatterns: ['onlyone'], subjectId: 's', conceptId: 'c' })
    expect(res.success).toBe(false)
  })

  test('patch schema accepts empty object', () => {
    const res = MisconceptionPatchSchema.safeParse({})
    expect(res.success).toBe(true)
  })

  test('patch schema rejects invalid prevalenceRate', () => {
    const res = MisconceptionPatchSchema.safeParse({ prevalenceRate: 2 })
    expect(res.success).toBe(false)
  })
})
