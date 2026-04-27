import { getContentQueue } from "@/queues/contentQueue";
import { logger } from "@/lib/logger";

const HYDRATION_DEBUG = process.env.HYDRATION_DEBUG === '1' || process.env.AI_CONTENT_DEBUG === '1'

export async function enqueueNoteHydration(noteId: string) {
  const q = getContentQueue()
  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] enqueueNoteHydration called', { noteId })
  const job = await q.add(`note-${noteId}`, { type: 'NOTES', payload: { topicId: noteId, language: 'en' } })
  logger.info('enqueueNoteHydration enqueued', { noteId, jobId: job.id })
  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] enqueued note job', { noteId, jobId: job.id })
  return job.id
}
