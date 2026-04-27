import { validateCoursePackage } from './schema'
import { ApprovalMetadata } from '../../content/approval/types'
import Lesson from '../../content/lesson/types'
import Quiz from '../../content/quiz/types'
import ProjectAssignment from '../../content/project/types'

type InputItem<T> = T & { approval?: ApprovalMetadata }

export function buildCoursePackage(params: {
  id: string
  syllabus: { id: string; title: string; description?: string; approval?: ApprovalMetadata }
  lessons: Array<InputItem<Lesson>>
  quizzes: Array<InputItem<Quiz>>
  projects: Array<InputItem<ProjectAssignment>>
  previousVersion?: number
}): ReturnType<typeof validateCoursePackage> {
  const { id, syllabus, lessons, quizzes, projects, previousVersion } = params

  // Ensure syllabus approved
  if (!syllabus.approval || syllabus.approval.status !== 'APPROVED') {
    throw new Error('Syllabus must be APPROVED to build a CoursePackage')
  }

  // Ensure all content approved
  const notApproved = (items: Array<InputItem<any>>) => items.find((it) => !it.approval || it.approval.status !== 'APPROVED')
  if (notApproved(lessons)) throw new Error('All lessons must be APPROVED')
  if (notApproved(quizzes)) throw new Error('All quizzes must be APPROVED')
  if (notApproved(projects)) throw new Error('All projects must be APPROVED')

  // Group by moduleId
  const modulesMap = new Map<
    string,
    { moduleId: string; title: string; lessons: Lesson[]; quizzes?: Quiz[]; projects?: ProjectAssignment[] }
  >()

  function addLesson(item: InputItem<Lesson>) {
    const moduleId = item.moduleId
    const title = (item as any).moduleTitle || item.moduleId || 'module'
    const entry =
      (modulesMap.get(moduleId) as { moduleId: string; title: string; lessons: Lesson[]; quizzes?: Quiz[]; projects?: ProjectAssignment[] }) ||
      ({ moduleId, title, lessons: [] as Lesson[], quizzes: [] as Quiz[], projects: [] as ProjectAssignment[] })
    entry.lessons.push(item)
    modulesMap.set(moduleId, entry)
  }

  function addQuiz(item: InputItem<Quiz>) {
    const moduleId = (item as any).moduleId || ((item as any).lessonId && (item as any).lessonId)
    const title = (item as any).moduleTitle || moduleId || 'module'
    const entry =
      (modulesMap.get(moduleId) as { moduleId: string; title: string; lessons: Lesson[]; quizzes?: Quiz[]; projects?: ProjectAssignment[] }) ||
      ({ moduleId, title, lessons: [] as Lesson[], quizzes: [] as Quiz[], projects: [] as ProjectAssignment[] })
    entry.quizzes = entry.quizzes || []
    entry.quizzes.push(item)
    modulesMap.set(moduleId, entry)
  }

  function addProject(item: InputItem<ProjectAssignment>) {
    const moduleId = item.moduleId
    const title = (item as any).moduleTitle || item.moduleId || 'module'
    const entry =
      (modulesMap.get(moduleId) as { moduleId: string; title: string; lessons: Lesson[]; quizzes?: Quiz[]; projects?: ProjectAssignment[] }) ||
      ({ moduleId, title, lessons: [] as Lesson[], quizzes: [] as Quiz[], projects: [] as ProjectAssignment[] })
    entry.projects = entry.projects || []
    entry.projects.push(item)
    modulesMap.set(moduleId, entry)
  }

  lessons.forEach((l) => addLesson(l))
  quizzes.forEach((q) => addQuiz(q))
  projects.forEach((p) => addProject(p))

  const modules = Array.from(modulesMap.values())

  if (modules.length < 1) throw new Error('CoursePackage must have at least one module')

  // Ensure each module has at least 1 lesson and at least 1 quiz or project
  for (const m of modules) {
    if (!m.lessons || m.lessons.length < 1) throw new Error(`Module ${m.moduleId} must have at least one lesson`)
    if ((m.quizzes?.length || 0) + (m.projects?.length || 0) < 1) throw new Error(`Module ${m.moduleId} must have at least one quiz or project`)
  }

  const version = (typeof previousVersion === 'number' ? previousVersion : 0) + 1

  const pkg = {
    id,
    syllabusId: syllabus.id,
    version,
    title: syllabus.title,
    description: syllabus.description,
    modules: modules.map((m) => ({ moduleId: m.moduleId, title: m.title, lessons: m.lessons, quizzes: (m.quizzes || []) as Quiz[], projects: (m.projects || []) as ProjectAssignment[] })),
    createdAt: new Date().toISOString(),
    frozen: true
  }

  // Validate output
  return validateCoursePackage(pkg)
}

export default buildCoursePackage
