import { prisma } from "../lib/prisma";

interface AssembleTestsParams {
  board: string;
  grade: string;
  subject: string;
}

export async function assembleTests(params: AssembleTestsParams) {
  const { board, grade, subject } = params;
  const questions = await prisma.question.findMany({
    where: { board, grade, subject },
  });

  const test = {
    easy: questions.filter(q => q.difficulty === "easy").slice(0, 5),
    medium: questions.filter(q => q.difficulty === "medium").slice(0, 5),
    hard: questions.filter(q => q.difficulty === "hard").slice(0, 5),
  };

  // If PracticeTest model does not exist, replace with appropriate model or remove this block
  if (prisma.practiceTest) {
    await prisma.practiceTest.create({
      data: {
        title: `${subject} Test`,
        subject,
        grade,
        questions: test,
      },
    });
  }
}
