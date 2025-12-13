import { prisma } from "../lib/prisma";
import { callLLM } from "../lib/callLLM";
import { questionsPrompt } from "../lib/prompts";

export async function hydrateQuestions({ topicId, board, grade, subject, difficulty }) {
  const topic = await prisma.topicDef.findUnique({ where: { id: topicId } });

  const data = await callLLM({
    prompt: questionsPrompt({ board, grade, subject, topic: topic.name, difficulty }),
    promptType: "questions",
    board, grade, subject, topic: topic.name
  });

  for (const q of data.questions) {
    await prisma.question.create({
      data: {
        board,
        grade,
        subject,
        chapter: topic.chapterId,
        prompt: q.prompt,
        correctAnswer: q.answer,
        difficulty,
        status: "draft",
      },
    });
  }
}
