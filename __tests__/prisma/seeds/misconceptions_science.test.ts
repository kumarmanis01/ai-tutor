import { MISCONCEPTIONS_SCIENCE_GRADE10 } from '../../../prisma/seeds/misconceptions_cbse_grade10_science'

describe('science misconceptions seed', () => {
  test('exports 20 science misconceptions', () => {
    expect(Array.isArray(MISCONCEPTIONS_SCIENCE_GRADE10)).toBe(true)
    expect(MISCONCEPTIONS_SCIENCE_GRADE10.length).toBeGreaterThanOrEqual(20)
    const sample = MISCONCEPTIONS_SCIENCE_GRADE10[0]
    expect(sample).toHaveProperty('id')
    expect(sample).toHaveProperty('subjectId')
    expect(sample).toHaveProperty('conceptId')
    expect(sample).toHaveProperty('name')
  })
})
