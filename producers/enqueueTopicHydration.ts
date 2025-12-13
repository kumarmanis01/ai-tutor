import { contentQueue } from "@/queues/contentQueue";

export async function enqueueTopicHydration(topicId: string) {
  await contentQueue.add("notes-en", {
    type: "NOTES",
    payload: { topicId, language: "en" }
  })

  await contentQueue.add("notes-hi", {
    type: "NOTES",
    payload: { topicId, language: "hi" }
  })

  for (const d of ["easy", "medium", "hard"]) {
    await contentQueue.add(`q-${d}`, {
      type: "QUESTIONS",
      payload: { topicId, difficulty: d }
    })
  }

  await contentQueue.add("assemble", {
    type: "ASSEMBLE_TEST",
    payload: { topicId }
  })
}
