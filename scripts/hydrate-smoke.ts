import fs from 'fs'
import path from 'path'

// Ensure DATABASE_URL is set from .env.local first
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^DATABASE_URL=(.*)$/)
    if (m) {
      process.env.DATABASE_URL = m[1].trim()
      break
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set in .env.local')
  process.exit(1)
}

import { prisma } from '@/lib/prisma'
import { enqueueSyllabusHydration } from '@/hydrators/hydrateSyllabus'
import { enqueueNotesHydration, enqueueQuestionsHydration } from '@/lib/execution-pipeline/enqueueTopicHydration'

async function main() {
  console.log('Using DATABASE_URL:', process.env.DATABASE_URL)

  // pick one subject
  const subj = await prisma.subjectDef.findFirst({ include: { class: { include: { board: true } } } })
  if (!subj) {
    console.error('No subject found')
    process.exit(1)
  }
  console.log('Selected subject:', subj.name, subj.id)

  const res = await enqueueSyllabusHydration({ board: subj.class.board.name, grade: subj.class.grade, subject: subj.name, subjectId: subj.id, language: 'en' })
  console.log('enqueueSyllabusHydration result:', res)

  // pick one topic for the subject
  const topic = await prisma.topicDef.findFirst({ where: { chapter: { subjectId: subj.class ? subj.class.id : undefined } } as any })
  // fallback: just find any topic
  const anyTopic = topic || (await prisma.topicDef.findFirst())
  if (!anyTopic) {
    console.error('No topic found')
    process.exit(1)
  }
  console.log('Selected topic:', anyTopic.id)

  const notesRes = await enqueueNotesHydration({ topicId: anyTopic.id, language: 'en' })
  console.log('enqueueNotesHydration result:', notesRes)

  for (const d of ['easy', 'medium', 'hard']) {
    const qres = await enqueueQuestionsHydration({ topicId: anyTopic.id, language: 'en', difficulty: d })
    console.log(`enqueueQuestionsHydration ${d} result:`, qres)
  }

  // list recent HydrationJob rows for this topic/subject
  const jobs = await prisma.hydrationJob.findMany({ where: { OR: [ { subjectId: subj.id }, { topicId: anyTopic.id } ] }, orderBy: { createdAt: 'desc' }, take: 20 })
  console.log('Recent HydrationJobs for subject/topic:')
  for (const j of jobs) console.log(j.id, j.jobType, j.status, j.topicId, j.subjectId, j.createdAt)

  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
