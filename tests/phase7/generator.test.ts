import { generateLessons } from '@/lib/content/lesson/generator'
import { createMockLLM } from '@/lib/content/lesson/mockLLM'

const validLesson = {
  id: 'lesson-1',
  syllabusId: 'syllabus-1',
  moduleId: 'module-1',
  lessonIndex: 1,
  title: 'Intro to Generation',
  durationMinutes: 20,
  objectives: ['Understand generation'],
  explanation: {
    overview: 'Overview '.repeat(10),
    concepts: [
      { title: 'Concept 1', explanation: 'Deep explanation '.repeat(10) }
    ]
  },
  keyTakeaways: ['Takeaway 1', 'Takeaway 2'],
  practice: { prompt: 'Practice prompt describing the coding task in detail.'.repeat(2), expectedOutcome: 'Expected outcome describing what success looks like in detail.'.repeat(2) },
  metadata: { level: 'beginner' }
}

test('valid generation returns lessons', async () => {
  const resp = JSON.stringify([validLesson])
  const llm = createMockLLM(resp)
  const out = await generateLessons({
    syllabusId: 's1',
    moduleId: 'm1',
    moduleTitle: 'Module',
    learningObjectives: ['obj1'],
    lessonCount: 1
  }, llm)
  expect(Array.isArray(out)).toBe(true)
  expect(out[0].id).toBe(validLesson.id)
})

test('invalid JSON from LLM throws', async () => {
  const llm = createMockLLM('not-json')
  await expect(generateLessons({
    syllabusId: 's1',
    moduleId: 'm1',
    moduleTitle: 'Module',
    learningObjectives: ['obj1'],
    lessonCount: 1
  }, llm)).rejects.toThrow(/invalid JSON/i)
})

test('schema violation throws', async () => {
  const bad = { ...validLesson }
  // @ts-expect-error remove explanation to violate schema
  delete bad.explanation
  const llm = createMockLLM(JSON.stringify([bad]))
  await expect(generateLessons({
    syllabusId: 's1',
    moduleId: 'm1',
    moduleTitle: 'Module',
    learningObjectives: ['obj1'],
    lessonCount: 1
  }, llm)).rejects.toThrow(/failed validation/i)
})
