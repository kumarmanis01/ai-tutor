export interface ProjectAssignment {
  id: string
  syllabusId: string
  moduleId: string

  title: string
  description: string

  problemStatement: string

  constraints: string[]

  deliverables: {
    name: string
    description: string
  }[]

  evaluationRubric: {
    criteria: string
    weight: number
    expectations: string
  }[]

  difficulty: "beginner" | "intermediate" | "advanced"
}

export default ProjectAssignment
