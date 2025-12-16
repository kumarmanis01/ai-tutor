import { getContentQueue } from "@/queues/contentQueue";

export async function enqueueTopicHydration(topicId: string) {
  const q = getContentQueue();
  await q.add("notes-en", {
    type: "NOTES",
    payload: { topicId, language: "en" }
  })
  await q.add("notes-hi", {
    type: "NOTES",
    payload: { topicId, language: "hi" }
  })

  for (const d of ["easy", "medium", "hard"]) {
    await q.add(`q-${d}`, {
      type: "QUESTIONS",
      payload: { topicId, difficulty: d }
    })
  }

  await q.add("assemble", {
    type: "ASSEMBLE_TEST",
    payload: { topicId }
  })
}
