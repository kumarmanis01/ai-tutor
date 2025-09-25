// app/api/chat/route.ts
/**
 * POST /api/chat
 * Body: { message: string, subject?: string }
 *
 * Requirements:
 * - User must be authenticated to ask questions (browsing allowed otherwise)
 * - Free users: up to 3 questions/day
 * - Premium users: unlimited
 * - Saves chat to prisma.chat
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
// import { containsProfanity } from "@/lib/profanity";
import { checkProfanity } from "@/lib/guardrails";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { message, subject = "general" } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message_required" }, { status: 400 });
    }

    // Profanity guard
    if (checkProfanity(message)) {
      return NextResponse.json({ error: "profanity_detected" }, { status: 400 });
    }

    // Require auth for asking questions
    if (!session || !(session as any).user?.id) {
      return NextResponse.json({ error: "login_required" }, { status: 401 });
    }

    const userId = (session as any).user.id as string;

    // Check subscription active
    const activeSub = await prisma.subscription.findFirst({
      where: {
        userId,
        active: true,
        endDate: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    // If not premium, count today's questions
    if (!activeSub) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todaysCount = await prisma.chat.count({
        where: { userId, createdAt: { gte: startOfDay } },
      });

      if (todaysCount >= 3) {
        return NextResponse.json({ error: "free_limit_reached", message: "Free limit reached. Upgrade to continue." }, { status: 402 });
      }
    }

    // Save user's question
    const chat = await prisma.chat.create({
      data: {
        userId,
        role: "user",
        content: message,
        subject,
      },
    });

    // TODO: Replace this with real AI call (OpenAI). For now: simple simulated reply.
    const aiReply = `(${subject} tutor) Short answer to: "${message}"`;

    // Save assistant reply
    await prisma.chat.create({
      data: {
        userId,
        role: "assistant",
        content: aiReply,
        subject,
      },
    });

    return NextResponse.json({ reply: aiReply });
  } catch (err) {
    console.error("chat route error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
