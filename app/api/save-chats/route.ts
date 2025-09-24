import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * Persists chat history for a logged-in user
 * Request: { messages: [{ role: "user"|"ai", content: string }] }
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { messages } = body;

    await prisma.chatHistory.create({
      data: {
        userEmail: session.user.email,
        messages: JSON.stringify(messages)
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("SaveChats API error:", err);
    return NextResponse.json({ error: "Failed to save chats" }, { status: 500 });
  }
}
