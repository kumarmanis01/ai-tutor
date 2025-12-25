import { generateLessons } from '@/lib/content/lesson/generator'
import generateQuizFromLesson from '@/lib/content/quiz/generator'
import generateProject from '@/lib/content/project/generator'
import { callLLM } from '@/lib/callLLM'

export type RegenerationJobShape = {
  id: string
  suggestionId: string
  targetType: 'LESSON' | 'QUIZ' | 'PROJECT' | 'MODULE'
  targetId: string
  instructionJson: any
}

export type GeneratorOutput = {
  validated: boolean
  outputJson: any
}

function makeLLMAdapter(meta?: any) {
  return {
    async generate(prompt: string) {
      // callLLM enforces worker-only LLM access; bubble the error upward
      const resp = await callLLM({ prompt, meta })
      return resp.content
    },
  }
}

export default async function generatorAdapter(job: RegenerationJobShape): Promise<GeneratorOutput> {
  const instr = job.instructionJson || {}

  switch (job.targetType) {
    case 'LESSON': {
      // required fields for lesson generation
      const { syllabusId, moduleId, moduleTitle, learningObjectives, lessonCount } = instr
      if (!syllabusId || !moduleId || !moduleTitle || !Array.isArray(learningObjectives) || !lessonCount) {
        throw new Error('instructionJson missing required fields for LESSON generation')
      }

      const llm = makeLLMAdapter({ promptType: 'regeneration.lesson', jobId: job.id })
      const lessons = await generateLessons({ syllabusId, moduleId, moduleTitle, learningObjectives, lessonCount }, llm)
      return { validated: true, outputJson: lessons }
    }

    case 'QUIZ': {
      // quiz generator expects a lesson-like shape
      const lesson = instr.lesson
      if (!lesson || !lesson.lessonId || !lesson.title || !Array.isArray(lesson.objectives)) {
        throw new Error('instructionJson.lesson missing required fields for QUIZ generation')
      }
      const llm = makeLLMAdapter({ promptType: 'regeneration.quiz', jobId: job.id })
      const quiz = await generateQuizFromLesson(lesson, llm)
      return { validated: true, outputJson: quiz }
    }

    case 'PROJECT': {
      const { syllabusId, moduleId, moduleTitle, learningObjectives } = instr
      if (!syllabusId || !moduleId || !moduleTitle || !Array.isArray(learningObjectives)) {
        throw new Error('instructionJson missing required fields for PROJECT generation')
      }
      const llm = makeLLMAdapter({ promptType: 'regeneration.project', jobId: job.id })
      const project = await generateProject({ syllabusId, moduleId, moduleTitle, learningObjectives }, llm)
      return { validated: true, outputJson: project }
    }

    case 'MODULE': {
      // For MODULE we don't have a direct generator in Phase 7; return instruction for later handling
      throw new Error('MODULE regeneration not implemented')
    }

    default:
      throw new Error('Unsupported targetType')
  }
}
