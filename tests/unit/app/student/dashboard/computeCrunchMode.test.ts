/**
 * Unit tests for computeCrunchMode dashboard helper.
 * F-STU-032 AC-04: Exam crunch mode activates when <= 14 days to exam.
 */

/** Mirror of the helper in dashboard/page.tsx -- pure function, tested independently. */
function computeCrunchMode(examDate: Date | null | undefined): boolean {
  if (!examDate) return false
  const daysToExam = Math.ceil((examDate.getTime() - Date.now()) / 86400000)
  return daysToExam >= 0 && daysToExam <= 14
}

describe('computeCrunchMode', () => {
  it('should return false when examDate is null', () => {
    expect(computeCrunchMode(null)).toBe(false)
  })

  it('should return false when examDate is undefined', () => {
    expect(computeCrunchMode(undefined)).toBe(false)
  })

  it('should return true when exam is today', () => {
    const today = new Date()
    expect(computeCrunchMode(today)).toBe(true)
  })

  it('should return true when exam is 14 days away', () => {
    const exam = new Date(Date.now() + 14 * 86400000)
    expect(computeCrunchMode(exam)).toBe(true)
  })

  it('should return false when exam is 15 days away', () => {
    const exam = new Date(Date.now() + 15 * 86400000)
    expect(computeCrunchMode(exam)).toBe(false)
  })

  it('should return false when exam has already passed', () => {
    const past = new Date(Date.now() - 86400000)
    expect(computeCrunchMode(past)).toBe(false)
  })
})
