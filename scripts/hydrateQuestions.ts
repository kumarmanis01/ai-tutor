export async function hydrateQuestions(topicId: string, difficulty: string) {
  const prompt = `
Generate ${difficulty} questions for this topic.
Return JSON:
{
  "title": "...",
  "questions": [
    { "type": "mcq", "question": "...", "options": [], "answer": "...", "marks": 1 }
  ]
}
`

  const { content } = await callLLM({
    prompt,
    meta: { promptType: "questions", topicId }
  })

  const parsed = JSON.parse(content)

  const test = await prisma.generatedTest.create({
    data: {
      topicId,
      title: parsed.title,
      difficulty,
      language: "en"
    }
  })

  for (const q of parsed.questions) {
    await prisma.generatedQuestion.create({
      data: {
        testId: test.id,
        type: q.type,
        question: q.question,
        options: q.options,
        answer: q.answer,
        marks: q.marks
      }
    })
  }
}
