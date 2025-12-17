// app/api/admin/ai/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSystemSettingEnabled } from "@/lib/systemSettings";
import { getSyllabusQueue, getNotesQueue, getQuestionsQueue } from "@/queues/contentQueue";
import { requireAdminOrModerator } from "@/lib/auth";

export async function GET() {
  await requireAdminOrModerator();

  const [settings, logsToday, syllabusCount, notesCount, questionsCount] =
    await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: "AI_PAUSED" } }),
      prisma.aIContentLog.aggregate({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        _sum: {
          costUsd: true,
          tokensIn: true,
          tokensOut: true,
        },
      }),
      getSyllabusQueue().getWaitingCount(),
      getNotesQueue().getWaitingCount(),
      getQuestionsQueue().getWaitingCount(),
    ]);

  return NextResponse.json({
    paused: isSystemSettingEnabled(settings?.value),
    queues: {
      syllabus: syllabusCount,
      notes: notesCount,
      questions: questionsCount,
    },
    todayUsage: {
      costUsd: logsToday._sum.costUsd || 0,
      tokensIn: logsToday._sum.tokensIn || 0,
      tokensOut: logsToday._sum.tokensOut || 0,
    },
  });
}