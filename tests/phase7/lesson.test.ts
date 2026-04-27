import { validateLesson } from '@/lib/content/lesson/schema'

describe('Lesson schema validation', () => {
  const validLesson = {
    id: 'lesson-1',
    syllabusId: 'syllabus-1',
    moduleId: 'module-1',
    lessonIndex: 1,
    title: 'Introduction to Testing',
    durationMinutes: 15,
    objectives: ['Understand basics', 'Write tests'],
    explanation: {
      overview: 'This lesson introduces testing fundamentals and why tests matter. '.repeat(3),
      concepts: [
        {
          title: 'Unit tests',
          explanation: 'Unit tests validate small units of code and are fast to run. '.repeat(5),
          example: 'Example showing an assertion'
        }
      ]
    },
    keyTakeaways: ['Tests catch bugs', 'Write small tests'],
    practice: {
      prompt: 'Write a unit test for a function that adds two numbers.',
      expectedOutcome: 'A passing unit test that asserts the sum is correct.'
    },
    metadata: {
      level: 'beginner'
    }
  }

  test('valid lesson passes validation', () => {
    expect(() => validateLesson(validLesson)).not.toThrow()
  })

  test('missing explanation fails validation', () => {
    const bad = { ...validLesson }
    // @ts-expect-error - intentionally remove required field for negative test
    delete bad.explanation
    expect(() => validateLesson(bad)).toThrow()
  })

  test('empty objectives fails validation', () => {
    const bad = { ...validLesson, objectives: [] }
    expect(() => validateLesson(bad)).toThrow()
  })
})
