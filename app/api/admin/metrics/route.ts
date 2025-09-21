import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * Returns basic usage metrics
 */
export async function GET() {
  try {
    const activeUsers = await prisma.user.count();
    const totalMessages = await prisma.chatHistory.count();

    return NextResponse.json({ activeUsers, totalMessages });
  } catch (err) {
    console.error("Metrics API error:", err);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
