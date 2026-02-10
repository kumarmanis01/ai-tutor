/**
 * FILE OBJECTIVE:
 * - API endpoint to fetch a single lesson/chapter content with hydrated notes.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/learn/courses/courseId/lessons/index/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | added fallback to ChapterDef when CoursePackage not found
 * - 2026-01-22 | copilot | fetch TopicNote content for real lesson content instead of placeholders
 * - 2026-01-23 | copilot | updated transformer to handle enhanced schema (sections, keyTerms, practiceQuestions, etc.)
 */
import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'

/**
 * Enhanced content type for new schema
 */
interface EnhancedNoteContent {
  introduction?: string;
  learningObjectives?: string[];
  sections?: { heading: string; explanation: string; keyTakeaway?: string; visualSuggestion?: string }[];
  keyTerms?: { term: string; definition: string; example?: string }[];
  realWorldExamples?: { scenario: string; connection: string }[];
  practiceQuestions?: { question: string; type?: string; hint?: string; answer: string }[];
  commonMistakes?: { mistake: string; correction: string }[];
  summary?: string;
  funFact?: string;
  relatedTopics?: string[];
  studyTips?: string[];
  // Legacy fields
  keyPoints?: string[];
  definitions?: { term: string; definition: string }[];
  examples?: string[];
}

/**
 * Transform TopicNote contentJson to lesson explanation format
 * Supports both old schema (summary/keyPoints/definitions/examples)
 * and new enhanced schema (introduction/sections/keyTerms/etc)
 */
function transformNoteToLesson(
  noteContent: { title?: string; content?: EnhancedNoteContent } & Partial<EnhancedNoteContent>,
  chapterName: string,
  topicName: string
) {
  // Support both wrapped { content: { summary, sections, ... } } and flat { summary, sections, ... }
  const content: EnhancedNoteContent = noteContent?.content && typeof noteContent.content === 'object'
    ? noteContent.content
    : (noteContent as EnhancedNoteContent) ?? {}
  
  // Detect if using new enhanced schema (has 'sections' or 'introduction')
  const isEnhancedSchema = !!(content.sections || content.introduction)
  
  if (isEnhancedSchema) {
    return transformEnhancedNote(content, chapterName, topicName)
  }
  
  // Legacy schema transformation
  return transformLegacyNote(content, chapterName, topicName)
}

/**
 * Transform new enhanced schema to lesson format
 */
function transformEnhancedNote(content: EnhancedNoteContent, chapterName: string, topicName: string) {
  const concepts: { title: string; explanation: string; example?: string; keyTakeaway?: string; visualSuggestion?: string }[] = []
  
  // Add sections as main concepts
  if (content.sections && content.sections.length > 0) {
    content.sections.forEach(section => {
      concepts.push({
        title: section.heading,
        explanation: section.explanation,
        keyTakeaway: section.keyTakeaway,
        visualSuggestion: section.visualSuggestion
      })
    })
  }
  
  // Add key terms as vocabulary concepts
  if (content.keyTerms && content.keyTerms.length > 0) {
    content.keyTerms.forEach(term => {
      concepts.push({
        title: `📖 ${term.term}`,
        explanation: term.definition,
        example: term.example
      })
    })
  }
  
  // Add real-world examples
  if (content.realWorldExamples && content.realWorldExamples.length > 0) {
    content.realWorldExamples.forEach((ex, i) => {
      concepts.push({
        title: `🌍 Real World Example ${i + 1}`,
        explanation: `${ex.scenario}\n\n**Connection:** ${ex.connection}`
      })
    })
  }
  
  // Fallback if no concepts
  if (concepts.length === 0) {
    concepts.push({
      title: `Introduction to ${topicName}`,
      explanation: content.introduction || content.summary || `Learn about ${topicName} in ${chapterName}.`
    })
  }
  
  return {
    overview: content.introduction || content.summary || `Welcome to ${topicName}!`,
    learningObjectives: content.learningObjectives || [],
    concepts,
    practiceQuestions: content.practiceQuestions || [],
    commonMistakes: content.commonMistakes || [],
    summary: content.summary,
    funFact: content.funFact,
    relatedTopics: content.relatedTopics || [],
    studyTips: content.studyTips || []
  }
}

/**
 * Transform legacy schema (summary/keyPoints/definitions/examples)
 */
