import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Accepts POST with { contentId: string, event: 'shown'|'clicked'|'completed' }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { contentId, event } = await req.json();
    if (!contentId || !event) {
      return NextResponse.json({ error: "Missing contentId or event" }, { status: 400 });
    }

    const now = new Date();

    // Upsert recommendation record per user + content
    const rec = await prisma.contentRecommendation.upsert({
      where: { userId_contentId: { userId: session.user.id, contentId } },
      update: {},
      create: { userId: session.user.id, contentId },
    });

    let updateData: any = {};
    switch (event) {
      case "shown":
        updateData = {
          isShown: true,
          firstShownAt: rec.firstShownAt ?? now,
          lastShownAt: now,
        };
        break;
      case "clicked":
        updateData = { isClicked: true, clickedAt: now };
        break;
      case "completed":
        updateData = { isCompleted: true, completedAt: now };
        break;
      default:
        return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    const updated = await prisma.contentRecommendation.update({
      where: { id: rec.id },
      data: updateData,
    });

    logger.info("recommendation.track", { userId: session.user.id, contentId, event });
    return NextResponse.json({ ok: true, recommendation: updated });
  } catch (err: any) {
    logger.error("recommendation.track.error", { error: err?.message });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : undefined;
  const event = typeof body.event === 'string' ? body.event : undefined; // 'shown'|'clicked'|'completed'
  if (!id || !event) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  // For now, log only; later persist to ContentRecommendation
  return NextResponse.json({ ok: true });
}
