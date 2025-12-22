import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { AppSession } from '@/lib/types/auth';
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// PATCH /api/learning-sessions
// Body: { sessionId: string, totalQuestions?: number, answeredCount?: number, currentQuestionIndex?: number }
// Computes completionPercentage and isCompleted on the server and updates the session.
export async function PATCH(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { sessionId, totalQuestions, answeredCount, currentQuestionIndex } = body || {};
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const ls = await prisma.learningSession.findUnique({ where: { id: sessionId } });
    if (!ls) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Compute derived fields
    let completionPercentage = ls.completionPercentage ?? 0;
    let isCompleted = ls.isCompleted ?? false;

    if (typeof totalQuestions === "number" && typeof answeredCount === "number" && totalQuestions > 0) {
      completionPercentage = Math.max(0, Math.min(100, Math.round((answeredCount / totalQuestions) * 100)));
      isCompleted = completionPercentage >= 100;
    }

    const updated = await prisma.learningSession.update({
      where: { id: sessionId },
      data: {
        completionPercentage,
        isCompleted,
        lastAccessed: new Date(),
        ...(typeof currentQuestionIndex === "number" ? { currentQuestionIndex } : {}),
      },
    });

    logger.info("learningSession.updated", { sessionId, completionPercentage, isCompleted });
    return NextResponse.json({ ok: true, session: updated });
  } catch (err: any) {
    logger.error("learningSession.update.error", { error: err?.message });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}