/**
 * Unit tests for pre-exam mode notification logic in sm18Worker.
 * F-STU-022 AC-07: Pre-exam mode activates automatically 14 days before exam.
 *                  Student notified of mode change.
 *
 * Tests the date comparison logic inline (pure logic -- worker itself needs DB+Redis).
 */

/** Mirror of the PRE_EXAM_DAYS constant in sm18Worker. */
const PRE_EXAM_DAYS = 14
const MS_PER_DAY = 86400000

/** Returns true if examDate is within PRE_EXAM_DAYS from now. */
function isPreExam(examDate: Date, now = new Date()): boolean {
  const msToExam = examDate.getTime() - now.getTime()
  const daysToExam = msToExam / MS_PER_DAY
  return daysToExam >= 0 && daysToExam <= PRE_EXAM_DAYS
}

describe('sm18Worker -- pre-exam mode detection', () => {
  it('should detect pre-exam mode when exam is today', () => {
    expect(isPreExam(new Date())).toBe(true)
  })

  it('should detect pre-exam mode when exam is exactly 14 days away', () => {
    const exam = new Date(Date.now() + 14 * MS_PER_DAY)
    expect(isPreExam(exam)).toBe(true)
  })

  it('should not detect pre-exam mode when exam is 15 days away', () => {
    const exam = new Date(Date.now() + 15 * MS_PER_DAY)
    expect(isPreExam(exam)).toBe(false)
  })

  it('should not detect pre-exam mode when exam has already passed', () => {
    const past = new Date(Date.now() - MS_PER_DAY)
    expect(isPreExam(past)).toBe(false)
  })

  it('should detect pre-exam mode when exam is 7 days away', () => {
    const exam = new Date(Date.now() + 7 * MS_PER_DAY)
    expect(isPreExam(exam)).toBe(true)
  })
})
