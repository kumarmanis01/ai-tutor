import { validateProjectAssignment } from '@/lib/content/project/schema'

const valid = {
  id: 'p1',
  syllabusId: 's1',
  moduleId: 'm1',
  title: 'Build a ToDo App',
  description: 'A practical project to build a todo app',
  problemStatement: 'Create a full-stack ToDo application implementing CRUD operations, user authentication, and persistent storage. The app must include pagination, search, and tests for core business logic. Provide deployment instructions and a short demo guide.'.repeat(2),
  constraints: ['Use TypeScript', 'No external DB services'],
  deliverables: [{ name: 'Source Code', description: 'Well structured repo' }],
  evaluationRubric: [
    { criteria: 'Functionality', weight: 50, expectations: 'Implements CRUD and auth' },
    { criteria: 'Code Quality', weight: 50, expectations: 'Clean, tested code' }
  ],
  difficulty: 'beginner'
}

test('valid project passes validation', () => {
  expect(() => validateProjectAssignment(valid)).not.toThrow()
})

test('rubric weight != 100 fails', () => {
  const bad = { ...valid, evaluationRubric: [{ criteria: 'A', weight: 10, expectations: 'x' }, { criteria: 'B', weight: 20, expectations: 'y' }] }
  expect(() => validateProjectAssignment(bad)).toThrow()
})

test('empty deliverables fails', () => {
  const bad = { ...valid, deliverables: [] }
  expect(() => validateProjectAssignment(bad)).toThrow()
})
