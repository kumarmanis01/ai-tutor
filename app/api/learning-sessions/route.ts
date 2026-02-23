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

    // Idempotency guard: endedAt and actualTimeSpent are written exactly once.
    // A second call for an already-finalised session returns the existing record unchanged.
    if (ls.endedAt) {
      logger.info("session.completed", { sessionId, minutesWritten: 0, idempotent: true });
      return NextResponse.json({ ok: true, session: ls });
    }

    // Compute derived fields
    let completionPercentage = ls.completionPercentage ?? 0;
    let isCompleted = ls.isCompleted ?? false;

    if (typeof totalQuestions === "number" && typeof answeredCount === "number" && totalQuestions > 0) {
      completionPercentage = Math.max(0, Math.min(100, Math.round((answeredCount / totalQuestions) * 100)));
      isCompleted = completionPercentage >= 100;
    }

    // When session transitions false→true, compute actualTimeSpent from server timestamps.
    // endedAt early-return above guarantees we never reach this block for an already-ended session.
    const wasCompleted = ls.isCompleted ?? false;
    const now = new Date();
    const completionData: Record<string, unknown> = {};
    let minutesWritten: number | null = null;
    if (isCompleted && !wasCompleted) {
      minutesWritten = Math.max(1, Math.floor((now.getTime() - ls.startedAt.getTime()) / 60000));
      completionData.endedAt = now;
      completionData.actualTimeSpent = minutesWritten;
    }

    const updated = await prisma.learningSession.update({
      where: { id: sessionId },
      data: {
        completionPercentage,
        isCompleted,
        lastAccessed: now,
        ...(typeof currentQuestionIndex === "number" ? { currentQuestionIndex } : {}),
        ...completionData,
      },
    });

    logger.info("learningSession.updated", { sessionId, completionPercentage, isCompleted });
    if (minutesWritten !== null) {
      logger.info("session.completed", { sessionId, minutesWritten, idempotent: false });
    }
    return NextResponse.json({ ok: true, session: updated });
  } catch (err: any) {
    logger.error("learningSession.update.error", { error: err?.message });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}