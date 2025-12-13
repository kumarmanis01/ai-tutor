export async function hydrateNotes(topicId: string, language: "en" | "hi") {
  const topic = await prisma.topicDef.findUnique({
    where: { id: topicId },
    include: { chapter: { include: { subject: { include: { class: { include: { board: true }}}}}}
  })

  const prompt = `
Create detailed study notes in ${language}
Topic: ${topic?.name}
Grade: ${topic?.chapter.subject.class.grade}
Board: ${topic?.chapter.subject.class.board.name}

Return JSON:
{ "title": "...", "sections": [...] }
`

  const { content } = await callLLM({
    prompt,
    meta: {
      promptType: "notes",
      board: topic?.chapter.subject.class.board.name,
      grade: topic?.chapter.subject.class.grade,
      subject: topic?.chapter.subject.name,
      topic: topic?.name,
      language,
      topicId
    }
  })

  await prisma.topicNote.create({
    data: {
      topicId,
      title: JSON.parse(content).title,
      language,
      contentJson: JSON.parse(content),
      source: "ai"
    }
  })
}
