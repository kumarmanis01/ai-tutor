// app/api/events/log/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/events/log
 * Body: { type: string, metadata?: any }
 * Records an Event in DB. Attaches userId if logged-in.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const { type, metadata } = body ?? {};

    if (!type || typeof type !== "string") {
      return NextResponse.json({ error: "invalid_event_type" }, { status: 400 });
    }

    const created = await prisma.event.create({
      data: {
        userId: session?.user?.id,
        type,
        metadata: metadata ?? {},
      },
    });

    return NextResponse.json({ ok: true, eventId: created.id });
  } catch (err) {
    console.error("events/log error:", err);
    return NextResponse.json({ error: "server_error", detail: String(err) }, { status: 500 });
  }
}
