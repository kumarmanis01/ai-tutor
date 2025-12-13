export async function personalizeContent(studentId) {
  const profile = await prisma.studentLearningProfile.findUnique({
    where: { studentId },
  });

  return callLLM({
    prompt: `
Explain ${profile.weakSubjects.join(",")} in simple language
`,
    promptType: "personalization",
  });
}
