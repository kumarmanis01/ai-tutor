import { getContentQueue } from "@/queues/contentQueue";
import { logger } from "@/lib/logger";

const HYDRATION_DEBUG = process.env.HYDRATION_DEBUG === '1' || process.env.AI_CONTENT_DEBUG === '1'

export async function enqueueTopicHydration(topicId: string) {
  const q = getContentQueue();
  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] enqueueTopicHydration called', { topicId })

  const jobs = []
  const job1 = await q.add("notes-en", { type: "NOTES", payload: { topicId, language: "en" } })
  jobs.push(job1)
  const job2 = await q.add("notes-hi", { type: "NOTES", payload: { topicId, language: "hi" } })
  jobs.push(job2)

  for (const d of ["easy", "medium", "hard"]) {
    const j = await q.add(`q-${d}`, { type: "QUESTIONS", payload: { topicId, difficulty: d } })
    jobs.push(j)
  }

  const assembleJob = await q.add("assemble", { type: "ASSEMBLE_TEST", payload: { topicId } })
  jobs.push(assembleJob)

  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] enqueued topic hydration jobs', { topicId, jobIds: jobs.map(j=>j.id) })
  logger.info('enqueueTopicHydration enqueued jobs', { topicId, jobCount: jobs.length, jobIds: jobs.map(j=>j.id) })
  return jobs.map(j=>j.id)
}
