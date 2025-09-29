// app/api/subscription/status/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import { SessionUser } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const sessionUser = session.user as SessionUser;

    if (!sessionUser || !sessionUser.id) {
      // not authenticated — indicate guest
      return NextResponse.json({
        authenticated: false,
        isPremium: false,
        todaysCount: 0,
      });
    }

    const userId = sessionUser.id;

    // Check active subscription
    const sub = await prisma.subscription.findFirst({
      where: {
        userId,
        active: true,
        endDate: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    // Count today's question (chat messages) from Chat model
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaysCount = await prisma.chat.count({
      where: {
        userId,
        createdAt: { gte: startOfDay },
      },
    });

    console.log("Subscription status:", {
      userId,
      isPremium: !!sub,
      todaysCount,
    });
    // Return status
    return NextResponse.json({
      authenticated: true,
      isPremium: !!sub,
      todaysCount,
    });
  } catch (err) {
    console.error("subscription status error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
