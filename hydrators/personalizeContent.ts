import { prisma } from "@/lib/prisma"

export async function personalizeContent(studentId: string) {
  const prefs = await prisma.studentContentPreference.findFirst({
    where: { studentId }
  })

  if (prefs) return

  await prisma.studentContentPreference.create({
    data: {
      studentId,
      difficulty: "medium",
      language: "en"
    }
  })
}
