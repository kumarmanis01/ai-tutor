export interface Lesson {
  id: string
  syllabusId: string
  moduleId: string
  lessonIndex: number

  title: string
  durationMinutes: number

  objectives: string[]

  explanation: {
    overview: string
    concepts: {
      title: string
      explanation: string
      example?: string
    }[]
  }

  keyTakeaways: string[]

  practice: {
    prompt: string
    expectedOutcome: string
  }

  metadata: {
    level: "beginner" | "intermediate" | "advanced"
    prerequisites?: string[]
  }
}

export default Lesson
