import { prisma } from "@/lib/prisma"
import { callLLM } from "@/lib/callLLM"
import { toSlug } from "@/lib/slug"
import { isSystemSettingEnabled } from "@/lib/systemSettings"
import { logger } from "@/lib/logger"
import { JobStatus, ApprovalStatus } from '@/lib/ai-engine/types'

function validateSyllabusShape(raw: any) {
  if (!raw || typeof raw !== 'object') return false
  const { chapters } = raw
  if (!Array.isArray(chapters)) return false
  for (const ch of chapters) {
    if (!ch || typeof ch !== 'object') return false
    if (!ch.title || typeof ch.title !== 'string') return false
    if (ch.order !== undefined && typeof ch.order !== 'number') return false
    if (ch.topics !== undefined) {
      if (!Array.isArray(ch.topics)) return false
      for (const t of ch.topics) {
        if (!t || typeof t !== 'object') return false
        if (!t.title || typeof t.title !== 'string') return false
        if (t.order !== undefined && typeof t.order !== 'number') return false
      }
    }
  }
  return true
}

export async function handleSyllabusJob(jobId: string) {
  const claim = await prisma.hydrationJob.updateMany({
    where: { id: jobId, status: JobStatus.Pending },
    data: { status: JobStatus.Running, attempts: { increment: 1 } }
  })
  if (claim.count === 0) return

  const job = await prisma.hydrationJob.findUnique({ where: { id: jobId } })
  if (!job) return

  const paused = await prisma.systemSetting.findUnique({ where: { key: "HYDRATION_PAUSED" } })
  if (isSystemSettingEnabled(paused?.value)) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Pending } })
    return
  }

  const subjectId = (job as any).subjectId || null
  if (!subjectId) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: 'missing_subjectId' } })
    return
  }

  const existing = await prisma.chapterDef.findFirst({ where: { subjectId: subjectId as string, lifecycle: 'active' } })
  if (existing) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Completed } })
    return
  }

  const subjectRow = await prisma.subjectDef.findUnique({ where: { id: subjectId as string } })
  const board = job.board || ''
  const grade = job.grade || 0
  const subjectName = subjectRow?.name || job.subject || ''
  const language = job.language || 'en'

  const prompt = `You are an expert curriculum designer.

Generate an academic syllabus strictly aligned to:
Board: ${board}
Grade: ${grade}
Subject: ${subjectName}
Language: ${language}

Rules:
- Output JSON ONLY
- No explanations
- Chapters must be ordered
- Topics must be ordered
- Topics must be concise, age-appropriate, and non-overlapping
- Do NOT include assessments or activities
- Do NOT include subtopics
- Do NOT invent extra subjects

JSON Schema:
{
  "chapters": [
    {
      "title": "string",
      "order": number,
      "topics": [
        { "title": "string", "order": number }
      ]
    }
  ]
}
`

  let llmResponse: { content: string }
  try {
    llmResponse = await callLLM({ prompt, meta: { promptType: 'syllabus', board, grade, subject: subjectName, language } })
  } catch (err: any) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: err.message } })
    return
  }

  let parsed: any
  try {
    const raw = JSON.parse(llmResponse.content)
    if (!validateSyllabusShape(raw)) throw new Error('validation_failed')
    parsed = raw
  } catch (err: any) {
    if (typeof logger !== "undefined") {
      logger.error("Failed to parse LLM output in handleSyllabusJob", { jobId: job.id, error: err });
    }
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: 'invalid_llm_output' } })
    return
  }

  parsed.chapters.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
  for (const ch of parsed.chapters) {
    if (Array.isArray(ch.topics)) ch.topics.sort((x: any, y: any) => (x.order ?? 0) - (y.order ?? 0))
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const ch of parsed.chapters) {
        const slug = toSlug(ch.title)

        const exists = await tx.chapterDef.findFirst({ where: { subjectId: subjectId as string, slug } })
        if (exists) continue

        const chapter = await tx.chapterDef.create({
          data: {
            name: ch.title,
            slug,
            order: ch.order ?? 0,
            subjectId: subjectId as string,
            status: ApprovalStatus.Draft,
            lifecycle: 'active'
          }
        })

        if (Array.isArray(ch.topics)) {
          for (const t of ch.topics) {
            const tslug = toSlug(t.title)
            const texists = await tx.topicDef.findFirst({ where: { chapterId: chapter.id, slug: tslug } })
            if (texists) continue

            await tx.topicDef.create({
              data: {
                name: t.title,
                slug: tslug,
                order: t.order ?? 0,
                chapterId: chapter.id,
                status: ApprovalStatus.Draft,
                lifecycle: 'active'
              }
            })
          }
        }
      }
    })
  } catch (err: any) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: err.message } })
    return
  }

  await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Completed } })
}

export default handleSyllabusJob
