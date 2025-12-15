/**
 * COPILOT RULES — SYLLABUS WORKER
 *
 * - Worker executes ONE HydrationJob at a time
 * - Input source = HydrationJob row ONLY
 * - Must re-check idempotency before generating
 * - Must NOT mutate existing chapters or topics
 * - Must create ChapterDef + TopicDef as DRAFT
 * - Must wrap all DB writes in a transaction
 * - Must write AIContentLog for every AI call
 * - Must mark job as completed or failed (never hang)
 * - ApprovalStatus MUST remain draft
 */

import { prisma } from "@/lib/prisma"
import { callLLM } from "@/lib/callLLM"
import { toSlug } from "@/lib/slug"
import { isSystemSettingEnabled } from "@/lib/systemSettings"
import { logger } from "@/lib/logger"
// Lightweight runtime validator for syllabus JSON (avoids adding zod dependency)
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

/* Removed unused JobRow type */

export async function handleSyllabusJob(jobId: string) {
  // Atomically claim the job: pending -> running
  const claim = await prisma.hydrationJob.updateMany({
    where: { id: jobId, status: 'pending' },
    data: { status: 'running', attempts: { increment: 1 } }
  })
  if (claim.count === 0) {
    // already claimed or not pending
    return
  }

  // Load claimed job
  const job = await prisma.hydrationJob.findUnique({ where: { id: jobId } })
  if (!job) return

  // Respect global pause flag — revert to pending and exit if paused
  const paused = await prisma.systemSetting.findUnique({ where: { key: "HYDRATION_PAUSED" } })
  if (isSystemSettingEnabled(paused?.value)) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: 'pending' } })
    return
  }

  // Ensure subjectId exists on job
  const subjectId = (job as any).subjectId || null
  if (!subjectId) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: 'failed', lastError: 'missing_subjectId' } })
    return
  }

  // Re-check idempotency: if any active chapter exists for this subject, mark completed and return
  const existing = await prisma.chapterDef.findFirst({ where: { subjectId: subjectId as string, lifecycle: 'active' } })
  if (existing) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: 'completed' } })
    return
  }

  // Fetch subject name for prompt
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

  // Call LLM (callLLM writes AIContentLog)
  let llmResponse: { content: string }
  try {
    llmResponse = await callLLM({ prompt, meta: { promptType: 'syllabus', board, grade, subject: subjectName, language } })
  } catch (err: any) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: 'failed', lastError: err.message } })
    return
  }

  // Parse and validate via lightweight validator
  let parsed: any
  try {
    const raw = JSON.parse(llmResponse.content)
    if (!validateSyllabusShape(raw)) throw new Error('validation_failed')
    parsed = raw
  } catch (err: any) {
    // Log error using project's logger utility
    if (typeof logger !== "undefined") {
      logger.error("Failed to parse LLM output in handleSyllabusJob", { jobId: job.id, error: err });
    }
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: 'failed', lastError: 'invalid_llm_output' } })
    return
  }

  // Enforce deterministic ordering
  parsed.chapters.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
  for (const ch of parsed.chapters) {
    if (Array.isArray(ch.topics)) ch.topics.sort((x: any, y: any) => (x.order ?? 0) - (y.order ?? 0))
  }

  // Transactionally create chapters and topics as DRAFT
  try {
    await prisma.$transaction(async (tx) => {
      for (const ch of parsed.chapters) {
        const slug = toSlug(ch.title)

        // Ensure we do not mutate existing chapters
        const exists = await tx.chapterDef.findFirst({ where: { subjectId: subjectId as string, slug } })
        if (exists) continue

        const chapter = await tx.chapterDef.create({
          data: {
            name: ch.title,
            slug,
            order: ch.order ?? 0,
            subjectId: subjectId as string,
            status: 'draft',
            lifecycle: 'active'
          }
        })

        // topics
        if (Array.isArray(ch.topics)) {
          for (const t of ch.topics) {
            const tslug = toSlug(t.title)
            // skip if topic already exists under chapter
            const texists = await tx.topicDef.findFirst({ where: { chapterId: chapter.id, slug: tslug } })
            if (texists) continue

            await tx.topicDef.create({
              data: {
                name: t.title,
                slug: tslug,
                order: t.order ?? 0,
                chapterId: chapter.id,
                status: 'draft',
                lifecycle: 'active'
              }
            })
          }
        }
      }
    })
  } catch (err: any) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: 'failed', lastError: err.message } })
    return
  }

  // Mark job completed
  await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: 'completed' } })
}

export default handleSyllabusJob
