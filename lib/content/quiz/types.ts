export interface Quiz {
  lessonId: string
  questions: {
    question: string
    options: string[]
    correctIndex: number
    explanation: string
  }[]
}

export default Quiz
