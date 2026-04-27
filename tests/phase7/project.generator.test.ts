import { generateProject } from '@/lib/content/project/generator'
import { createMockLLM } from '@/lib/content/lesson/mockLLM'

const valid = {
  id: 'p1',
  syllabusId: 's1',
  moduleId: 'm1',
  title: 'Build a ToDo App',
  description: 'A practical project to build a todo app',
  problemStatement: 'Create a full-stack ToDo application implementing CRUD operations, user authentication, and persistent storage. The app must include pagination, search, and tests for core business logic. Provide deployment instructions and a short demo guide.'.repeat(2),
  constraints: ['Use TypeScript'],
  deliverables: [{ name: 'Source Code', description: 'Well structured repo' }],
  evaluationRubric: [
    { criteria: 'Functionality', weight: 50, expectations: 'Implements CRUD and auth' },
    { criteria: 'Code Quality', weight: 50, expectations: 'Clean, tested code' }
  ],
  difficulty: 'beginner'
}

test('valid mock LLM output succeeds', async () => {
  const llm = createMockLLM(JSON.stringify(valid))
  const out = await generateProject({ syllabusId: 's1', moduleId: 'm1', moduleTitle: 'M', learningObjectives: ['o1'] }, llm)
  expect(out.id).toBe('p1')
})

test('invalid JSON throws', async () => {
  const llm = createMockLLM('not-json')
  await expect(generateProject({ syllabusId: 's1', moduleId: 'm1', moduleTitle: 'M', learningObjectives: ['o1'] }, llm)).rejects.toThrow(/invalid JSON/i)
})

test('schema violation throws', async () => {
  const bad = { ...valid, evaluationRubric: [{ criteria: 'A', weight: 10, expectations: 'x' }] }
  const llm = createMockLLM(JSON.stringify(bad))
  await expect(generateProject({ syllabusId: 's1', moduleId: 'm1', moduleTitle: 'M', learningObjectives: ['o1'] }, llm)).rejects.toThrow(/Project validation failed/i)
})
