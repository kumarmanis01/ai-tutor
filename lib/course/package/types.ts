import Lesson from '../../content/lesson/types'
import Quiz from '../../content/quiz/types'
import ProjectAssignment from '../../content/project/types'

export interface CourseModule {
  moduleId: string
  title: string

  lessons: Lesson[]
  quizzes?: Quiz[]
  projects?: ProjectAssignment[]
}

export interface CoursePackage {
  id: string
  syllabusId: string
  version: number

  title: string
  description?: string

  modules: CourseModule[]

  createdAt: string
  frozen: true
}

export default CoursePackage