function transformLegacyNote(content: EnhancedNoteContent, chapterName: string, topicName: string) {
  const summary = content.summary || `Learn about ${topicName} in ${chapterName}.`
  const keyPoints = content.keyPoints || []
  const definitions = content.definitions || []
  const examples = content.examples || []

  const concepts: { title: string; explanation: string; example?: string }[] = []

  // Add key points as concepts
  keyPoints.forEach((point, i) => {
    concepts.push({
      title: `Key Concept ${i + 1}`,
      explanation: point
    })
  })

  // Add definitions as concepts
  definitions.forEach(def => {
    concepts.push({
      title: def.term,
      explanation: def.definition
    })
  })

  // If we have examples, add them to concepts
  examples.forEach((ex, i) => {
    if (concepts[i]) {
      concepts[i].example = ex
    } else {
      concepts.push({
        title: `Example ${i + 1}`,
        explanation: ex
      })
    }
  })

  // Ensure at least one concept
  if (concepts.length === 0) {
    concepts.push({
      title: `Introduction to ${topicName}`,
      explanation: summary
    })
  }

  return {
    overview: summary,
    concepts
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ courseId: string; index: string }> }) {
  const { courseId, index } = await params
  const idx = Number(index)
  if (Number.isNaN(idx)) return NextResponse.json({ error: 'Invalid index' }, { status: 400 })

  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma

  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id ?? null

  // First try CoursePackage
  const row = await db.coursePackage.findFirst({
     where: { syllabusId: courseId, status: 'PUBLISHED' },
     orderBy: { version: 'desc' }
  })

  if (row) {
    const { hasLearnerAccess } = await import('../../../../../../../lib/guards/access')
    const allowed = await hasLearnerAccess(db, userId, courseId, session?.user?.tenantId ?? null)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const pkg = row.json as any
    const lessons: any[] = []
    if (Array.isArray(pkg.modules)) {
      for (const m of pkg.modules) {
        if (Array.isArray(m.lessons)) {
          for (const l of m.lessons) lessons.push(l)
        }
      }
    }

    // Treat index as 1-based lessonIndex match first, else as array index (0-based)
    let found = lessons.find((l: any) => Number(l.lessonIndex) === idx)
    if (!found) found = lessons[idx]

    if (!found) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    // Learners must only see the promoted PublishedOutput. If none exists,
    // return 404 (not published).
    try {
      const { resolvePublishedOutputForScope } = await import('../../../../../../../lib/promotion/reader')
      const scopeRefIdCandidate = found.id ?? `${courseId}:${found.lessonIndex ?? idx}`
      const resolved = await resolvePublishedOutputForScope(db, 'LESSON', scopeRefIdCandidate)
      if (resolved && resolved.output && resolved.output.contentJson) {
        return NextResponse.json(resolved.output.contentJson)
      }
      return NextResponse.json({ error: 'Lesson not published' }, { status: 404 })
    } catch {
      return NextResponse.json({ error: 'Lesson not published' }, { status: 404 })
    }
  }

  // Fallback: Try SubjectDef with ChapterDef and fetch actual content from TopicNote
  const subject = await db.subjectDef.findUnique({
    where: { id: courseId },
    include: {
      chapters: {
        where: { lifecycle: 'active' },
        orderBy: { order: 'asc' },
        include: {
          topics: {
            where: { lifecycle: 'active' },
            orderBy: { order: 'asc' },
            include: {
              notes: {
                where: { 
                  OR: [
                    { status: 'approved' },
                    { status: 'draft' } // Fall back to draft if no approved
                  ]
                },
                orderBy: [
                  { status: 'asc' }, // 'approved' comes before 'draft'
                  { version: 'desc' }
                ],
                take: 1
              }
            }
          }
        }
      }
    }
  })

  if (subject && subject.chapters && subject.chapters.length > idx) {
    const chapter = subject.chapters[idx]
    
    // Collect all topics with notes for this chapter
    const topicsWithContent = chapter.topics.filter(
      (t: { notes?: { contentJson?: unknown }[] }) => t.notes && t.notes.length > 0
    )

    // If we have generated content, use it
    if (topicsWithContent.length > 0) {
      // Combine all topic notes into a comprehensive lesson
      const allConcepts: { title: string; explanation: string; example?: string }[] = []
      const overviewParts: string[] = []

      for (const topic of topicsWithContent) {
        const note = topic.notes[0]
        if (note && note.contentJson) {
          const transformed = transformNoteToLesson(
            note.contentJson as { title?: string; content?: { summary?: string; keyPoints?: string[]; definitions?: { term: string; definition: string }[]; examples?: string[] } },
            chapter.name,
            topic.name
          )
          overviewParts.push(transformed.overview)
          allConcepts.push(...transformed.concepts)
        }
      }

      return NextResponse.json({
        id: chapter.id,
        lessonIndex: idx,
        title: chapter.name,
        slug: chapter.slug,
        objectives: topicsWithContent.map((t: { name: string }) => `Understand ${t.name}`),
        explanation: {
          overview: overviewParts.join('\n\n') || `Welcome to ${chapter.name}! This chapter is part of ${subject.name}.`,
          concepts: allConcepts.length > 0 ? allConcepts : [{
            title: `Introduction to ${chapter.name}`,
            explanation: `This chapter covers key concepts in ${chapter.name.toLowerCase()}.`
          }]
        },
        metadata: {
          topicCount: chapter.topics.length,
          contentSource: 'hydrated'
        }
      })
    }
    
    // No generated content yet - return informative placeholder
    return NextResponse.json({
      id: chapter.id,
      lessonIndex: idx,
      title: chapter.name,
      slug: chapter.slug,
      objectives: [`Learn about ${chapter.name}`],
      explanation: {
        overview: `Welcome to ${chapter.name}! This chapter is part of ${subject.name}.`,
        concepts: [
          {
            title: `${chapter.name} Overview`,
            explanation: `This chapter covers ${chapter.topics?.length || 0} topics. Content is being generated by our AI tutors. Please check back soon or contact your administrator to run the content hydration process.`
          }
        ]
      },
      metadata: {
        topicCount: chapter.topics?.length || 0,
        contentSource: 'pending',
        hint: 'Run HydrateAll from admin panel to generate content'
      }
    })
  }

  return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
}

export default GET
