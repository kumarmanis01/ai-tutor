import buildCoursePackage from '@/lib/course/package/builder'
import { approveContent, resetApprovalStore } from '@/lib/content/approval/service'

beforeEach(() => {
  resetApprovalStore()
})

const syllabus = { id: 's1', title: 'Course', description: 'Desc' }

function approvedAt(id: string) {
  return approveContent({ contentId: id, approver: 'sys' })
}

test('happy path builds valid package', () => {
  approvedAt('s1')
  const lesson = { id: 'l1', syllabusId: 's1', moduleId: 'm1', moduleTitle: 'M1', title: 'Lesson One', lessonIndex: 1, durationMinutes: 10, objectives: ['o'], explanation: { overview: 'o'.repeat(80), concepts: [{ title: 'Concept A', explanation: 'e'.repeat(80) }] }, keyTakeaways: ['t1','t2'], practice: { prompt: 'p'.repeat(30), expectedOutcome: 'o'.repeat(30) }, metadata: { level: 'beginner' }, approval: approvedAt('l1') } as any
  const quiz = { lessonId: 'l1', questions: [{ question: 'What is the core idea?', options: ['A','B','C','D'], correctIndex: 0, explanation: 'e'.repeat(10) }], moduleId: 'm1', moduleTitle: 'M1', approval: approvedAt('q1') }
  const project = { id: 'p1', syllabusId: 's1', moduleId: 'm1', moduleTitle: 'M1', title: 'Project One', description: 'A sample project description', problemStatement: 'p'.repeat(80), constraints: ['c'], deliverables: [{ name: 'd', description: 'desc' }], evaluationRubric: [{ criteria: 'critA', weight: 50, expectations: 'Meets expectations' }, { criteria: 'critB', weight: 50, expectations: 'Exceeds expectations' }], difficulty: 'beginner', approval: approvedAt('p1') } as any

  const pkg = buildCoursePackage({ id: 'pkg1', syllabus: { ...syllabus, approval: { status: 'APPROVED' } }, lessons: [lesson], quizzes: [quiz], projects: [project], previousVersion: 0 })
  expect(pkg.version).toBe(1)
  expect(pkg.frozen).toBe(true)
  expect(pkg.modules.length).toBe(1)
})

test('unapproved lesson throws', () => {
  approvedAt('s1')
  const lesson = { id: 'l2', syllabusId: 's1', moduleId: 'm1', moduleTitle: 'M1', title: 'Lesson Two', lessonIndex: 1, durationMinutes: 10, objectives: ['o'], explanation: { overview: 'o'.repeat(80), concepts: [{ title: 'Concept B', explanation: 'e'.repeat(80) }] }, keyTakeaways: ['t1','t2'], practice: { prompt: 'p'.repeat(30), expectedOutcome: 'o'.repeat(30) }, metadata: { level: 'beginner' } } as any
  const quiz = { lessonId: 'l2', questions: [{ question: 'Q?', options: ['A','B','C','D'], correctIndex: 0, explanation: 'e'.repeat(10) }], moduleId: 'm1', moduleTitle: 'M1', approval: approvedAt('q2') }
  expect(() => buildCoursePackage({ id: 'pkg2', syllabus: { ...syllabus, approval: { status: 'APPROVED' } }, lessons: [lesson], quizzes: [quiz], projects: [], previousVersion: 0 })).toThrow(/All lessons must be APPROVED/)
})

test('empty module throws', () => {
  approvedAt('s1')
  const lesson = { id: 'l3', syllabusId: 's1', moduleId: 'm2', moduleTitle: 'M2', title: 'Lesson Three', lessonIndex: 1, durationMinutes: 10, objectives: ['o'], explanation: { overview: 'o'.repeat(80), concepts: [{ title: 'Concept C', explanation: 'e'.repeat(80) }] }, keyTakeaways: ['t1','t2'], practice: { prompt: 'p'.repeat(30), expectedOutcome: 'o'.repeat(30) }, metadata: { level: 'beginner' }, approval: approvedAt('l3') } as any
  // Module m2 will have lesson but no quiz/project -> should throw
  expect(() => buildCoursePackage({ id: 'pkg3', syllabus: { ...syllabus, approval: { status: 'APPROVED' } }, lessons: [lesson], quizzes: [], projects: [], previousVersion: 0 })).toThrow(/must have at least one quiz or project/)
})

test('schema violation throws (version 0)', () => {
  approvedAt('s1')
  const lesson = { id: 'l4', syllabusId: 's1', moduleId: 'm3', moduleTitle: 'M3', title: 'Lesson Four', lessonIndex: 1, durationMinutes: 10, objectives: ['o'], explanation: { overview: 'o'.repeat(80), concepts: [{ title: 'Concept D', explanation: 'e'.repeat(80) }] }, keyTakeaways: ['t1','t2'], practice: { prompt: 'p'.repeat(30), expectedOutcome: 'o'.repeat(30) }, metadata: { level: 'beginner' }, approval: approvedAt('l4') } as any
  const quiz = { lessonId: 'l4', questions: [{ question: 'Q?', options: ['A','B','C','D'], correctIndex: 0, explanation: 'e'.repeat(10) }], moduleId: 'm3', moduleTitle: 'M3', approval: approvedAt('q3') }
  // pass previousVersion = -1 to make version 0 which violates schema
  expect(() => buildCoursePackage({ id: 'pkg4', syllabus: { ...syllabus, approval: { status: 'APPROVED' } }, lessons: [lesson], quizzes: [quiz], projects: [], previousVersion: -1 })).toThrow()
})
