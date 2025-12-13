await contentQueue.add("notes-en", {
  type: "NOTES",
  payload: { topicId, language: "en" }
})

await contentQueue.add("notes-hi", {
  type: "NOTES",
  payload: { topicId, language: "hi" }
})

for (const diff of ["easy", "medium", "hard"]) {
  await contentQueue.add(`q-${diff}`, {
    type: "QUESTIONS",
    payload: { topicId, difficulty: diff }
  })
}

await contentQueue.add("assemble", {
  type: "ASSEMBLE_TEST",
  payload: { topicId }
})
