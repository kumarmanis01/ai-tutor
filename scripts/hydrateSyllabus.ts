import { prisma } from "../lib/prisma";
import { callLLM } from "../lib/callLLM";
import { syllabusPrompt } from "../lib/prompts";

export async function hydrateSyllabus({ board, grade, subject }) {
  const exists = await prisma.chapterDef.findFirst({
    where: { board, grade, subject },
  });
  if (exists) return;

  const data = await callLLM({
    prompt: syllabusPrompt({ board, grade, subject }),
    promptType: "syllabus",
    board, grade, subject
  });

  for (const ch of data.chapters) {
    const chapter = await prisma.chapterDef.create({
      data: { board, grade, subject, title: ch.title, status: "draft" },
    });

    for (const t of ch.topics) {
      await prisma.topicDef.create({
        data: {
          chapterId: chapter.id,
          name: t,
          status: "draft",
        },
      });
    }
  }
}
