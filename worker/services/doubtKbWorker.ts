import { recordDoubt } from '@/lib/ai/tutor/doubtKb'

export type DoubtRecordJob = {
  questionText: string
  answerText: string
  subjectId: string
  conceptId?: string
}

export async function processDoubtRecord(job: DoubtRecordJob) {
  // Fire-and-forget pattern: recordDoubt handles its own errors and returns void
  return recordDoubt(job.questionText, job.answerText, job.subjectId, job.conceptId)
}

export default processDoubtRecord
