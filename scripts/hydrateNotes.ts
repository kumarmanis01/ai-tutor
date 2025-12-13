import { prisma } from "../lib/prisma";
import { callLLM } from "../lib/callLLM";
import { notesPrompt } from "../lib/prompts";

export async function hydrateNotes({ topicId, board, grade, subject, language }) {
  const topic = await prisma.topicDef.findUnique({ where: { id: topicId } });
  if (!topic) return;

  const exists = await prisma.note.findFirst({
    where: { title: topic.name, language },
  });
  if (exists) return;

  const data = await callLLM({
    prompt: notesPrompt({ board, grade, subject, topic: topic.name, language }),
    promptType: "notes",
    board, grade, subject, topic: topic.name, language
  });

  await prisma.note.create({
    data: {
      title: data.title,
      content: data.content,
      subject,
      status: "draft",
    },
  });
}
