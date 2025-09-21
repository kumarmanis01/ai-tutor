// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";

/**
 * GET -> returns { language, lastChats: [] } for logged-in user, or default language for guests
 * POST -> update preferred language (requires login)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ language: "en", lastChats: [] });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { chats: { take: 10, orderBy: { createdAt: "desc" } } },
  });

  return NextResponse.json({
    language: user?.language ?? "en",
    lastChats: user?.chats ?? [],
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { language } = await req.json();
  await prisma.user.update({ where: { email: session.user.email }, data: { language } });

  return NextResponse.json({ ok: true });
}
