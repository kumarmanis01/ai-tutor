// app/api/admin/metrics/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/metrics
 * Returns basic usage metrics for admin dashboard.
 * Requires session & admin role (adjust as required).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new Response("Unauthorized", { status: 401 });

    // Simple RBAC: allow only admin users
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Basic counts
    const [userCount, totalChats, totalEvents] = await Promise.all([
      prisma.user.count(),
      prisma.chat.count(),
      prisma.event.count(),
    ]);

    // Recent active users (who had chats in last 7 days)
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const activeUsers = await prisma.chat.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _count: { userId: true },
      take: 20,
    });

    // Optional: messages per day (last 7 days)
    const raw = await prisma.$queryRaw<
      { day: string; count: number }[]
    >`SELECT date(createdAt) as day, count(*) as count FROM Chat WHERE createdAt >= datetime(${since.toISOString()}) GROUP BY date(createdAt) ORDER BY date(createdAt) ASC;`;

    return NextResponse.json({
      userCount,
      totalChats,
      totalEvents,
      activeUsers: activeUsers.map((r) => ({ userId: r.userId, count: r._count.userId })),
      messagesPerDay: raw,
    });
  } catch (err) {
    console.error("admin/metrics error:", err);
    return NextResponse.json({ error: "server_error", detail: String(err) }, { status: 500 });
  }
}
