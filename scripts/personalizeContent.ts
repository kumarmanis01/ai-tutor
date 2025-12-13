import { callLLM } from "../lib/callLLM";

export async function personalizeContent(studentId: string) {
  if (!prisma) throw new Error("Prisma not initialized");
  const profile = await prisma.studentLearningProfile.findUnique({
    where: { studentId },
  });
  if (!profile) throw new Error("Profile not found");
  return callLLM({
    prompt: `Explain ${profile.weakSubjects.join(",")} in simple language`,
    promptType: "personalization",
  });
}
